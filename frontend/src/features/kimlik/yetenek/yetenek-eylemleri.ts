'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { backendIstegi } from '../../../shared/backend/istek';
import { BOS_FORM_DURUMU, type FormDurumu, gonderilenDegerler } from '../form-durumu';
import { isHatasi, KAYIT_BULUNAMADI } from '../is-hatasi';
import {
  KayitKimligi,
  semaAlanHatalari,
  YetenekYazSemasi,
  YetenekYenileSemasi,
} from '../semalar';

// Yetenek işlerinin Server Action'ları (TS-004 Değişmez 4 ve "Yönetim ekranları"): girdi önce
// şemayla doğrulanır, sonra backend çağrılır. Yazma ve yenileme yeni satırın kayıt sayfasına, silme
// listeye gider.

const IdCevabi = z.object({ id: KayitKimligi });

// Formun içerik alanları: şart satırlarının dört alanı aynı sırayla tekrar eder; kutular
// işaretliyken formda bulunur. Saklanan kolon listesi varsa kolon metninin yerine o gider.
function icerikGirdisi(form: FormData) {
  const islecler = form.getAll('sartIslec');
  const turler = form.getAll('sartTur');
  const degerler = form.getAll('sartDeger');
  return {
    sart: form.getAll('sartAlan').map((alan, sira) => ({
      alan,
      islec: islecler[sira],
      tur: turler[sira],
      deger: degerler[sira],
    })),
    butunKayitlar: form.has('butunKayitlar'),
    butunBirimler: form.has('butunBirimler'),
    kolonlar: form.has('sakliKolon') ? form.getAll('sakliKolon') : form.get('kolonlar'),
    butunKolonlar: form.has('butunKolonlar'),
  };
}

// Silinmiş grup ya da rol, katalogda olmayan izin ve izin veren kümenin kısıtına takılan yazma
// backend'de 409 olur; iletisi ekranda gösterilir.
// İçerik alanları denetimli olduğu için formda kalır; döndürülen değerler grup, rol ve izin
// seçimleridir.
export async function yetenekYaz(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const degerler = gonderilenDegerler(form, ['grupId', 'rolId', 'izinId']);
  const girdi = YetenekYazSemasi.safeParse({
    grupId: form.get('grupId'),
    rolId: form.get('rolId'),
    izinId: form.get('izinId'),
    ...icerikGirdisi(form),
  });
  if (!girdi.success) {
    return { ...BOS_FORM_DURUMU, alanHatalari: semaAlanHatalari(girdi.error), degerler };
  }
  const sonuc = await backendIstegi({
    yol: '/kimlik/yetenek',
    yontem: 'POST',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return { ...(await isHatasi(sonuc.hata)), degerler };
  }
  const { id } = IdCevabi.parse(sonuc.govde);
  redirect(`/yetenekler/${id}`);
}

// Yenileme eski satırı kapatıp yeni satır açar; sistem ve tohum satırı backend'de 409 olur.
export async function yetenekYenile(
  _onceki: FormDurumu,
  form: FormData,
): Promise<FormDurumu> {
  const id = KayitKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return { ...BOS_FORM_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const girdi = YetenekYenileSemasi.safeParse(icerikGirdisi(form));
  if (!girdi.success) {
    return { ...BOS_FORM_DURUMU, alanHatalari: semaAlanHatalari(girdi.error) };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/yetenek/${id.data}/yenile`,
    yontem: 'POST',
    govde: girdi.data,
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  const yeni = IdCevabi.parse(sonuc.govde);
  redirect(`/yetenekler/${yeni.id}`);
}

// Sistem satırı backend'de 409 olur; iletisi ekranda gösterilir.
export async function yetenekSil(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const id = KayitKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return { ...BOS_FORM_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/yetenek/${id.data}`,
    yontem: 'DELETE',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  redirect('/yetenekler');
}
