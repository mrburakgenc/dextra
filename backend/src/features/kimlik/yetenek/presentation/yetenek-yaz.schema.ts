import { z } from 'zod';
import type {
  Islec,
  SartOgesi,
  YerTutucu,
} from '../../../../shared/kimlik/yetki-verisi.contract.js';

// Şartın bir öğesi (TS-002 "Veri modeli"): alan, işleç ve değer. İşleç derleyicinin tanıdıklarından
// biridir; alanın kaynağın alanlarından olduğuna ve değerin işlece uyduğuna işleyici bakar.
const sabitDeger = z.union([z.string(), z.number(), z.boolean()]);
const sartOgesi = z.strictObject({
  alan: z.string(),
  islec: z.enum([
    'esit',
    'esit_degil',
    'listede',
    'listede_degil',
    'kucuk',
    'kucuk_esit',
    'buyuk',
    'buyuk_esit',
  ] satisfies Islec[]),
  deger: z.union([
    sabitDeger,
    // KR-008 Seçim 11: boş liste şart değeri olarak yazılamaz ('listede_degil []' bütün kayıtları açardı).
    z.array(sabitDeger).min(1),
    z.strictObject({
      yerTutucu: z.enum([
        'isteyen',
        'yetenek_grubu',
        'yetenek_grubu_ve_alti',
      ] satisfies YerTutucu[]),
    }),
  ]),
}) satisfies z.ZodType<SartOgesi>;

// POST kimlik/yetenek gövdesi (KR-014; KR-008 Seçim 5 ve 11). Kayıt ve kolon sınırı açık yazılır:
// işaret ya da içerik; ikisi birlikte yazılamaz, boş liste yazılamaz (içerik yoksa null). İkisi de
// yoksa satır saklanır ama kayıt ya da kolon vermez (TS-002 değişmez 7).
export const yetenekYazSemasi = z
  .strictObject({
    grupId: z.uuid(),
    rolId: z.uuid(),
    izinId: z.uuid(),
    sart: z.array(sartOgesi).min(1).nullable(),
    butunKayitlar: z.boolean(),
    butunBirimler: z.boolean(),
    kolonlar: z.array(z.string()).min(1).nullable(),
    butunKolonlar: z.boolean(),
  })
  .refine((g) => !(g.butunKayitlar && g.sart !== null), {
    message: 'bütün kayıtlar işareti şartla birlikte yazılamaz',
    path: ['sart'],
  })
  .refine((g) => !(g.butunKolonlar && g.kolonlar !== null), {
    message: 'bütün kolonlar işareti kolon listesiyle birlikte yazılamaz',
    path: ['kolonlar'],
  });

export type YetenekYazGovdesi = z.infer<typeof yetenekYazSemasi>;
