// Parola değiştir işinin işleyicisi (TS-002 "İşlem sınırları" Parola değiştir; AK-50).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/kodlu-hata.js';
import { OutboxYazici } from '../../../../../../shared/messaging/outbox/outbox-yazici.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../../../_shared/application/iz.js';
import { KisiKilidi } from '../../../../_shared/application/kisi-kilidi.js';
import {
  type EskiParolaReddi,
  eskiParolaKarari,
  type ParolaDegistirmeReddi,
  parolaDegistirmeKarari,
} from '../../../domain/entities/kullanici-sirri.entity.js';
import { ParolaOzetleyici } from '../../../domain/parola-ozetleyici.port.js';
import { PAROLA_REPO } from '../../../domain/repositories/i-parola.repository.js';
import type { ParolaDegistirKomutu } from './parola-degistir.command.js';

// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:parola-degistir';
const ESKI_PAROLA_YANLIS = 'Eski parola yanlış';

// Varlığın retleri bugünkü HTTP cevaplarına çevrilir.
const RET_HATASI: Record<
  EskiParolaReddi | ParolaDegistirmeReddi,
  () => KodluHata
> = {
  parola_yok: () => new KodluHata('cakisma', 'Kişinin parolası yok'),
  eski_parola_yanlis: () =>
    new KodluHata('dogrulama_hatasi', ESKI_PAROLA_YANLIS, [
      { alan: 'eskiParola', neden: ESKI_PAROLA_YANLIS },
    ]),
  sir_degisti: () => new KodluHata('cakisma', 'Parola bu arada değişti'),
  oturum_kapali: () => new KodluHata('kimlik_gerekli', 'Kimlik doğrulanamadı'),
};

// Parola değiştirme (TS-002 "İşlem sınırları" Parola değiştir; AK-50). Yeni parolanın kurala
// uyduğuna gövde şeması (değer nesnesi) bakar; kararlar varlıktandır. Sıra:
// 1. Eski parola işlemin dışında kişinin saklı özetiyle doğrulanır (parolası yoksa doğrulanmaz);
//    sırrın güncelleme zamanı okunur.
// 2. Yeni parola işlemin dışında özetlenir.
// 3. Tek işlemde kişi kilitlenir; kilit altında sırrın güncelleme zamanı ve isteği yapan oturumun
//    açıklığı okunur, varlık önce sırrın değişip değişmediğine, sonra oturuma bakar. Tutmazsa hata
//    işlemi geri alır; o ana kadar işlemde yazma yoktur.
// 4. Sır yazılır; kişinin bütün oturumları, isteği yapan dahil, parola_degisimi nedeniyle kapatılır.
// Notların yazanı parolasını değiştiren kişidir (TS-002 AK-35); notlar sırrın değerini taşımaz.
@Injectable()
export class ParolaDegistirHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ozetleyici: ParolaOzetleyici,
    private readonly kisiKilidi: KisiKilidi,
    private readonly yazici: OutboxYazici,
  ) {}

  async calistir({
    kullaniciId,
    oturumId,
    eskiParola,
    yeniParola,
  }: ParolaDegistirKomutu): Promise<void> {
    const sir = await this.uow.read(PAROLA_REPO).kisininSirri(kullaniciId);
    const eski = eskiParolaKarari({
      sir,
      parolaDogruMu:
        sir !== null &&
        (await this.ozetleyici.dogrula(eskiParola, sir.parolaOzeti)),
    });
    if (eski.tur === 'ret') {
      throw RET_HATASI[eski.neden]();
    }
    const oncekiZaman = eski.deger.guncellemeZamani;
    const parolaOzeti = await this.ozetleyici.ozetle(yeniParola);
    const iz: IzBilgisi = { yazanId: kullaniciId, isAdi: IS_ADI };

    await this.uow.run(async (islem) => {
      await this.kisiKilidi.kilitle(islem, kullaniciId);
      const repo = islem.repo(PAROLA_REPO);
      const karar = parolaDegistirmeKarari({
        okunanZaman: oncekiZaman,
        kilitAltindakiZaman: await repo.sirZamani(kullaniciId),
        oturumAcikMi: await repo.oturumAcikMi(oturumId, kullaniciId),
      });
      if (karar.tur === 'ret') {
        throw RET_HATASI[karar.neden]();
      }

      const guncellemeZamani = new Date();
      await repo.sirYaz(kullaniciId, parolaOzeti, guncellemeZamani);
      // Sır satırının notu parola özetini taşımaz; değiştiğini güncelleme zamanı gösterir.
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'KullaniciSirri', kullaniciId, kullaniciId),
        eylem: 'guncelleme',
        degisen: {
          guncelleme_zamani: {
            eski: oncekiZaman.toISOString(),
            yeni: guncellemeZamani.toISOString(),
          },
        },
      });

      // Kişinin kilidi zaten tutuluyor; bu çağrı yalnız oturumları kapatır ve kapatma notlarını yazar.
      await this.kisiKilidi.kilitle(islem, kullaniciId, {
        neden: 'parola_degisimi',
        iz,
      });
    });
  }
}
