'use client';

import { useActionState } from 'react';
import { Alan } from '../../shared/ui/alan';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { BOS_KULLANICI_IS_DURUMU } from './form-durumu';
import { kullaniciAc } from './kullanici-eylemleri';
import { ParolaAdresi } from './parola-adresi';

// Başarıda yeni kullanıcının parola belirleme adresi formun üstünde bir kez gösterilir; form
// verisi ve kod tarayıcının kalıcı deposuna yazılmaz (KR-014).
export function KullaniciAcFormu() {
  const [durum, eylem] = useActionState(kullaniciAc, BOS_KULLANICI_IS_DURUMU);
  return (
    <div className="flex flex-col gap-6">
      {durum.parolaAdresi !== null && <ParolaAdresi adres={durum.parolaAdresi} />}
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
          otomatikTamamlama="off"
          hata={durum.alanHatalari['kullaniciAdi']}
          varsayilan={durum.degerler?.['kullaniciAdi']}
        />
        <Alan
          ad="gorunenAd"
          etiket="Görünen ad"
          tur="text"
          otomatikTamamlama="off"
          hata={durum.alanHatalari['gorunenAd']}
          varsayilan={durum.degerler?.['gorunenAd']}
        />
        <GonderDugmesi>Kullanıcıyı aç</GonderDugmesi>
      </form>
    </div>
  );
}
