// Yenileme işinin işleyicisi (TS-002 "İşlem sınırları" Yenile, AK-49).
import { Injectable, Logger } from '@nestjs/common';
import type { Islem } from '../../../../../../shared/database/domain/islem.js';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { BelirtecServisi } from '../../../../../../shared/guvenlik/application/belirtec.js';
import { KodluHata } from '../../../../../../shared/http/domain/kodlu-hata.js';
import { OutboxYazici } from '../../../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';
import type { KapatilmaNedeni } from '../../../../_shared/domain/kapatilma-nedeni.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../../../_shared/application/iz.js';
import { KisiKilidi } from '../../../../_shared/application/kisi-kilidi.js';
import {
  dondurme,
  oturumSirrininOzeti,
  pencereKarari,
  yeniNesil,
  yenilemeKarari,
} from '../../../domain/entities/oturum.entity.js';
import { OTURUM_REPO } from '../../../domain/repositories/i-oturum.repository.js';
import { kapatmaNotu } from '../../_shared/kapatma-notu.js';
import type { YenileKomutu } from './yenile.command.js';
import type { YenileSonucu } from './yenile.result.js';

// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:yenile';

// Başarısızlığın her türü için tek cevap (TS-002 AK-49 madde 1); neden dışarıya verilmez.
export function yenilemeBasarisiz(): KodluHata {
  return new KodluHata('kimlik_gerekli', 'Oturum yenilenemedi');
}

// İşlemin sonucu. Ret hata olarak atılmaz: kapatmalar ve notları işlemle birlikte kalıcı olur
// (TS-002 "Kapatıp reddeden dallar"); günlük işlem tamamlandıktan sonra yazılır.
type IslemSonucu =
  | { readonly tur: 'tamam'; readonly yenilemeBelirteci: string }
  | {
      readonly tur: 'ret';
      readonly kapananlar: readonly string[];
      readonly neden?: KapatilmaNedeni;
      readonly eskiNesil?: boolean;
    };

// Yenileme (TS-002 "İşlem sınırları" Yenile, AK-49; KR-009 Kural 3, 4, 7, 8, 11). Sıra:
// 1. Belirtecin imzası, süresi ve türü işlemin dışında doğrulanır; geçersizse hiçbir satıra
//    dokunulmaz.
// 2. Tek işlemde kişi, sonra oturum kilitlenir; sır satırı kilit altında okunur; karar
//    varlığın yenilemeKarari'ndadır.
// 3. Geçerli nesilde döndürülür (döndürmenin hâli varlıktandır); pencere içinde bir önceki nesille
//    gelende döndürülmez, geçerli neslin belirteci satırdaki son döndürme zamanıyla yeniden
//    imzalanır (aynı dizge; tutması varlığın pencereKarari'ndadır).
// Kapatmaların notunda yazan kimlik sistem aktörü, döndürmenin notunda kişidir (AK-35, AK-49
// madde 6). Günlüğe ve notlara belirteç, sır, özet, adres ve tarayıcı bilgisi yazılmaz (AK-13).
@Injectable()
export class YenileHandler {
  private readonly gunluk = new Logger(YenileHandler.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly kisiKilidi: KisiKilidi,
    private readonly belirtecler: BelirtecServisi,
    private readonly yazici: OutboxYazici,
  ) {}

