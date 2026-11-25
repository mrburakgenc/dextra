import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../../../shared/backend/hata';
import { type Liste, type ListeSonucu, listeyiGetir } from '../../../shared/liste/liste-istegi';
import { BOS } from '../../../shared/liste/liste-parcalari';
import { sayfaSemasi, siralamaSemasi } from '../../../shared/liste/sorgu';
import type { Secenekler } from '../uyelik/uyelik-listesi';
import { ISLECLER, YER_TUTUCULAR } from './yetenek-sarti';

// Yetenek listesi ve kaydı (TS-004 "Yönetim ekranları"): backend'in GET kimlik/yetenek sözleşmesi ön
// yüzde ayrı yazılır (KR-014). Grup ve rol süzgeci adresin sorgusundadır; geçersiz sorgu değeri
// varsayılana döner ve backend'e gitmez.

export const YetenekListesiSorgusu = z.object({
  sayfa: sayfaSemasi,
  sirala: siralamaSemasi(['olusturmaZamani']),
  grupId: z.uuid().optional().catch(undefined),
  rolId: z.uuid().optional().catch(undefined),
});
export type YetenekListesiSorgusu = z.infer<typeof YetenekListesiSorgusu>;

const SabitDeger = z.union([z.string(), z.number(), z.boolean()]);

export const SartOgesi = z.object({
  alan: z.string(),
  islec: z.enum(ISLECLER),
  deger: z.union([
    SabitDeger,
    z.array(SabitDeger),
    z.object({ yerTutucu: z.enum(YER_TUTUCULAR) }),
  ]),
});

// Kişinin göremediği kolon gelmez (undefined). Ekranda kullanılmayan kolonlar okunmaz.
export const YetenekKaydi = z.object({
  id: z.string(),
  grupId: z.string().optional(),
  rolId: z.string().optional(),
  izinId: z.string().optional(),
  sart: z.array(SartOgesi).nullable().optional(),
  butunKayitlar: z.boolean().optional(),
  butunBirimler: z.boolean().optional(),
  kolonlar: z.array(z.string()).optional(),
  butunKolonlar: z.boolean().optional(),
  sistemSatiri: z.boolean().optional(),
  tohumAnahtari: z.string().nullable().optional(),
  olusturmaZamani: z.string().optional(),
});
export type YetenekKaydi = z.infer<typeof YetenekKaydi>;

export function yetenekleriListele(
  sorgu: YetenekListesiSorgusu,
): Promise<ListeSonucu<YetenekKaydi>> {
  return listeyiGetir('/kimlik/yetenek', sorgu, YetenekKaydi);
}

// Grup, rol ve izin adları (seçimler dahil) GET kimlik/grup, kimlik/rol ve kimlik/izin listelerinin
// ilk 100 kaydından okunur; 100 backend'in sayfa boyutu sınırıdır. Adı gelmeyen kayıt boş işaretle
// görünür; izin 'Kaynak:eylem' biçiminde yazılır.
const ILK_100 = { sayfa: 1, boyut: 100 } as const;

const AdliKayit = z.object({ id: z.string(), ad: z.string().optional() });
const IzinKaydi = z.object({
  id: z.string(),
  kaynak: z.string().optional(),
  eylem: z.string().optional(),
});

export interface YetenekSecenekleri {
  readonly gruplar: Secenekler;
  readonly roller: Secenekler;
  readonly izinler: Secenekler;
}

export type YetenekSecenekleriSonucu =
  | { readonly basarili: true; readonly secenekler: YetenekSecenekleri }
  | { readonly basarili: false; readonly hata: BackendHatasi };

function seceneklereCevir<K extends { id: string }>(
  liste: Liste<K>,
  etiket: (kayit: K) => string | undefined,
): Secenekler {
  return {
    kayitlar: liste.kayitlar.map((kayit) => ({ id: kayit.id, etiket: etiket(kayit) ?? BOS })),
    dahaFazlasiVar: liste.sonrakiVar,
  };
}

// Üç liste birlikte istenir; biri alınamazsa ilk hatası döner.
export async function yetenekSecenekleri(): Promise<YetenekSecenekleriSonucu> {
  const [gruplar, roller, izinler] = await Promise.all([
    listeyiGetir('/kimlik/grup', ILK_100, AdliKayit),
    listeyiGetir('/kimlik/rol', ILK_100, AdliKayit),
    listeyiGetir('/kimlik/izin', ILK_100, IzinKaydi),
  ]);
  if (!gruplar.basarili) {
    return gruplar;
  }
  if (!roller.basarili) {
    return roller;
  }
  if (!izinler.basarili) {
    return izinler;
  }
  return {
    basarili: true,
    secenekler: {
      gruplar: seceneklereCevir(gruplar.liste, (grup) => grup.ad),
      roller: seceneklereCevir(roller.liste, (rol) => rol.ad),
      izinler: seceneklereCevir(izinler.liste, ({ kaynak, eylem }) =>
        kaynak === undefined || eylem === undefined ? undefined : `${kaynak}:${eylem}`,
      ),
    },
  };
}
