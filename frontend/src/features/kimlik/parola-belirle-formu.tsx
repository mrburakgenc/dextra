'use client';

import { useActionState } from 'react';
import { Alan } from '../../shared/ui/alan';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { parolaBelirle } from './eylemler';
import { BOS_FORM_DURUMU } from './form-durumu';

// Kod adresten okunur ve formla Server Action'a gider; form verisi tarayıcının kalıcı
// deposuna yazılmaz (KR-014).
export function ParolaBelirleFormu({ kod }: Readonly<{ kod: string }>) {
  const [durum, eylem] = useActionState(parolaBelirle, BOS_FORM_DURUMU);
  return (
    <form action={eylem} className="flex flex-col gap-4">
      {durum.genelHata !== null && (
        <p role="alert" className="font-medium text-red-700">
          {durum.genelHata}
        </p>
      )}
      <input type="hidden" name="kod" value={kod} />
      <Alan
        ad="parola"
        etiket="Yeni parola"
        tur="password"
        otomatikTamamlama="new-password"
        hata={durum.alanHatalari['parola']}
      />
      <Alan
        ad="parolaTekrar"
        etiket="Yeni parola (tekrar)"
        tur="password"
        otomatikTamamlama="new-password"
        hata={durum.alanHatalari['parolaTekrar']}
      />
      <GonderDugmesi>Parolayı belirle</GonderDugmesi>
    </form>
  );
}
