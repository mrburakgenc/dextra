'use client';

import { useActionState, useState } from 'react';
import { Alan } from '../../shared/ui/alan';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { BOS_FORM_DURUMU, type FormDurumu } from './form-durumu';

// Rol ve grup işlerinin ortak parçaları (TS-004 "Yönetim ekranları" ve form kuralları): genel hata
// formun üstünde ve ekran okuyucuya duyurularak, alan hatası alanın yanında gösterilir.

export type IsEylemi = (onceki: FormDurumu, form: FormData) => Promise<FormDurumu>;

const IKINCIL_DUGME =
  'rounded border border-gray-500 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export function GenelHata({ ileti }: Readonly<{ ileti: string | null }>) {
  if (ileti === null) {
    return null;
  }
  return (
    <p role="alert" className="font-medium text-red-700">
      {ileti}
    </p>
  );
}

// Kaydın adını değiştiren form; başarıda eylem sayfayı tazeler.
export function AdFormu({ id, eylem }: Readonly<{ id: string; eylem: IsEylemi }>) {
  const [durum, gonder] = useActionState(eylem, BOS_FORM_DURUMU);
  return (
    <form action={gonder} aria-label="Adını değiştir" className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      <input type="hidden" name="id" value={id} />
      <Alan
        ad="ad"
        etiket="Yeni ad"
        tur="text"
        otomatikTamamlama="off"
        hata={durum.alanHatalari['ad']}
      />
      <GonderDugmesi>Adını değiştir</GonderDugmesi>
    </form>
  );
}

// Geri alınamayan silme iki adımlıdır: ilk düğme onay satırını açar, işi onay satırındaki düğme
// yapar.
export function SilmeIsi({
  id,
  eylem,
  soru,
}: Readonly<{ id: string; eylem: IsEylemi; soru: string }>) {
  const [onayAcik, onayAcikYap] = useState(false);
  const [durum, gonder] = useActionState(eylem, BOS_FORM_DURUMU);
  return (
    <div className="flex flex-col gap-2">
      <GenelHata ileti={durum.genelHata} />
      {onayAcik ? (
        <form action={gonder} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={id} />
          <p>{soru}</p>
          <GonderDugmesi>Evet, sil</GonderDugmesi>
          <button
            type="button"
            autoFocus
            onClick={() => {
              onayAcikYap(false);
            }}
            className={IKINCIL_DUGME}
          >
            Vazgeç
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            onayAcikYap(true);
          }}
          className={IKINCIL_DUGME}
        >
          Sil
        </button>
      )}
    </div>
  );
}
