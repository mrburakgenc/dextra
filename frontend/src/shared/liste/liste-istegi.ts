import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../backend/hata';
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
