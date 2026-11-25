import { z } from 'zod';
import {
  DEGER_TURLERI,
  type DegerTuru,
  ISLECLER,
  LISTELI_ISLECLER,
  type SabitDeger,
  type SartOgesi,
  YER_TUTUCULAR,
} from './yetenek/yetenek-sarti';

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

// Yetenek yaz ve yenile (TS-004 "Yönetim ekranları"); kurallar backend'in POST kimlik/yetenek
// gövdesindeki gibidir: boş şart ve boş kolon listesi null gider; işaret ile içerik birlikte
// yazılamaz; ikisi de yoksa satır kayıt ya da kolon vermez ama yazılır. Alan ve kolon adlarını ekran
// bilmez; onları backend sınar. Şart satırının hatası satır numarasıyla 'sart' alanına yazılır.
const sartSatiri = z.object({
  alan: z.string(),
  islec: z.enum(ISLECLER),
  tur: z.enum(DEGER_TURLERI),
  deger: z.string(),
});

type Cevrim<T> = { readonly deger: T } | { readonly hata: string };

function sabiteCevir(tur: DegerTuru, metin: string): Cevrim<SabitDeger> {
  const parca = metin.trim();
  if (parca === '') {
    return { hata: 'Değer boş olamaz' };
  }
  if (tur === 'sayi') {
    const sayi = Number(parca);
    return Number.isFinite(sayi) ? { deger: sayi } : { hata: 'Değer sayıya çevrilemiyor' };
  }
  if (tur === 'mantiksal') {
    return parca === 'true' || parca === 'false'
      ? { deger: parca === 'true' }
      : { hata: 'Değer true ya da false olmalı' };
  }
  return { deger: parca };
}

function sartOgesine(satir: z.infer<typeof sartSatiri>): Cevrim<SartOgesi> {
  const alan = satir.alan.trim();
  if (alan === '') {
    return { hata: 'Alan boş olamaz' };
  }
  const { islec, tur } = satir;
  if (tur === 'yerTutucu') {
    const yerTutucu = z.enum(YER_TUTUCULAR).safeParse(satir.deger);
    return yerTutucu.success
      ? { deger: { alan, islec, deger: { yerTutucu: yerTutucu.data } } }
      : { hata: 'Yer tutucu seçilmeli' };
  }
  if (!LISTELI_ISLECLER.includes(islec)) {
    const deger = sabiteCevir(tur, satir.deger);
    return 'hata' in deger ? deger : { deger: { alan, islec, deger: deger.deger } };
  }
  const degerler: SabitDeger[] = [];
  for (const parca of satir.deger.split(',')) {
    const deger = sabiteCevir(tur, parca);
    if ('hata' in deger) {
      return deger;
    }
    degerler.push(deger.deger);
  }
  return { deger: { alan, islec, deger: degerler } };
}

const yetenekIcerigi = {
  sart: z.array(sartSatiri).transform((satirlar, ctx) => {
    const ogeler: SartOgesi[] = [];
    for (const [sira, satir] of satirlar.entries()) {
      const oge = sartOgesine(satir);
      if ('hata' in oge) {
        ctx.addIssue({ code: 'custom', message: `${String(sira + 1)}. şart: ${oge.hata}` });
        return z.NEVER;
      }
      ogeler.push(oge.deger);
    }
    return ogeler.length === 0 ? null : ogeler;
  }),
  butunKayitlar: z.boolean(),
  butunBirimler: z.boolean(),
  kolonlar: z.string().transform((metin, ctx) => {
    if (metin.trim() === '') {
      return null;
    }
    const kolonlar = metin.split(',').map((kolon) => kolon.trim());
    if (kolonlar.includes('')) {
      ctx.addIssue({ code: 'custom', message: 'Kolon adı boş olamaz' });
      return z.NEVER;
    }
    return kolonlar;
  }),
  butunKolonlar: z.boolean(),
};

function sinirlariDenetle<
  T extends z.ZodType<{
    sart: unknown;
    butunKayitlar: boolean;
    kolonlar: unknown;
    butunKolonlar: boolean;
  }>,
>(sema: T): T {
  return sema
    .refine((g) => !(g.butunKayitlar && g.sart !== null), {
      error: 'Bütün kayıtlar işaretliyken şart yazılamaz',
      path: ['sart'],
    })
    .refine((g) => !(g.butunKolonlar && g.kolonlar !== null), {
      error: 'Bütün kolonlar işaretliyken kolon yazılamaz',
      path: ['kolonlar'],
    });
}

export const YetenekYazSemasi = sinirlariDenetle(
  z.object({
    grupId: z.uuid({ error: 'Grup seçilmeli' }),
    rolId: z.uuid({ error: 'Rol seçilmeli' }),
    izinId: z.uuid({ error: 'İzin seçilmeli' }),
    ...yetenekIcerigi,
  }),
);

export const YetenekYenileSemasi = sinirlariDenetle(z.object(yetenekIcerigi));

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
