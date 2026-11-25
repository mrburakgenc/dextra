import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../../../shared/backend/hata';
import { type Liste, listeyiGetir, yardimciListe } from '../../../shared/liste/liste-istegi';
import { BOS } from '../../../shared/liste/liste-parcalari';

// Kullanıcının üyelikleri (TS-004 "Yönetim ekranları"): backend'in GET kimlik/uyelik sözleşmesi ön
// yüzde ayrı yazılır (KR-014). Grup ve rol adları, seçimlerle birlikte, GET kimlik/grup ve GET
// kimlik/rol listelerinin ilk 100 kaydından okunur; 100 backend'in sayfa boyutu sınırıdır.

// Kişinin göremediği kolon gelmez (undefined).
const UyelikKaydi = z.object({
  id: z.string(),
  kullaniciId: z.string().optional(),
  grupId: z.string().optional(),
  rolId: z.string().optional(),
  olusturmaZamani: z.string().optional(),
});
export type UyelikKaydi = z.infer<typeof UyelikKaydi>;

// Grup ve rol kaydının seçim ve ad için okunan kısmı.
const AdliKayit = z.object({ id: z.string(), ad: z.string().optional() });

const ILK_100 = { sayfa: 1, boyut: 100 } as const;

export interface Secenekler {
  readonly kayitlar: readonly { readonly id: string; readonly etiket: string }[];
  readonly dahaFazlasiVar: boolean;
}

// Grup ya da rol listesi alınamadıysa (yetki yok ya da ulaşılamadı) yeri null'dır (TS-004 "Yönetim
// formlarının sertleştirilmesi").
export interface Uyelikler {
  readonly liste: Liste<UyelikKaydi>;
  readonly gruplar: Secenekler | null;
  readonly roller: Secenekler | null;
}

type Sonuc<K extends string, V> =
  | ({ readonly basarili: true } & Readonly<Record<K, V>>)
  | { readonly basarili: false; readonly hata: BackendHatasi };

// Adı gelmeyen kayıt boş işaretle görünür; liste alınamazsa null döner, 401 oturum bitti yoluna
// gider.
async function secenekler(yol: '/kimlik/grup' | '/kimlik/rol'): Promise<Secenekler | null> {
  const liste = yardimciListe(await listeyiGetir(yol, ILK_100, AdliKayit));
  if (liste === null) {
    return null;
  }
  return {
    kayitlar: liste.kayitlar.map((kayit) => ({
      id: kayit.id,
      etiket: kayit.ad ?? BOS,
    })),
    dahaFazlasiVar: liste.sonrakiVar,
  };
}

// Üç liste birlikte istenir; üyelik listesi alınamazsa hatası döner.
export async function uyelikleriGetir(
  kullaniciId: string,
): Promise<Sonuc<'uyelikler', Uyelikler>> {
  const [uyelikler, gruplar, roller] = await Promise.all([
    listeyiGetir('/kimlik/uyelik', { kullaniciId, ...ILK_100 }, UyelikKaydi),
    secenekler('/kimlik/grup'),
    secenekler('/kimlik/rol'),
  ]);
  if (!uyelikler.basarili) {
    return uyelikler;
  }
  return {
    basarili: true,
    uyelikler: { liste: uyelikler.liste, gruplar, roller },
  };
}
