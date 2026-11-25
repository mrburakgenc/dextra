// Yenileme komutu: gövdenin şeması ve ondan türeyen tip (TS-002 AK-49 madde 1; KR-014), imzası
// doğrulanmış istemci başlıklarından gelen adres ve tarayıcı bilgisiyle birlikte komut tipi.
import { z } from 'zod';

export const yenileGovdesiSemasi = z.strictObject({
  yenilemeBelirteci: z.string().min(1),
  cihazSirri: z.string().min(1),
});

export type YenileGovdesi = z.output<typeof yenileGovdesiSemasi>;

export type YenileKomutu = YenileGovdesi & {
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
};
