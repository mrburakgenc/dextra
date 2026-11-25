'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { backendIstegi } from '../../../shared/backend/istek';
import {
  BOS_FORM_DURUMU,
  BOS_KULLANICI_IS_DURUMU,
  type FormDurumu,
  gonderilenDegerler,
  type KullaniciIsDurumu,
} from '../form-durumu';
import { isHatasi, KAYIT_BULUNAMADI } from '../is-hatasi';
import {
  KayitKimligi,
  KullaniciKimligi,
  semaAlanHatalari,
  UyelikVerSemasi,
} from '../semalar';

// Üyelik işlerinin Server Action'ları (TS-004 Değişmez 4 ve "Yönetim ekranları"): girdi önce
// şemayla doğrulanır, sonra backend çağrılır. Başarıdan sonra sayfa tazelenir ve güncel üyelikleri
// backend'den yeniden okur.

// Kök gruptaki SuperAdmin rolü verilince cevap parola belirleme kodunu da taşır.
const VerCevabi = z.object({
  id: KayitKimligi,
  parolaBaglantisiKodu: z.string().optional(),
});

// Kod yalnız bu işin durumunda, bellekte taşınır; adrese, çereze ya da depoya yazılmaz. Sitenin
// adresi isteğin Origin başlığından okunur; çatı Server Action'da bu başlığı Host ile karşılaştırır.
export async function uyelikVer(
  _onceki: KullaniciIsDurumu,
  form: FormData,
): Promise<KullaniciIsDurumu> {
  if (!KullaniciKimligi.safeParse(form.get('kullaniciId')).success) {
    return { ...BOS_KULLANICI_IS_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const degerler = gonderilenDegerler(form, ['grupId', 'rolId']);
  const girdi = UyelikVerSemasi.safeParse({
    kullaniciId: form.get('kullaniciId'),
    grupId: form.get('grupId'),
    rolId: form.get('rolId'),
  });
  if (!girdi.success) {
    return {
      ...BOS_KULLANICI_IS_DURUMU,
      alanHatalari: semaAlanHatalari(girdi.error),
      degerler,
    };
  }

  const sonuc = await backendIstegi({
    yol: '/kimlik/uyelik',
    yontem: 'POST',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return { ...(await isHatasi(sonuc.hata)), parolaAdresi: null, degerler };
  }
  const { parolaBaglantisiKodu } = VerCevabi.parse(sonuc.govde);
  refresh();
  if (parolaBaglantisiKodu === undefined) {
    return BOS_KULLANICI_IS_DURUMU;
  }
  const kok = (await headers()).get('origin') ?? '';
  const sorgu = new URLSearchParams({ kod: parolaBaglantisiKodu }).toString();
  return {
    ...BOS_KULLANICI_IS_DURUMU,
    parolaAdresi: `${kok}/parola-belirle?${sorgu}`,
  };
}

export async function uyelikKaldir(
  _onceki: FormDurumu,
  form: FormData,
): Promise<FormDurumu> {
  const id = KayitKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return { ...BOS_FORM_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/uyelik/${id.data}`,
    yontem: 'DELETE',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  refresh();
  return BOS_FORM_DURUMU;
}
