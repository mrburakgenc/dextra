'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import type { BackendHatasi } from '../../shared/backend/hata';
import { backendIstegi } from '../../shared/backend/istek';
import { gonderilenDegerler, type KullaniciIsDurumu } from './form-durumu';
import { isHatasi as ortakIsHatasi, KAYIT_BULUNAMADI } from './is-hatasi';
import {
  GorunenAdSemasi,
  KullaniciAcSemasi,
  KullaniciKimligi,
  semaAlanHatalari,
} from './semalar';

// Kullanıcı işlerinin Server Action'ları (TS-004 Değişmez 4 ve "Yönetim ekranları"): girdi önce
// şemayla doğrulanır, sonra backend çağrılır. Kaydı değiştiren iş başarıdan sonra sayfayı
// tazeler; sayfa güncel kaydı backend'den yeniden okur.

const BASARILI: KullaniciIsDurumu = {
  genelHata: null,
  alanHatalari: {},
  parolaAdresi: null,
};

// Backend'in kod döndüren cevapları (POST kimlik/kullanici ve .../parola-baglantisi).
const KodCevabi = z.object({ parolaBaglantisiKodu: z.string() });

function genelHata(ileti: string): KullaniciIsDurumu {
  return { ...BASARILI, genelHata: ileti };
}

// Hatanın ekran iletisi tek yerdedir (is-hatasi.ts); kullanıcı işinin durumunda adres yoktur.
async function isHatasi(hata: BackendHatasi): Promise<KullaniciIsDurumu> {
  return { ...(await ortakIsHatasi(hata)), parolaAdresi: null };
}

// Parola belirleme ekranının tam adresi. Sitenin adresi isteğin Origin başlığından okunur; çatı
// Server Action'da bu başlığı Host ile karşılaştırır.
async function parolaAdresi(govde: unknown): Promise<KullaniciIsDurumu> {
  const { parolaBaglantisiKodu } = KodCevabi.parse(govde);
  const kok = (await headers()).get('origin') ?? '';
  const sorgu = new URLSearchParams({ kod: parolaBaglantisiKodu }).toString();
  return { ...BASARILI, parolaAdresi: `${kok}/parola-belirle?${sorgu}` };
}

export async function kullaniciAc(
  _onceki: KullaniciIsDurumu,
  form: FormData,
): Promise<KullaniciIsDurumu> {
  const degerler = gonderilenDegerler(form, ['kullaniciAdi', 'gorunenAd']);
  const girdi = KullaniciAcSemasi.safeParse({
    kullaniciAdi: form.get('kullaniciAdi'),
    gorunenAd: form.get('gorunenAd'),
  });
  if (!girdi.success) {
    return { ...BASARILI, alanHatalari: semaAlanHatalari(girdi.error), degerler };
  }

  const sonuc = await backendIstegi({
    yol: '/kimlik/kullanici',
    yontem: 'POST',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    // Aynı kullanıcı adı: ileti kullanıcı adı alanının yanında gösterilir.
    if (sonuc.hata.kod === 'cakisma') {
      return { ...BASARILI, alanHatalari: { kullaniciAdi: sonuc.hata.ileti }, degerler };
    }
    return { ...(await isHatasi(sonuc.hata)), degerler };
  }
  return parolaAdresi(sonuc.govde);
}

export async function gorunenAdiDegistir(
  _onceki: KullaniciIsDurumu,
  form: FormData,
): Promise<KullaniciIsDurumu> {
  const id = KullaniciKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return genelHata(KAYIT_BULUNAMADI);
  }
  const girdi = GorunenAdSemasi.safeParse({ gorunenAd: form.get('gorunenAd') });
  if (!girdi.success) {
    return { ...BASARILI, alanHatalari: semaAlanHatalari(girdi.error) };
  }

  const sonuc = await backendIstegi({
    yol: `/kimlik/kullanici/${id.data}`,
    yontem: 'PATCH',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  refresh();
  return BASARILI;
}

// Gövdesiz kayıt işi: POST kimlik/kullanici/:id/<is>.
async function kayitIsi(
  form: FormData,
  is: 'pasife-al' | 'yeniden-ac' | 'parola-baglantisi',
) {
  const id = KullaniciKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return null;
  }
  return backendIstegi({
    yol: `/kimlik/kullanici/${id.data}/${is}`,
    yontem: 'POST',
    oturumlu: true,
  });
}

async function durumuDegistir(
  form: FormData,
  is: 'pasife-al' | 'yeniden-ac',
): Promise<KullaniciIsDurumu> {
  const sonuc = await kayitIsi(form, is);
  if (sonuc === null) {
    return genelHata(KAYIT_BULUNAMADI);
  }
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  refresh();
  return BASARILI;
}

export async function pasifeAl(
  _onceki: KullaniciIsDurumu,
  form: FormData,
): Promise<KullaniciIsDurumu> {
  return durumuDegistir(form, 'pasife-al');
}

export async function yenidenAc(
  _onceki: KullaniciIsDurumu,
  form: FormData,
): Promise<KullaniciIsDurumu> {
  return durumuDegistir(form, 'yeniden-ac');
}

// Kayıt değişmediği için sayfa tazelenmez; kod yalnız bu işin cevabında bir kez gösterilir.
export async function parolaKoduUret(
  _onceki: KullaniciIsDurumu,
  form: FormData,
): Promise<KullaniciIsDurumu> {
  const sonuc = await kayitIsi(form, 'parola-baglantisi');
  if (sonuc === null) {
    return genelHata(KAYIT_BULUNAMADI);
  }
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  return parolaAdresi(sonuc.govde);
}