  async calistir(komut: YenileKomutu): Promise<YenileSonucu> {
    const dogrulama = await this.belirtecler.yenilemeBelirteciDogrula(
      komut.yenilemeBelirteci,
    );
    if (!dogrulama.gecerli) {
      throw yenilemeBasarisiz();
    }
    const { kullaniciId, oturumId, nesil } = dogrulama.icerik;

    const sonuc = await this.uow.run(async (islem): Promise<IslemSonucu> => {
      await this.kisiKilidi.kilitle(islem, kullaniciId);
      const repo = islem.repo(OTURUM_REPO);
      const satir = await repo.kilitleVeOku(oturumId, kullaniciId);
      const simdi = new Date();
      const karar = yenilemeKarari(
        satir,
        {
          nesil,
          belirtecOzeti: oturumSirrininOzeti(komut.yenilemeBelirteci),
          ipAdresi: komut.ipAdresi,
          tarayiciBilgisi: komut.tarayiciBilgisi,
          cihazSirriOzeti: oturumSirrininOzeti(komut.cihazSirri),
        },
        simdi.getTime(),
      );

      switch (karar.tur) {
        case 'reddet':
          return { tur: 'ret', kapananlar: [], eskiNesil: karar.eskiNesil };
        case 'kapat':
          return {
            tur: 'ret',
            neden: karar.neden,
            kapananlar: await this.kapat(
              islem,
              kullaniciId,
              [oturumId],
              karar.neden,
              simdi,
            ),
          };
        case 'yeniden_kullanim':
          return {
            tur: 'ret',
            neden: 'yeniden_kullanim',
            kapananlar: await this.kapat(
              islem,
              kullaniciId,
              await repo.kapatilmamislar(kullaniciId),
              'yeniden_kullanim',
              simdi,
            ),
          };
      }

      const { sir, sonDondurmeZamani } = karar;
      if (karar.tur === 'pencere') {
        const yenilemeBelirteci = await this.belirtecler.yenilemeBelirteciUret(
          { kullaniciId, oturumId, nesil: sir.nesil },
          sonDondurmeZamani,
        );
        // Yeniden imzalanan belirteç saklanan özete uymuyorsa reddedilir; oturum yaşar.
        if (pencereKarari(sir, yenilemeBelirteci).tur === 'ret') {
          return { tur: 'ret', kapananlar: [] };
        }
        return { tur: 'tamam', yenilemeBelirteci };
      }

      const yenilemeBelirteci = await this.belirtecler.yenilemeBelirteciUret(
        { kullaniciId, oturumId, nesil: yeniNesil(sir) },
        simdi,
      );
      await repo.dondur(oturumId, dondurme(sir, yenilemeBelirteci, simdi));
      const iz: IzBilgisi = { yazanId: kullaniciId, isAdi: IS_ADI };
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'Oturum', oturumId, kullaniciId),
        eylem: 'guncelleme',
        degisen: {
          son_dondurme_zamani: {
            eski: sonDondurmeZamani.toISOString(),
            yeni: simdi.toISOString(),
          },
        },
      });
      // Sır satırının notu değer taşımaz (TS-002 "Çekirdek yolların izi").
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'OturumSirri', oturumId, kullaniciId),
        eylem: 'guncelleme',
        degisen: {},
      });
      return { tur: 'tamam', yenilemeBelirteci };
    });

    if (sonuc.tur === 'tamam') {
      return {
        erisimBelirteci: await this.belirtecler.erisimBelirteciUret({
          kullaniciId,
          oturumId,
        }),
        yenilemeBelirteci: sonuc.yenilemeBelirteci,
      };
    }
    // Güvenlik olayı kaydı tasarlanana kadar teknik günlüğe yazılır (AK-13). Kapatma olayı yalnız
    // oturum gerçekten kapandıysa yazılır; kapalı oturuma eski nesil adıyla istisnadır (Kural 7, 11).
    for (const id of sonuc.kapananlar) {
      this.gunluk.warn(
        `Oturum kapatıldı: oturum=${id} neden=${String(sonuc.neden)}`,
      );
    }
    if (sonuc.eskiNesil === true) {
      this.gunluk.warn(
        `Kapalı oturuma eski nesil geldi: oturum=${oturumId} neden=kapali_oturuma_eski_nesil`,
      );
    }
    throw yenilemeBasarisiz();
  }

  // Verilen oturumlardan kapatılmamış olanları kapatır, her biri için kapatma notunu yazar ve
  // kapananları döner. Yazan kimlik sistem aktörüdür (sistemin kararı; AK-35).
  private async kapat(
    islem: Islem,
    kullaniciId: string,
    idler: readonly string[],
    neden: KapatilmaNedeni,
    kapatilmaZamani: Date,
  ): Promise<string[]> {
    const repo = islem.repo(OTURUM_REPO);
    const kapananlar = await repo.kapat(idler, neden, kapatilmaZamani);
    if (kapananlar.length === 0) {
      return kapananlar;
    }
    const iz: IzBilgisi = {
      yazanId: await repo.kimlikSistemAktoru(),
      isAdi: IS_ADI,
    };
    for (const id of kapananlar) {
      await this.yazici.degisiklikKaydi(
        islem,
        kapatmaNotu(iz, { id, kullaniciId }, neden, kapatilmaZamani),
      );
    }
    return kapananlar;
  }
}
