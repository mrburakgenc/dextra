import { z } from 'zod';

// Kimlik ekranlarının Zod şemaları (KR-014: ön yüzün kendi şeması; backend'den içe aktarılmaz).
// Biçimler backend sözleşmesindeki gibidir (TS-004 "İlk ekranların sözleşmesi"); son sözü
// backend söyler.

export const GirisSemasi = z.object({
  kullaniciAdi: z
    .string({ error: 'Kullanıcı adı boş olamaz' })
    .min(1, 'Kullanıcı adı boş olamaz'),
  parola: z
    .string({ error: 'Parola boş olamaz' })
    .min(1, 'Parola boş olamaz'),
});

// Parola uzunluğu Unicode kod noktasıyla sayılır; string.length UTF-16 birimi saydığı için
// Zod'un min ve max denetimi kullanılmaz.
const PAROLA_EN_AZ = 15;
const PAROLA_EN_COK = 128;

function kodNoktasiSayisi(metin: string): number {
  return Array.from(metin).length;
}

export const ParolaBelirleSemasi = z
  .object({
    kod: z
      .string({ error: 'Bağlantıda kod yok' })
      .min(1, 'Bağlantıda kod yok'),
    parola: z
      .string({ error: 'Parola boş olamaz' })
      .refine((p) => kodNoktasiSayisi(p) >= PAROLA_EN_AZ, {
        error: `Parola en az ${String(PAROLA_EN_AZ)} karakter olmalı`,
      })
      .refine((p) => kodNoktasiSayisi(p) <= PAROLA_EN_COK, {
        error: `Parola en çok ${String(PAROLA_EN_COK)} karakter olabilir`,
      }),
    parolaTekrar: z.string({ error: 'Parola tekrarı boş olamaz' }),
  })
  .refine((d) => d.parola === d.parolaTekrar, {
    error: 'Parolalar birbirini tutmuyor',
    path: ['parolaTekrar'],
  });

// Kullanıcı işleri (TS-004 "Yönetim ekranları"); kurallar backend'in POST kimlik/kullanici
// gövdesindeki gibidir: kullanıcı adı küçük harfe çevrilir, sonra 3-64 karakter ve yalnız küçük
// harf, rakam, nokta, tire ve alt çizgi olur; görünen adın baştaki ve sondaki boşluğu atılır, sonra
// 1-200 karakter olur.
const gorunenAd = z
  .string({ error: 'Görünen ad boş olamaz' })
  .trim()
  .min(1, 'Görünen ad boş olamaz')
  .max(200, 'Görünen ad en çok 200 karakter olabilir');

export const KullaniciAcSemasi = z.object({
  kullaniciAdi: z
    .string({ error: 'Kullanıcı adı boş olamaz' })
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,64}$/,
      'Kullanıcı adı 3-64 karakter olmalı; yalnız a-z harfleri, rakam, nokta, tire ve alt çizgi taşıyabilir',
    ),
  gorunenAd,
});

export const GorunenAdSemasi = z.object({ gorunenAd });

// Kullanıcının kimliği backend'de uuid'dir; backend yoluna girdiği için başka biçim reddedilir.
export const KullaniciKimligi = z.uuid();

// Rol ve grup işleri (TS-004 "Yönetim ekranları"); kurallar backend'in kimlik/rol ve kimlik/grup
// gövdelerindeki gibidir: adın baştaki ve sondaki boşluğu atılır, sonra 1-100 karakter olur; üst
// grup zorunludur. Rol ve grubun kimliği de uuid'dir; backend yoluna girdiği için başka biçim
// reddedilir.
const ad = z
  .string({ error: 'Ad boş olamaz' })
  .trim()
  .min(1, 'Ad boş olamaz')
  .max(100, 'Ad en çok 100 karakter olabilir');

const ustGrupId = z.uuid({ error: 'Üst grup seçilmeli' });

export const AdSemasi = z.object({ ad });

export const GrupOlusturSemasi = z.object({ ad, ustGrupId });

export const GrupTasiSemasi = z.object({ ustGrupId });

export const KayitKimligi = z.uuid();

// Üyelik ver (TS-004 "Yönetim ekranları"); gövde backend'in POST kimlik/uyelik gövdesidir: kişi,
// grup ve rol kimlikleri uuid'dir.
export const UyelikVerSemasi = z.object({
  kullaniciId: z.uuid(),
  grupId: z.uuid({ error: 'Grup seçilmeli' }),
  rolId: z.uuid({ error: 'Rol seçilmeli' }),
});

// Zod hatasından her alanın ilk iletisi.
export function semaAlanHatalari(hata: z.ZodError): Record<string, string> {
  const alanlar: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path[0];
    if (typeof alan === 'string') {
      alanlar[alan] ??= sorun.message;
    }
  }
  return alanlar;
}
