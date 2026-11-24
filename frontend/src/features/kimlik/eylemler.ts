'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { alanHatalari } from '../../shared/backend/hata';
import { backendIstegi } from '../../shared/backend/istek';
import {
  oturumCerezleriniSil,
  oturumCerezleriniYaz,
} from '../../shared/oturum/cerezler';
import type { FormDurumu } from './form-durumu';
import {
  GirisSemasi,
  ParolaBelirleSemasi,
  semaAlanHatalari,
} from './semalar';

// Kimlik ekranlarının Server Action'ları (TS-004 Değişmez 4): girdi önce şemayla doğrulanır,
// sonra backend çağrılır. Başarıda yönlendirilir; redirect fırlattığı için try dışındadır.

const ULASILAMIYOR = 'Şu an ulaşılamıyor';
const GIRIS_HATALI = 'Kullanıcı adı ya da parola hatalı';
const PAROLA_BELIRLENEMEDI =
  'Parola belirlenemedi. Bağlantı geçersiz ya da süresi dolmuş olabilir.';

// Backend'in giriş cevabı; yalnız çerezlere yazılan alanlar okunur.
const GirisCevabi = z.object({
  erisimBelirteci: z.string(),
  yenilemeBelirteci: z.string(),
  cihazSirri: z.string(),
});

function genelHata(ileti: string): FormDurumu {
  return { genelHata: ileti, alanHatalari: {} };
}

export async function girisYap(
  _onceki: FormDurumu,
  form: FormData,
): Promise<FormDurumu> {
  const girdi = GirisSemasi.safeParse({
    kullaniciAdi: form.get('kullaniciAdi'),
    parola: form.get('parola'),
  });
  if (!girdi.success) {
    return { genelHata: null, alanHatalari: semaAlanHatalari(girdi.error) };
  }

  const sonuc = await backendIstegi({
    yol: '/kimlik/oturum/giris',
    yontem: 'POST',
    govde: girdi.data,
    oturumlu: false,
  });
  if (!sonuc.basarili) {
    if (sonuc.hata.kod === 'ulasilamadi') {
      return genelHata(ULASILAMIYOR);
    }
    // Backend her başarısız girişte 401 kimlik_gerekli döner; neden ayırt edilmez.
    if (sonuc.hata.kod === 'kimlik_gerekli') {
      return genelHata(GIRIS_HATALI);
    }
    return genelHata(sonuc.hata.ileti);
  }

  await oturumCerezleriniYaz(GirisCevabi.parse(sonuc.govde));
  redirect('/');
}

// Backend'in cevabı ne olursa olsun çerezler silinir ve giriş ekranına dönülür.
export async function cikisYap(): Promise<void> {
  try {
    await backendIstegi({
      yol: '/kimlik/oturum/cikis',
      yontem: 'POST',
      oturumlu: true,
    });
  } finally {
    await oturumCerezleriniSil();
  }
  redirect('/giris');
}

export async function parolaBelirle(
  _onceki: FormDurumu,
  form: FormData,
): Promise<FormDurumu> {
  const girdi = ParolaBelirleSemasi.safeParse({
    kod: form.get('kod'),
    parola: form.get('parola'),
    parolaTekrar: form.get('parolaTekrar'),
  });
  if (!girdi.success) {
    const alanlar = semaAlanHatalari(girdi.error);
    // Kodun görünen alanı yoktur; hatası formun üstünde gösterilir.
    return { genelHata: alanlar['kod'] ?? null, alanHatalari: alanlar };
  }

  const { kod, parola } = girdi.data;
  const sonuc = await backendIstegi({
    yol: '/kimlik/parola/belirle',
    yontem: 'POST',
    govde: { kod, parola },
    oturumlu: false,
  });
  if (!sonuc.basarili) {
    if (sonuc.hata.kod === 'ulasilamadi') {
      return genelHata(ULASILAMIYOR);
    }
    const parolaHatasi = alanHatalari(sonuc.hata)['parola'];
    if (parolaHatasi !== undefined) {
      return { genelHata: null, alanHatalari: { parola: parolaHatasi } };
    }
    return genelHata(PAROLA_BELIRLENEMEDI);
  }

  redirect('/giris');
}
