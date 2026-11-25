import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../shared/database/domain/islem.js';
import { OutboxYazici } from '../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';
import { KULLANICI_CEKIRDEK_REPO } from '../domain/repositories/i-kullanici-cekirdek.repository.js';
import { type IzBilgisi, notunOrtakAlanlari } from './iz.js';

// Çekirdek parça "kişinin sayısı" (TS-002 "Yapı"): kişinin yetki sayısını bir artırır; genel sayacı
// kilitlemez. Kendi işlemini açmaz; çağıranın işleminde çalışır.
@Injectable()
export class KisininSayisi {
  constructor(private readonly yazici: OutboxYazici) {}

  async artir(islem: Islem, kullaniciId: string, iz: IzBilgisi): Promise<void> {
    const yeni = await islem
      .repo(KULLANICI_CEKIRDEK_REPO)
      .surumuArtir(kullaniciId);
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, 'Kullanici', kullaniciId, kullaniciId),
      eylem: 'guncelleme',
      degisen: { yetki_surumu: { eski: yeni - 1, yeni } },
    });
  }
}
