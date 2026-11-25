// Çıkış işinin işleyicisi (TS-002 "İşlem sınırları" Çıkış).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { OutboxYazici } from '../../../../../../shared/messaging/outbox/outbox-yazici.js';
import type { IzBilgisi } from '../../../../_shared/application/iz.js';
import { OTURUM_REPO } from '../../../domain/repositories/i-oturum.repository.js';
import { kapatmaNotu } from '../../_shared/kapatma-notu.js';
import type { CikisKomutu } from './cikis.command.js';

// Çekirdek yolun adı; notların işin adı alanına yazılır (TS-002 AK-2).
const IS_ADI = 'kimlik:cikis';

// Çıkış (TS-002 "İşlem sınırları"): isteği yapan oturum "kapatılmamışsa kapat" diye cikis nedeniyle
// kapatılır; kişi kilitlenmez. Arada başka bir yol kapatmışsa satıra dokunulmaz ve not yazılmaz.
@Injectable()
export class CikisHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly yazici: OutboxYazici,
  ) {}

  async calistir({ kullaniciId, oturumId }: CikisKomutu): Promise<void> {
    const iz: IzBilgisi = { yazanId: kullaniciId, isAdi: IS_ADI };
    await this.uow.run(async (islem) => {
      const kapatilmaZamani = new Date();
      const kapananlar = await islem
        .repo(OTURUM_REPO)
        .kapat([oturumId], 'cikis', kapatilmaZamani);
      for (const id of kapananlar) {
        await this.yazici.degisiklikKaydi(
          islem,
          kapatmaNotu(iz, { id, kullaniciId }, 'cikis', kapatilmaZamani),
        );
      }
    });
  }
}
