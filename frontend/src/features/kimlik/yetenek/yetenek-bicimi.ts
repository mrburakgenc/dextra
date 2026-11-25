import { BOS } from '../../../shared/liste/liste-parcalari';
import type { Secenekler } from '../uyelik/uyelik-listesi';
import type { SartOgesi } from './yetenek-sarti';

// Yeteneğin liste ve kayıt sayfasındaki yazımı (TS-004 "Yönetim ekranları"). Kayıtta gelmeyen kolon
// undefined'dır; sonucu bilinemeyen hücre boş işarettir.

// Kimlikten ada; liste alınamadıysa null (ad bilinmez). Ad kolonu gelmeyen kayıt (seçimde boş
// işaretli) haritaya girmez: adı bilinmez, kimliginAdi onu kısaltır (TS-004 "Yönetim formlarının
// sertleştirilmesi").
export function adHaritasi(secenekler: Secenekler | null): ReadonlyMap<string, string> | null {
  if (secenekler === null) {
    return null;
  }
  return new Map(
    secenekler.kayitlar
      .filter((secenek) => secenek.etiket !== BOS)
      .map((secenek) => [secenek.id, secenek.etiket]),
  );
}

// Kısa yazım: 'alan islec deger'; yer tutucu süslü ayraçla, dizi köşeli ayraçla ve virgülle yazılır;
// öğeler ' ve ' ile birleşir.
export function sartYazimi(sart: readonly SartOgesi[]): string {
  return sart
    .map(({ alan, islec, deger }) => {
      let yazim: string;
      if (Array.isArray(deger)) {
        yazim = `[${deger.map(String).join(', ')}]`;
      } else if (typeof deger === 'object') {
        yazim = `{${deger.yerTutucu}}`;
      } else {
        yazim = String(deger);
      }
      return `${alan} ${islec} ${yazim}`;
    })
    .join(' ve ');
}

export function kayitSiniri(
  butunKayitlar: boolean | undefined,
  sart: readonly SartOgesi[] | null | undefined,
): string {
  if (butunKayitlar === true) {
    return 'Bütün kayıtlar';
  }
  if (sart !== undefined && sart !== null && sart.length > 0) {
    return sartYazimi(sart);
  }
  if (butunKayitlar === undefined || sart === undefined) {
    return BOS;
  }
  return 'Kayıt vermez';
}

export function kolonSiniri(
  butunKolonlar: boolean | undefined,
  kolonlar: readonly string[] | undefined,
): string {
  if (butunKolonlar === true) {
    return 'Bütün kolonlar';
  }
  if (kolonlar !== undefined && kolonlar.length > 0) {
    return kolonlar.join(', ');
  }
  if (butunKolonlar === undefined || kolonlar === undefined) {
    return BOS;
  }
  return 'Kolon vermez';
}

// 'Sistem', 'Tohum' ya da boş metin; iki kolondan biri gelmediği için tür bilinemiyorsa boş işaret.
export function yetenekTuru(
  sistemSatiri: boolean | undefined,
  tohumAnahtari: string | null | undefined,
): string {
  if (sistemSatiri === true) {
    return 'Sistem';
  }
  if (typeof tohumAnahtari === 'string') {
    return 'Tohum';
  }
  if (sistemSatiri === undefined || tohumAnahtari === undefined) {
    return BOS;
  }
  return '';
}
