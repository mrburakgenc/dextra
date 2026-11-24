import 'server-only';
import { createHmac } from 'node:crypto';

// İstemci adresi imzası (TS-002 AK-8; TS-004 Değişmez 3). Backend'den içe aktarılmaz; biçim
// backend'deki tanımla (backend/src/shared/guvenlik/istemci-adresi-imzasi.ts) aynı yazılır:
//   imzalanan metin = adres + "\n" + tarayici + "\n" + zaman
// zaman milisaniye cinsinden ondalık tamsayıdır (Date.now()); metin UTF-8 olarak HMAC-SHA256
// ile imzalanır; imza küçük harfli onaltılık yazılır.

export interface IstemciBilgisi {
  readonly adres: string;
  readonly tarayici: string;
  // Unix zamanı, milisaniye.
  readonly zaman: number;
}

export function imzaBasliklari(
  sir: string,
  bilgi: IstemciBilgisi,
): Record<string, string> {
  const zaman = String(bilgi.zaman);
  const imza = createHmac('sha256', sir)
    .update([bilgi.adres, bilgi.tarayici, zaman].join('\n'), 'utf8')
    .digest('hex');
  return {
    'x-istemci-adresi': bilgi.adres,
    'x-istemci-tarayici': bilgi.tarayici,
    'x-istemci-zaman': zaman,
    'x-istemci-imza': imza,
  };
}
