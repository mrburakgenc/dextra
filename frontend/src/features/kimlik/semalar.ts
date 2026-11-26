import { z } from 'zod';
import { SartOgesi as SartOgesiSemasi } from './yetenek/yetenek-listesi';
import {
  DEGER_TURLERI,
  ISLECLER,
  type Islec,
  kolonlaraCevir,
  type SartCevrimi,
  type SartOgesi,
  sartOgesine,
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

// Parolamı değiştir (TS-004 "Parola değiştirme ve oturumlar ekranları"): yeni parolanın kuralı
// belirlemedeki gibidir; tekrar backend'e gitmez, yalnız ekranda sınanır.
export const ParolaDegistirSemasi = z
  .object({
    eskiParola: z
      .string({ error: 'Eski parola boş olamaz' })
      .min(1, 'Eski parola boş olamaz'),
    yeniParola: z
      .string({ error: 'Parola boş olamaz' })
      .refine((p) => kodNoktasiSayisi(p) >= PAROLA_EN_AZ, {
        error: `Parola en az ${String(PAROLA_EN_AZ)} karakter olmalı`,
      })
      .refine((p) => kodNoktasiSayisi(p) <= PAROLA_EN_COK, {
        error: `Parola en çok ${String(PAROLA_EN_COK)} karakter olabilir`,
      }),
    yeniParolaTekrar: z.string({ error: 'Parola tekrarı boş olamaz' }),
  })
  .refine((d) => d.yeniParola === d.yeniParolaTekrar, {
    error: 'Parolalar birbirini tutmuyor',
    path: ['yeniParolaTekrar'],
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
// bilmez; onları backend sınar. Şart satırının hatası satır numarasıyla o satırın hatalı girdisine
// yazılır.
// Saklanan satır (TS-004 "Yönetim formlarının sertleştirilmesi") alanı ve işleci olduğu gibi, değeri
// saklandığı yazımla (JSON) taşır; değer kaydın şemasıyla sınanır ve aynen gider. Saklanan kolon
// listesi kolon kolon gelir ve aynen gider.
const sartSatiri = z.object({
  alan: z.string(),
  islec: z.enum(ISLECLER),
  tur: z.enum([...DEGER_TURLERI, 'saklanan']),
  deger: z.string(),
});

function saklananOge(alan: string, islec: Islec, yazim: string): SartCevrimi {
  let deger: unknown;
  try {
    deger = JSON.parse(yazim);
  } catch {
    deger = undefined;
  }
  const oge = SartOgesiSemasi.safeParse({ alan, islec, deger });
  return oge.success ? { oge: oge.data } : { hata: 'Şart okunamadı', girdi: 'deger' };
}

const yetenekIcerigi = {
  sart: z.array(sartSatiri).transform((satirlar, ctx) => {
    const ogeler: SartOgesi[] = [];
    for (const [sira, satir] of satirlar.entries()) {
      const oge =
        satir.tur === 'saklanan'
          ? saklananOge(satir.alan, satir.islec, satir.deger)
          : sartOgesine({ ...satir, tur: satir.tur });
      if ('hata' in oge) {
        ctx.addIssue({
          code: 'custom',
          message: `${String(sira + 1)}. şart: ${oge.hata}`,
          path: [sira, oge.girdi],
        });
        return z.NEVER;
      }
      ogeler.push(oge.oge);
    }
    return ogeler.length === 0 ? null : ogeler;
  }),
  butunKayitlar: z.boolean(),
  butunBirimler: z.boolean(),
  // Çevirme union'ın dışındadır: içindeki ileti union'dan çıkmaz, yerine 'Invalid input' görünürdü.
  kolonlar: z.union([z.array(z.string()), z.string()]).transform((girdi, ctx) => {
    if (Array.isArray(girdi)) {
      return girdi;
    }
    const kolonlar = kolonlaraCevir(girdi);
    if ('hata' in kolonlar) {
      ctx.addIssue({ code: 'custom', message: kolonlar.hata });
      return z.NEVER;
    }
    return kolonlar.deger;
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

// Etki ve öncelik (TS-008 "Yönetim, izinler ve teşhis"): ikisi de isteğe bağlıdır; formda yoksa
// gövdeye girmez. Öncelik tam sayıya çevrilir; aralığını ve yazımın açık olup olmadığını backend
// sınar.
const giremez = z
  .enum(['izin', 'yasak'])
  .transform((etki) => etki === 'yasak')
  .optional();

const oncelik = z
  .string()
  .trim()
  .regex(/^-?\d+$/, 'Öncelik tam sayı olmalı')
  .transform(Number)
  .optional();

export const YetenekYazSemasi = sinirlariDenetle(
  z.object({
    grupId: z.uuid({ error: 'Grup seçilmeli' }),
    rolId: z.uuid({ error: 'Rol seçilmeli' }),
    izinId: z.uuid({ error: 'İzin seçilmeli' }),
    giremez,
    oncelik,
    ...yetenekIcerigi,
  }),
);

// Yenileme etkiyi taşımaz: etki çevrilemez (KU-020).
export const YetenekYenileSemasi = sinirlariDenetle(
  z.object({ oncelik, ...yetenekIcerigi }),
);

// Zod hatasından her alanın ilk iletisi. İç içe alanın anahtarı yolun noktayla birleşimidir; şart
// satırının hatası 'sart.<sıra>.<girdi>' anahtarıyla o satırın altında gösterilir.
export function semaAlanHatalari(hata: z.ZodError): Record<string, string> {
  const alanlar: Record<string, string> = {};
  for (const sorun of hata.issues) {
    if (typeof sorun.path[0] === 'string') {
      alanlar[sorun.path.map(String).join('.')] ??= sorun.message;
    }
  }
  return alanlar;
}
