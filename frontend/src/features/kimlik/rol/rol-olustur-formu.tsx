'use client';

import { useActionState } from 'react';
import { Alan } from '../../../shared/ui/alan';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { BOS_FORM_DURUMU } from '../form-durumu';
import { GenelHata } from '../is-parcalari';
import { rolOlustur } from './rol-eylemleri';

// Başarıda Server Action yeni rolün kayıt sayfasına yönlendirir.
export function RolOlusturFormu() {
  const [durum, eylem] = useActionState(rolOlustur, BOS_FORM_DURUMU);
  return (
    <form action={eylem} className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      <Alan
        ad="ad"
        etiket="Ad"
        tur="text"
        otomatikTamamlama="off"
        hata={durum.alanHatalari['ad']}
        varsayilan={durum.degerler?.['ad']}
      />
      <GonderDugmesi>Rolü oluştur</GonderDugmesi>
    </form>
  );
}
