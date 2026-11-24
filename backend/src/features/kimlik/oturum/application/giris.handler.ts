import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { yeniKimlik } from '../../../../shared/database/kimlik.js';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { BelirtecServisi } from '../../../../shared/guvenlik/belirtec.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { OutboxYazici } from '../../../../shared/messaging/outbox/outbox-yazici.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../_shared/iz.js';
import { KisiKilidi } from '../../_shared/kisi-kilidi.js';
import {
  EN_COK_ACIK_OTURUM,
  MUTLAK_OMUR_MS,
  oturumSirrininOzeti,
} from '../domain/oturum.js';
import { OTURUM_REPO } from '../domain/oturum.repository.js';
import type { GirisCevabi, GirisKomutu } from './giris.command.js';
import { kapatmaNotu } from './kapatma-notu.js';

// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:giris';
// Cihaz sırrı 32 rastgele bayttır; çağırana base64url dizgesi olarak döner.
const CIHAZ_SIRRI_BAYT = 32;

// Başarısızlığın her türü için tek cevap (TS-002 AK-9, AK-15): kişi yok, sır yanlış, kişi pasif,
// unutulmuş ya da sistem aktörü, kesinleştirme tutmadı, adres imzası yok. Hangisi olduğu dışarıya
// verilmez.
export function girisBasarisiz(): KodluHata {
  return new KodluHata('kimlik_gerekli', 'Giriş yapılamadı');
}

// Giriş (TS-002 "İşlem sınırları"; KR-009 Kural 12). Sıra:
// 1. Yöntem girdiyi işlemin dışında doğrular.
// 2. Tek işlemde kişi kilitlenir; pasif, unutulmuş ve sistem aktörü reddedilir; yöntem kilit altında
//    kesinleştirir. Ret işlemi geri alır; o ana kadar yazma yoktur.
// 3. Açık oturumlar sayılır; sınır dolmuşsa en eskisi oturum_siniri nedeniyle kapatılır.
// 4. Oturum ve sır satırı yazılır (nesil 1; son döndürme zamanı başlangıç zamanıdır).
// Notların yazanı giriş yapan kişidir; sır satırının notu değer taşımaz (TS-002 "Çekirdek yolların izi").
@Injectable()
export class GirisHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly kisiKilidi: KisiKilidi,
    private readonly belirtecler: BelirtecServisi,
    private readonly yazici: OutboxYazici,
  ) {}

  async calistir<TGirdi>({
    yontem,
    girdi,
    ipAdresi,
    tarayiciBilgisi,
  }: GirisKomutu<TGirdi>): Promise<GirisCevabi> {
    const dogrulama = await yontem.dogrula(girdi);
    if (dogrulama.sonuc !== 'tamam') {
      throw girisBasarisiz();
    }
    const { kullaniciId, kanit } = dogrulama;
    const oturumId = yeniKimlik();
    const cihazSirri = randomBytes(CIHAZ_SIRRI_BAYT).toString('base64url');
    const [erisimBelirteci, yenilemeBelirteci] = await Promise.all([
      this.belirtecler.erisimBelirteciUret({ kullaniciId, oturumId }),
      this.belirtecler.yenilemeBelirteciUret({
        kullaniciId,
        oturumId,
        nesil: 1,
      }),
    ]);
    const iz: IzBilgisi = { yazanId: kullaniciId, isAdi: IS_ADI };

    await this.uow.run(async (islem) => {
      await this.kisiKilidi.kilitle(islem, kullaniciId);
      const repo = islem.repo(OTURUM_REPO);
      const kisi = await repo.kisininDurumu(kullaniciId);
      if (kisi.pasif || kisi.unutulmus || kisi.sistemAktoru) {
        throw girisBasarisiz();
      }
      if ((await yontem.kesinlestir(islem, kullaniciId, kanit)) !== 'tamam') {
        throw girisBasarisiz();
      }

      const simdi = new Date();
      const acik = await repo.acikOturumlar(kullaniciId, simdi);
      const fazla = acik.slice(
        0,
        Math.max(0, acik.length - (EN_COK_ACIK_OTURUM - 1)),
      );
      if (fazla.length > 0) {
        const kapananlar = await repo.kapat(fazla, 'oturum_siniri', simdi);
        for (const id of kapananlar) {
          await this.yazici.degisiklikKaydi(
            islem,
            kapatmaNotu(iz, { id, kullaniciId }, 'oturum_siniri', simdi),
          );
        }
      }

      const oturum = {
        id: oturumId,
        kullaniciId,
        girisYontemi: yontem.ad,
        baslangicZamani: simdi,
        mutlakBitisZamani: new Date(simdi.getTime() + MUTLAK_OMUR_MS),
        sonDondurmeZamani: simdi,
        ipAdresi,
        tarayiciBilgisi,
      };
      await repo.ekle(oturum, {
        nesil: 1,
        gecerliYenilemeOzeti: oturumSirrininOzeti(yenilemeBelirteci),
        cihazSirriOzeti: oturumSirrininOzeti(cihazSirri),
      });
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'Oturum', oturumId, kullaniciId),
        eylem: 'olusturma',
        degisen: {
          kullanici_id: { yeni: kullaniciId },
          giris_yontemi: { yeni: oturum.girisYontemi },
          baslangic_zamani: { yeni: simdi.toISOString() },
          mutlak_bitis_zamani: {
            yeni: oturum.mutlakBitisZamani.toISOString(),
          },
          son_dondurme_zamani: { yeni: simdi.toISOString() },
          ip_adresi: { yeni: ipAdresi },
          tarayici_bilgisi: { yeni: tarayiciBilgisi },
        },
      });
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'OturumSirri', oturumId, kullaniciId),
        eylem: 'olusturma',
        degisen: { oturum_id: { yeni: oturumId } },
      });
    });

    return { erisimBelirteci, yenilemeBelirteci, cihazSirri, oturumId };
  }
}
