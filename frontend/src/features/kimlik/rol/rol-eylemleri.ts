'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { backendIstegi } from '../../../shared/backend/istek';
import { BOS_FORM_DURUMU, type FormDurumu } from '../form-durumu';
import { isHatasi, KAYIT_BULUNAMADI } from '../is-hatasi';
import { AdSemasi, KayitKimligi, semaAlanHatalari } from '../semalar';

// Rol işlerinin Server Action'ları (TS-004 Değişmez 4 ve "Yönetim ekranları"): girdi önce
// şemayla doğrulanır, sonra backend çağrılır. Oluşturma kayıt sayfasına, silme listeye gider; ad
// değişince sayfa tazelenir ve güncel kaydı backend'den yeniden okur.

const IdCevabi = z.object({ id: KayitKimligi });

export async function rolOlustur(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const girdi = AdSemasi.safeParse({ ad: form.get('ad') });
  if (!girdi.success) {
    return { ...BOS_FORM_DURUMU, alanHatalari: semaAlanHatalari(girdi.error) };
  }
  const sonuc = await backendIstegi({
    yol: '/kimlik/rol',
    yontem: 'POST',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  const { id } = IdCevabi.parse(sonuc.govde);
  redirect(`/roller/${id}`);
}

export async function rolAdiniDegistir(
  _onceki: FormDurumu,
  form: FormData,
): Promise<FormDurumu> {
  const id = KayitKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return { ...BOS_FORM_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const girdi = AdSemasi.safeParse({ ad: form.get('ad') });
  if (!girdi.success) {
    return { ...BOS_FORM_DURUMU, alanHatalari: semaAlanHatalari(girdi.error) };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/rol/${id.data}`,
    yontem: 'PATCH',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  refresh();
  return BOS_FORM_DURUMU;
}

// Dolu rol ve sistem rolü backend'de 409 olur; iletisi ekranda gösterilir.
export async function rolSil(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const id = KayitKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return { ...BOS_FORM_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/rol/${id.data}`,
    yontem: 'DELETE',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  redirect('/roller');
}
