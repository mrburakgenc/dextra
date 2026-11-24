import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { ParolaBaglantisi } from '../../_shared/baglanti/parola-baglantisi.js';
import type { IzBilgisi } from '../../_shared/iz.js';
import { KisiKilidi } from '../../_shared/kisi-kilidi.js';
import { PAROLA_REPO } from '../domain/parola.repository.js';

// İlk SuperAdmin'in kullanıcı adı (TS-002 AK-3; ilk kurulum göçü yazar).
export const SUPERADMIN_KULLANICI_ADI = 'superadmin';
// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:kurulum';

// Kurulum komutunun işi (TS-002 AK-15; KR-009 Seçim 9): ilk SuperAdmin için parola bağlantısı üretir
// ve kodu döner. Kullanıcı ya da üyelik yazmaz; kişinin kullanılmamış eski bağlantısı silinir.
@Injectable()
export class KurulumBaglantisiHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly kisiKilidi: KisiKilidi,
    private readonly baglanti: ParolaBaglantisi,
  ) {}

  async calistir(): Promise<string> {
    const okuma = this.uow.read(PAROLA_REPO);
    const kullaniciId = await okuma.kullaniciAdiylaBul(
      SUPERADMIN_KULLANICI_ADI,
    );
    if (kullaniciId === null) {
      throw new Error(
        `Kullanıcı adı "${SUPERADMIN_KULLANICI_ADI}" olan kullanıcı yok; önce tohum göçlerini uygulayın (pnpm -C backend tohum)`,
      );
    }
    const iz: IzBilgisi = {
      yazanId: await okuma.kimlikSistemAktoru(),
      isAdi: IS_ADI,
    };
    return this.uow.run(async (islem) => {
      await this.kisiKilidi.kilitle(islem, kullaniciId);
      return this.baglanti.uret(islem, { kullaniciId, olusturanId: null }, iz);
    });
  }
}
