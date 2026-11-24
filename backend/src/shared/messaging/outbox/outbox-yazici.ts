// Outbox'ın yazma yüzeyi: iş kodu notu yalnız run'ın verdiği işlem nesnesiyle, işle aynı
// işlemde bırakır (KR-012 Kural 2, TS-003 Yapı). Notları okuyan ve aktaran kod burada değildir.
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '../../database/generated/client.js';
import { yeniKimlik } from '../../database/kimlik.js';
import type { Islem } from '../../database/unit-of-work.js';
import { OUTBOX_REPO } from './outbox-repo.js';

// Değişiklik kaydı gövdesinin biçim sürümü; aktarıcı bildiğinden büyük sürümü almaz (TS-003).
export const DEGISIKLIK_KAYDI_SURUMU = 1;

// Zincir alanları gövdede bu adlarla durur; başlatan kullanıcı KR-012 Kural 5'tendir.
export interface OlayNotu {
  ad: string;
  surum: number;
  veri: Prisma.InputJsonObject;
  korelasyon_id: string;
  neden_olay_id?: string;
  baslatan_kullanici_id?: string;
}

const kimlik = z.uuid();

// Anahtarlar iz veritabanındaki degisiklik_kaydi kolonlarıdır (TS-003 Veri modeli).
const ortakAlanlar = {
  istek_id: kimlik.nullable(),
  kullanici_id: kimlik,
  uyelik_id: kimlik.nullable(),
  yetenek_id: kimlik.nullable(),
  is_adi: z.string().min(1),
  baslatan_kullanici_id: kimlik.nullable(),
  veri_sahibi_kullanici_id: kimlik.nullable(),
  kaynak: z.string().min(1),
  kayit_id: kimlik,
};

// Oluşturmada yalnız yeni, silmede yalnız eski, güncellemede ikisi bulunur.
const degisiklikKaydiSemasi = z.discriminatedUnion('eylem', [
  z.strictObject({
    ...ortakAlanlar,
    eylem: z.literal('olusturma'),
    degisen: z.record(z.string(), z.strictObject({ yeni: z.json() })),
  }),
  z.strictObject({
    ...ortakAlanlar,
    eylem: z.literal('guncelleme'),
    degisen: z.record(
      z.string(),
      z.strictObject({ eski: z.json(), yeni: z.json() }),
    ),
  }),
  z.strictObject({
    ...ortakAlanlar,
    eylem: z.literal('silme'),
    degisen: z.record(z.string(), z.strictObject({ eski: z.json() })),
  }),
]);

export type DegisiklikKaydiNotu = z.input<typeof degisiklikKaydiSemasi>;

@Injectable()
export class OutboxYazici {
  // Kimlik, ad ve sürüm kolonlara yazılır; gövde yalnız veriyi ve verilen zincir alanlarını taşır.
  async olay(islem: Islem, not: OlayNotu): Promise<string> {
    const { ad, surum, ...govde } = not;
    const id = yeniKimlik();
    await islem.repo(OUTBOX_REPO).olayEkle({ id, ad, surum, govde });
    return id;
  }

  // Gövde katı şemayla doğrulanır; doğrulanmayan not hata atar ve satır yazılmaz.
  async degisiklikKaydi(islem: Islem, not: DegisiklikKaydiNotu): Promise<void> {
    const govde = degisiklikKaydiSemasi.parse(not);
    await islem
      .repo(OUTBOX_REPO)
      .izEkle({ id: yeniKimlik(), surum: DEGISIKLIK_KAYDI_SURUMU, govde });
  }
}
