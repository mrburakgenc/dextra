// Kullanıcı aç komutu: POST kimlik/kullanici gövdesinin şeması ve ondan türeyen komut tipi (KR-014;
// TS-002 AK-39). Kullanıcı adının ve görünen adın kuralını değer nesneleri verir. Telefon kabul
// edilmez (yazım kanonu kararlaştırılmadı); sistem aktörü ve öbür alanlar şemada olmadığı için
// reddedilir.
import { z } from 'zod';
import { gorunenAdAlani } from '../../_shared/gorunen-ad-alani.js';
import { kullaniciAdiAlani } from '../../_shared/kullanici-adi-alani.js';

export const kullaniciAcKomutuSemasi = z.strictObject({
  kullaniciAdi: kullaniciAdiAlani,
  gorunenAd: gorunenAdAlani,
});

export type KullaniciAcKomutu = z.output<typeof kullaniciAcKomutuSemasi>;
