'use client';

import { useActionState } from 'react';
import { Alan } from '../../shared/ui/alan';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { parolaDegistir } from './eylemler';
import { BOS_FORM_DURUMU } from './form-durumu';
import { GenelHata } from './is-parcalari';

// Parolamı değiştir (TS-004 "Parola değiştirme ve oturumlar ekranları"): üç alan da parola
// girdisidir ve varsayılan değer taşımaz; çatı işi biten formu sıfırladığı için hata durumunda
// alanlar boş açılır. Form verisi tarayıcının kalıcı deposuna yazılmaz (KR-014).
export function ParolaDegistirFormu() {
  const [durum, eylem] = useActionState(parolaDegistir, BOS_FORM_DURUMU);
  return (
    <form action={eylem} aria-label="Parolamı değiştir" className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      <Alan
        ad="eskiParola"
        etiket="Eski parola"
        tur="password"
        otomatikTamamlama="current-password"
        hata={durum.alanHatalari['eskiParola']}
      />
      <Alan
        ad="yeniParola"
        etiket="Yeni parola"
        tur="password"
        otomatikTamamlama="new-password"
        hata={durum.alanHatalari['yeniParola']}
      />
      <Alan
        ad="yeniParolaTekrar"
        etiket="Yeni parola (tekrar)"
        tur="password"
        otomatikTamamlama="new-password"
        hata={durum.alanHatalari['yeniParolaTekrar']}
      />
      <GonderDugmesi>Parolamı değiştir</GonderDugmesi>
    </form>
  );
}
