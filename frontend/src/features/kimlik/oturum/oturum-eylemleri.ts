'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { backendIstegi } from '../../../shared/backend/istek';
import { oturumCerezleriniSil } from '../../../shared/oturum/cerezler';
import { BOS_FORM_DURUMU, type FormDurumu } from '../form-durumu';
import { isHatasi, KAYIT_BULUNAMADI } from '../is-hatasi';
import { KayitKimligi } from '../semalar';

// Oturum kapatma (TS-004 "Parola değiştirme ve oturumlar ekranları"): kimlik önce şemayla doğrulanır,
// sonra backend çağrılır. Kapatılan isteği yapan oturumsa backend onu da kapatmıştır: çerezler
// burada silinir, sonra oturum bitti yoluna gidilir. Server Action içindeki iç yönlendirmede hedefi
// sunucu kendisi ister; rota işleyicisinin Set-Cookie başlıkları tarayıcıya ulaşmaz. Değilse sayfa tazelenir ve güncel listeyi backend'den yeniden okur. buOturum
// yalnız bu yönlendirmeyi seçer; kapatma kararını backend verir.
export async function oturumKapat(
  _onceki: FormDurumu,
  form: FormData,
): Promise<FormDurumu> {
  const id = KayitKimligi.safeParse(form.get('id'));
  if (!id.success) {
    return { ...BOS_FORM_DURUMU, genelHata: KAYIT_BULUNAMADI };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/oturum/${id.data}/kapat`,
    yontem: 'POST',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return isHatasi(sonuc.hata);
  }
  if (form.get('buOturum') === 'evet') {
    await oturumCerezleriniSil();
    redirect('/oturum-bitti');
  }
  refresh();
  return BOS_FORM_DURUMU;
}
