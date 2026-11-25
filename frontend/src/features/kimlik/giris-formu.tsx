'use client';

import { useActionState } from 'react';
import { Alan } from '../../shared/ui/alan';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { girisYap } from './eylemler';
import { BOS_FORM_DURUMU } from './form-durumu';

// Form verisi yalnız Server Action'a gider; tarayıcının kalıcı deposuna yazılmaz (KR-014).
export function GirisFormu() {
  const [durum, eylem] = useActionState(girisYap, BOS_FORM_DURUMU);
  return (
    <form action={eylem} className="flex flex-col gap-4">
      {durum.genelHata !== null && (
        <p role="alert" className="font-medium text-red-700">
          {durum.genelHata}
        </p>
      )}
      <Alan
        ad="kullaniciAdi"
        etiket="Kullanıcı adı"
        tur="text"
        otomatikTamamlama="username"
        hata={durum.alanHatalari['kullaniciAdi']}
      />
      <Alan
        ad="parola"
        etiket="Parola"
        tur="password"
        otomatikTamamlama="current-password"
        hata={durum.alanHatalari['parola']}
      />
      <GonderDugmesi>Giriş yap</GonderDugmesi>
    </form>
  );
}
