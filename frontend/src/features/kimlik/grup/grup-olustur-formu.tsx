'use client';

import { useActionState } from 'react';
import { Alan } from '../../../shared/ui/alan';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { BOS_FORM_DURUMU } from '../form-durumu';
import { GenelHata } from '../is-parcalari';
import { grupOlustur } from './grup-eylemleri';
import type { UstGrupSecenekleri } from './grup-listesi';
import { UstGrupAlani } from './ust-grup-alani';

// ustGrupId: adresten gelen üst grup; seçimde ön seçili gelir. Başarıda Server Action yeni grubun
// kayıt sayfasına yönlendirir.
export function GrupOlusturFormu({
  secenekler,
  ustGrupId,
}: Readonly<{ secenekler: UstGrupSecenekleri; ustGrupId: string | undefined }>) {
  const [durum, eylem] = useActionState(grupOlustur, BOS_FORM_DURUMU);
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
      <UstGrupAlani
        etiket="Üst grup"
        secenekler={secenekler}
        varsayilan={durum.degerler?.['ustGrupId'] ?? ustGrupId}
        hata={durum.alanHatalari['ustGrupId']}
      />
      <GonderDugmesi>Grubu oluştur</GonderDugmesi>
    </form>
  );
}
