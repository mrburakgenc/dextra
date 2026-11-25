// Bağlantıyla parola belirle işinin işleyicisi (TS-002 "İşlem sınırları"; KR-009 Seçim 9).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/kodlu-hata.js';
import { OutboxYazici } from '../../../../../../shared/messaging/outbox/outbox-yazici.js';
import { baglantiKodununOzeti } from '../../../../_shared/baglanti/parola-baglantisi.js';
import { PAROLA_BAGLANTISI_REPO } from '../../../../_shared/baglanti/parola-baglantisi.repository.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../../../_shared/iz.js';
import { KisiKilidi } from '../../../../_shared/kisi-kilidi.js';
import { parolaBelirlemeKarari } from '../../../domain/entities/kullanici-sirri.entity.js';
import { ParolaOzetleyici } from '../../../domain/parola-ozetleyici.port.js';
import { PAROLA_REPO } from '../../../domain/repositories/i-parola.repository.js';
import type { ParolaBelirleKomutu } from './parola-belirle.command.js';

// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:parola-belirle';

// Bağlantı yok, kullanılmış ya da süresi geçmişse dönen tek tip hata; hangisi olduğu dışarıya verilmez.
// Varlığın reddi (baglanti_gecersiz) ve kilit altındaki yeniden bakışın reddi bu hataya çevrilir.
function gecersizBaglanti(): KodluHata {
  return new KodluHata('bulunamadi', 'Parola bağlantısı geçersiz');
}

// Bağlantıyla parola belirleme (TS-002 "İşlem sınırları"; KR-009 Seçim 9). Sıra:
// 1. Kodun özeti işlemin dışında hesaplanır ve satır bulunur; varlık bağlantı geçersiz derse parola
//    özetlenmez (geçersiz bağlantıyla özetleme yükü bindirilemez).
// 2. Parola işlemin dışında özetlenir.
// 3. Tek işlemde kişi, ardından bağlantı satırı kilitlenir; bağlantı kullanıldı diye işaretlenir,
//    sır yazılır ve kişinin bütün oturumları parola_degisimi nedeniyle kapatılır.
// Notların yazanı parolasını belirleyen kişidir (TS-002 AK-35). Notlar sırrın ve kodun değerini
// taşımaz (TS-003 değişmez 6).
@Injectable()
export class ParolaBelirleHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ozetleyici: ParolaOzetleyici,
    private readonly kisiKilidi: KisiKilidi,
    private readonly yazici: OutboxYazici,
  ) {}

  async calistir({ kod, parola }: ParolaBelirleKomutu): Promise<void> {
    const baglanti = await this.uow
      .read(PAROLA_BAGLANTISI_REPO)
      .ozetIleBul(baglantiKodununOzeti(kod));
    const karar = parolaBelirlemeKarari({ baglanti, simdi: new Date() });
    if (karar.tur === 'ret') {
      throw gecersizBaglanti();
    }
    const parolaOzeti = await this.ozetleyici.ozetle(parola);
    const { id, kullaniciId } = karar.deger;
    const iz: IzBilgisi = { yazanId: kullaniciId, isAdi: IS_ADI };

    await this.uow.run(async (islem) => {
      await this.kisiKilidi.kilitle(islem, kullaniciId);
      // İlk okumadan bu yana bağlantı kullanılmış ya da süresi geçmiş olabilir; koşula kilit altında
      // yeniden bakılır. Hata işlemi geri alır; işlemde henüz yazma yoktur.
      const kullanilmaZamani = new Date();
      if (
        !(await islem.repo(PAROLA_BAGLANTISI_REPO).kullan(id, kullanilmaZamani))
      ) {
        throw gecersizBaglanti();
      }
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'ParolaBaglantisi', id, kullaniciId),
        eylem: 'guncelleme',
        degisen: {
          kullanilma_zamani: {
            eski: null,
            yeni: kullanilmaZamani.toISOString(),
          },
        },
      });

      const repo = islem.repo(PAROLA_REPO);
      const oncekiZaman = await repo.sirZamani(kullaniciId);
      await repo.sirYaz(kullaniciId, parolaOzeti, kullanilmaZamani);
      const sirNotu = notunOrtakAlanlari(
        iz,
        'KullaniciSirri',
        kullaniciId,
        kullaniciId,
      );
      // Sır satırının notu parola özetini taşımaz; değiştiğini güncelleme zamanı gösterir.
      await this.yazici.degisiklikKaydi(
        islem,
        oncekiZaman === null
          ? {
              ...sirNotu,
              eylem: 'olusturma',
              degisen: {
                kullanici_id: { yeni: kullaniciId },
                guncelleme_zamani: { yeni: kullanilmaZamani.toISOString() },
              },
            }
          : {
              ...sirNotu,
              eylem: 'guncelleme',
              degisen: {
                guncelleme_zamani: {
                  eski: oncekiZaman.toISOString(),
                  yeni: kullanilmaZamani.toISOString(),
                },
              },
            },
      );

      // Kişinin kilidi zaten tutuluyor; bu çağrı yalnız oturumları kapatır. Oturumlar kilit
      // sırasının sonundadır, bu yüzden bağlantıdan sonra kapatılır.
      await this.kisiKilidi.kilitle(islem, kullaniciId, {
        neden: 'parola_degisimi',
        iz,
      });
    });
  }
}
