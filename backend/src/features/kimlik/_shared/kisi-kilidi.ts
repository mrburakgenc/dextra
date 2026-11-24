import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../shared/database/unit-of-work.js';
import { OutboxYazici } from '../../../shared/messaging/outbox/outbox-yazici.js';
import { KULLANICI_CEKIRDEK_REPO } from './cekirdek/kullanici.repository.js';
import {
  type KapatilmaNedeni,
  OTURUM_CEKIRDEK_REPO,
} from './cekirdek/oturum.repository.js';
import { type IzBilgisi, notunOrtakAlanlari } from './iz.js';

// Çekirdek parça "kişi kilidi" (TS-002 "Yapı"): kişinin satırını genel sayaçla aynı kiple (anahtar
// dışı güncelleme kilidi) kilitler; istenirse kapatılmamış bütün oturumlarını verilen nedenle
// kapatır. Kilit sırasında genel sayaçtan sonra, oturumlardan önce gelir. Kendi işlemini açmaz.
@Injectable()
export class KisiKilidi {
  constructor(private readonly yazici: OutboxYazici) {}

  async kilitle(
    islem: Islem,
    kullaniciId: string,
    oturumlariKapat?: { neden: KapatilmaNedeni; iz: IzBilgisi },
  ): Promise<void> {
    await islem.repo(KULLANICI_CEKIRDEK_REPO).kilitle(kullaniciId);
    if (oturumlariKapat === undefined) {
      return;
    }
    const { neden, iz } = oturumlariKapat;
    const kapananlar = await islem
      .repo(OTURUM_CEKIRDEK_REPO)
      .hepsiniKapat(kullaniciId, neden);
    // Yalnız kapatılmamış satırlar güncellendiği için iki kolonun eski değeri boştur.
    for (const oturum of kapananlar) {
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'Oturum', oturum.id, kullaniciId),
        eylem: 'guncelleme',
        degisen: {
          kapatilma_zamani: {
            eski: null,
            yeni: oturum.kapatilmaZamani.toISOString(),
          },
          kapatilma_nedeni: { eski: null, yeni: neden },
        },
      });
    }
  }
}
