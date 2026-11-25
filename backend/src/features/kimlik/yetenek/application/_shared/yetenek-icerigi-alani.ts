// Yetenek içeriğinin gövde alanlarının Zod şeması; yaz ve yenile gövdeleri bunu paylaşır (KR-014; KR-008
// Seçim 5 ve 11). Biçimi (tipler, işleç ve yer tutucu adları) Zod denetler, kuralı değer nesneleri
// verir; ret, alanın yoluyla dogrulama_hatasi olur (TS-005 "Komut ve sorgu").
import { z } from 'zod';
import type {
  Islec,
  SartOgesi,
  YerTutucu,
} from '../../../../../shared/kimlik/domain/i-yetki-verisi.contract.js';
import {
  ICERIK_LISTESI_EN_AZ,
  type IcerikListesiReddi,
  icerikListesi,
} from '../../domain/value-objects/icerik-listesi.js';
import {
  type YetenekIcerigi,
  type YetenekIcerigiAlanlari,
  type YetenekIcerigiReddi,
  yetenekIcerigi,
} from '../../domain/value-objects/yetenek-icerigi.js';

// Her ret kodu, kuralın şemada yazıldığı zamanki Zod sorununa çevrilir; böylece cevaptaki alan yolu ve
// neden metni aynı kalır (HTTP sözleşmesi değişmez; TS-005 Seçenekler 4). Eşlemeler ret kodlarının
// tamamını adıyla taşır: değer nesnesine eklenen ve burada eşlenmeyen kod derlenmez. Sorunlar "devam
// eder" işaretlidir: eski uzunluk denetimi ve refine gibi, sonraki denetimlerin koşmasını durdurmaz.
const LISTE_SORUNU: Record<
  IcerikListesiReddi,
  (liste: readonly unknown[]) => z.core.$ZodRawIssue
> = {
  bos: (liste) => ({
    code: 'too_small',
    origin: 'array',
    minimum: ICERIK_LISTESI_EN_AZ,
    inclusive: true,
    input: liste,
    continue: true,
  }),
};

const ICERIK_SORUNU: Record<
  YetenekIcerigiReddi,
  { readonly path: string[]; readonly message: string }
> = {
  butun_kayitlar_ve_sart: {
    path: ['sart'],
    message: 'bütün kayıtlar işareti şartla birlikte yazılamaz',
  },
  butun_kolonlar_ve_kolonlar: {
    path: ['kolonlar'],
    message: 'bütün kolonlar işareti kolon listesiyle birlikte yazılamaz',
  },
};

// Öğeleri verilen şemadan geçen, kuraldan geçmiş (boş olmayan) liste.
function icerikListesiAlani<T extends z.ZodType>(oge: T) {
  return z.array(oge).transform((liste, baglam) => {
    const sonuc = icerikListesi(liste);
    if (sonuc.tur === 'tamam') {
      return sonuc.deger;
    }
    baglam.issues.push(LISTE_SORUNU[sonuc.neden](liste));
    return z.NEVER;
  });
}

// Şartın bir öğesi (TS-002 "Veri modeli"): alan, işleç ve değer. İşleç derleyicinin tanıdıklarından
// biridir; alanın kaynağın alanlarından olduğuna ve değerin işlece uyduğuna yazma kararı, derleyicinin
// sonucuyla bakar.
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
    icerikListesiAlani(sabitDeger),
    z.strictObject({
      yerTutucu: z.enum([
        'isteyen',
        'yetenek_grubu',
        'yetenek_grubu_ve_alti',
      ] satisfies YerTutucu[]),
    }),
  ]),
}) satisfies z.ZodType<SartOgesi>;

// Satırın içerik alanları; gövdenin şeması bunları kendi alanlarıyla birlikte taşır.
export const yetenekIcerigiAlanlari = {
  sart: icerikListesiAlani(sartOgesi).nullable(),
  butunKayitlar: z.boolean(),
  butunBirimler: z.boolean(),
  kolonlar: icerikListesiAlani(z.string()).nullable(),
  butunKolonlar: z.boolean(),
};

// Değer nesnesini çağırır; reddin her nedenini bir sorun olarak ekler.
function icerigiKur(
  ham: YetenekIcerigiAlanlari,
  sorunlar: z.core.$ZodRawIssue[],
): YetenekIcerigi {
  const sonuc = yetenekIcerigi(ham);
  if (sonuc.tur === 'tamam') {
    return sonuc.deger;
  }
  for (const neden of sonuc.neden) {
    sorunlar.push({
      code: 'custom',
      ...ICERIK_SORUNU[neden],
      input: ham,
      continue: true,
    });
  }
  return z.NEVER;
}

// Gövdenin içerik alanlarını değer nesnesine çevirir: çıktıda içerik alanları yerine `icerik` durur.
// Değer nesnesi iki adımda çağrılır. check sorunu, eski refine'ın koştuğu durumda verir (durduran bir
// sorun yokken; başka alanların sürdürülebilir sorunlarıyla, örneğin geçersiz kimlikle birlikte).
// transform ise yalnız hiç sorun yokken koşar ve kuraldan geçmiş içeriği çıktıya koyar.
export function yetenekIcerigiSiniri<T extends YetenekIcerigiAlanlari>(
  sema: z.ZodType<T>,
) {
  return sema
    .check((baglam) => {
      icerigiKur(baglam.value, baglam.issues);
    })
    .transform((govde, baglam) => {
      const {
        sart,
        butunKayitlar,
        butunBirimler,
        kolonlar,
        butunKolonlar,
        ...kalan
      } = govde;
      return {
        ...kalan,
        icerik: icerigiKur(
          { sart, butunKayitlar, butunBirimler, kolonlar, butunKolonlar },
          baglam.issues,
        ),
      };
    });
}
