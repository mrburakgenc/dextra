import 'server-only';
import { z } from 'zod';
import { type BackendHatasi, kimlikGerekliyseOturumuBitir } from '../backend/hata';
import { backendIstegi } from '../backend/istek';
import { type SorguAlanlari, sorguMetni } from './sorgu';

// Backend'in liste uçları (TS-002 AK-39) { kayitlar, sayfa, boyut, sonrakiVar } döner; kayıt
// biçimi kaynağın kendi dosyasında yazılır (KR-014). Toplam sayı yoktur.

export interface Liste<K> {
  readonly kayitlar: readonly K[];
  readonly sayfa: number;
  readonly sonrakiVar: boolean;
}

export type ListeSonucu<K> =
  | { readonly basarili: true; readonly liste: Liste<K> }
  | { readonly basarili: false; readonly hata: BackendHatasi };

// yol: kaynağın ucu ('/kimlik/rol' gibi); sorgu adres sorgusuna verilen sırayla eklenir.
export async function listeyiGetir<K>(
  yol: string,
  sorgu: SorguAlanlari,
  kayit: z.ZodType<K>,
): Promise<ListeSonucu<K>> {
  const sonuc = await backendIstegi({
    yol: `${yol}${sorguMetni(sorgu)}`,
    yontem: 'GET',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return sonuc;
  }
  const cevap = z.object({
    kayitlar: z.array(kayit),
    sayfa: z.number(),
    sonrakiVar: z.boolean(),
  });
  return { basarili: true, liste: cevap.parse(sonuc.govde) };
}

// Adları gösteren yardımcı liste (TS-004 "Yönetim formlarının sertleştirilmesi"): alınamazsa (yetki
// yok ya da ulaşılamadı) sayfa ayakta kalır ve null döner; 401 oturum bitti yoluna yönlendirir
// (fırlatır). Sunucu bileşeninde çağrılır.
export function yardimciListe<K>(sonuc: ListeSonucu<K>): Liste<K> | null {
  if (sonuc.basarili) {
    return sonuc.liste;
  }
  kimlikGerekliyseOturumuBitir(sonuc.hata);
  return null;
}
