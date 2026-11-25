import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../shared/database/domain/islem.js';
import { OutboxYazici } from '../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';
import { KULLANICI_SIRRI_CEKIRDEK_REPO } from '../domain/repositories/i-kullanici-sirri-cekirdek.repository.js';
import { type IzBilgisi, notunOrtakAlanlari } from './iz.js';

// Çekirdek parça "parola sırrı" (TS-002 "Yapı"; AK-43): kişinin parola sırrı satırını siler. Kişi
// kilidi alınmış bir işlemin içinde çağrılır (sırrı yazan bütün işler kişiyi kilitler); kendi işlemini
// açmaz. Not parola özetini taşımaz (TS-002 "Çekirdek yolların izi").
@Injectable()
export class ParolaSirri {
  constructor(private readonly yazici: OutboxYazici) {}

  // Kişinin sır satırını (varsa) siler.
  async sil(islem: Islem, kullaniciId: string, iz: IzBilgisi): Promise<void> {
    const repo = islem.repo(KULLANICI_SIRRI_CEKIRDEK_REPO);
    const guncellemeZamani = await repo.guncellemeZamani(kullaniciId);
    if (guncellemeZamani === null) {
      return;
    }
    await repo.sil(kullaniciId);
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, 'KullaniciSirri', kullaniciId, kullaniciId),
      eylem: 'silme',
      degisen: {
        kullanici_id: { eski: kullaniciId },
        guncelleme_zamani: { eski: guncellemeZamani.toISOString() },
      },
    });
  }
}
