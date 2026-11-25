// Oturum denetimi işinin işleyicisi (TS-002 "Yapı", AK-12, AK-13): ortak koddaki sözleşmeyi uygular;
// sözleşme gereği tek calistir yerine denetle vardır.
import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import type {
  OturumDenetimi,
  OturumDenetimiSonucu,
} from '../../../../../../shared/kimlik/oturum-denetimi.contract.js';
import { OutboxYazici } from '../../../../../../shared/messaging/outbox/outbox-yazici.js';
import { notunOrtakAlanlari } from '../../../../_shared/iz.js';
import { denetimSonucu } from '../../../domain/entities/oturum.entity.js';
import { OTURUM_DENETIMI_REPO } from '../../../domain/repositories/i-oturum-denetimi.repository.js';
import type { OturumDenetimiKomutu } from './oturum-denetimi.command.js';

// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:oturum-denetimi';

// OturumDenetimi sözleşmesinin uygulaması (TS-002 "Yapı", AK-12, AK-13). Her çağrıda tek okuma
// yapılır; sonucu varlık verir. Yalnız adres ya da tarayıcı bilgisi uymadığında o oturum kapatılır
// (KR-009 Kural 8). Kapatma ret sonucuyla birlikte kalıcıdır: işlem tamamlanır, ret hata olarak
// atılmaz (TS-002 "Kapatıp reddeden dallar").
@Injectable()
export class OturumDenetimiHandler implements OturumDenetimi {
  private readonly gunluk = new Logger(OturumDenetimiHandler.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly yazici: OutboxYazici,
  ) {}

  async denetle(girdi: OturumDenetimiKomutu): Promise<OturumDenetimiSonucu> {
    const satir = await this.uow.read(OTURUM_DENETIMI_REPO).oku(girdi.oturumId);
    const sonuc = denetimSonucu(satir, girdi, Date.now());
    if (satir !== null && !sonuc.gecerli && sonuc.neden === 'adres_degisti') {
      await this.adresleKapat(girdi.oturumId, satir.kullaniciId);
    }
    return sonuc;
  }

  private async adresleKapat(
    oturumId: string,
    kullaniciId: string,
  ): Promise<void> {
    const kapandi = await this.uow.run(async (islem) => {
      const repo = islem.repo(OTURUM_DENETIMI_REPO);
      const kapatilmaZamani = new Date();
      // Arada başka bir yol kapatmışsa satıra dokunulmaz ve iz yazılmaz.
      if (!(await repo.adresleKapat(oturumId, kapatilmaZamani))) {
        return false;
      }
      const iz = { yazanId: await repo.kimlikSistemAktoru(), isAdi: IS_ADI };
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'Oturum', oturumId, kullaniciId),
        eylem: 'guncelleme',
        degisen: {
          kapatilma_zamani: {
            eski: null,
            yeni: kapatilmaZamani.toISOString(),
          },
          kapatilma_nedeni: { eski: null, yeni: 'adres_degisti' },
        },
      });
      return true;
    });
    // Güvenlik olayı kaydı tasarlanana kadar teknik günlüğe yazılır; adres ve tarayıcı değerleri
    // yazılmaz (AK-13). Olay yalnız oturum gerçekten kapandıysa yazılır (KR-009 Kural 7).
    if (kapandi) {
      this.gunluk.warn(
        `Oturum kapatıldı: oturum=${oturumId} neden=adres_degisti`,
      );
    }
  }
}
