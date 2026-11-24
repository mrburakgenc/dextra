import { Injectable } from '@nestjs/common';
import { yeniKimlik } from '../../../shared/database/kimlik.js';
import type { Islem } from '../../../shared/database/unit-of-work.js';
import { OutboxYazici } from '../../../shared/messaging/outbox/outbox-yazici.js';
import { UYELIK_CEKIRDEK_REPO } from './cekirdek/uyelik.repository.js';
import { type IzBilgisi, notunOrtakAlanlari } from './iz.js';

// Çekirdek parça "kök üyelik" (TS-002 "Yapı"; KR-008 Seçim 31 ve 43): yeteneksiz üyelik yazımı ve
// kapatması. Kendi işlemini açmaz; çağıranın işleminde çalışır.
@Injectable()
export class KokUyelik {
  constructor(private readonly yazici: OutboxYazici) {}

  // Kişiye (kök grup, temel rol) üyeliğini yazar; kişide canlı olanı varsa tekil kısıt reddeder.
  async yaz(islem: Islem, kullaniciId: string, iz: IzBilgisi): Promise<void> {
    const kume = await islem.repo(UYELIK_CEKIRDEK_REPO).kokKume();
    await uyelikYaz(this.yazici, islem, { kullaniciId, ...kume }, iz);
  }

  // Kişinin bütün canlı üyeliklerini (kök üyelik dahil) kapatır.
  async kapat(islem: Islem, kullaniciId: string, iz: IzBilgisi): Promise<void> {
    const kapananlar = await islem
      .repo(UYELIK_CEKIRDEK_REPO)
      .hepsiniKapat(kullaniciId);
    for (const uyelik of kapananlar) {
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(iz, 'Uyelik', uyelik.id, kullaniciId),
        eylem: 'guncelleme',
        degisen: {
          silinme_zamani: {
            eski: null,
            yeni: uyelik.silinmeZamani.toISOString(),
          },
        },
      });
    }
  }
}

// Üyeliği yazar ve notunu bırakır; kök üyelik ve tohum yardımcısı kullanır.
export async function uyelikYaz(
  yazici: OutboxYazici,
  islem: Islem,
  uyelik: { kullaniciId: string; grupId: string; rolId: string },
  iz: IzBilgisi,
): Promise<void> {
  const id = yeniKimlik();
  const { olusturmaZamani } = await islem
    .repo(UYELIK_CEKIRDEK_REPO)
    .ekle({ id, ...uyelik });
  await yazici.degisiklikKaydi(islem, {
    ...notunOrtakAlanlari(iz, 'Uyelik', id, uyelik.kullaniciId),
    eylem: 'olusturma',
    degisen: {
      kullanici_id: { yeni: uyelik.kullaniciId },
      grup_id: { yeni: uyelik.grupId },
      rol_id: { yeni: uyelik.rolId },
      olusturma_zamani: { yeni: olusturmaZamani.toISOString() },
    },
  });
}
