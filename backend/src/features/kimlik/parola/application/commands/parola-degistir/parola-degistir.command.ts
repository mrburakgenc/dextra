// Parola değiştir komutu: gövdenin şeması ve ondan türeyen tip, isteği yapan kişi ve oturumla birlikte
// komut tipi (KR-014; TS-002 AK-50). Kişi ve oturum istek bağlamından gelir; gövdede kişi seçen alan
// yoktur ve fazla alan reddedilir. Eski parolaya parola kuralı uygulanmaz (giriş şemasındaki gibi);
// kurala uymayan eski parola doğrulamada yanlış çıkar.
import { z } from 'zod';
import { parolaAlani } from '../../_shared/parola-alani.js';

export const parolaDegistirGovdesiSemasi = z.strictObject({
  eskiParola: z.string().min(1),
  yeniParola: parolaAlani,
});

export type ParolaDegistirGovdesi = z.output<
  typeof parolaDegistirGovdesiSemasi
>;

export type ParolaDegistirKomutu = ParolaDegistirGovdesi & {
  readonly kullaniciId: string;
  readonly oturumId: string;
};
