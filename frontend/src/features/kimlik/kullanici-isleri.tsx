'use client';

import { useActionState, useState } from 'react';
import { Alan } from '../../shared/ui/alan';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { kaydiEtiketle } from '../../shared/yetki/yetki';
import { Can } from '../../shared/yetki/yetki-saglayici';
import { BOS_KULLANICI_IS_DURUMU } from './form-durumu';
import {
  gorunenAdiDegistir,
  parolaKoduUret,
  pasifeAl,
  yenidenAc,
} from './kullanici-eylemleri';
import type { KullaniciKaydi } from './kullanici-kaydi';
import { ParolaAdresi } from './parola-adresi';

// Kayıt sayfasındaki işler (TS-004 "Yönetim ekranları" ve "Yetki kurallarının ekrana
// taşınması"): her iş kayıt düzeyinde, kayıt türüyle etiketlenerek sorulur; görünen ad formu
// ayrıca kolon düzeyinde sorulur. Görünmeyen iş ekranda hiç yer almaz; son sözü backend söyler.
// Kayıt istemcide etiketlenir; etiket sunucudan istemciye geçerken korunmaz.

const IKINCIL_DUGME =
  'rounded border border-gray-500 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

function GenelHata({ ileti }: Readonly<{ ileti: string | null }>) {
  if (ileti === null) {
    return null;
  }
  return (
    <p role="alert" className="font-medium text-red-700">
      {ileti}
    </p>
  );
}

function GorunenAdFormu({ id }: Readonly<{ id: string }>) {
  const [durum, eylem] = useActionState(gorunenAdiDegistir, BOS_KULLANICI_IS_DURUMU);
  return (
    <form action={eylem} aria-label="Görünen adı değiştir" className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      <input type="hidden" name="id" value={id} />
      <Alan
        ad="gorunenAd"
        etiket="Yeni görünen ad"
        tur="text"
        otomatikTamamlama="off"
        hata={durum.alanHatalari['gorunenAd']}
      />
      <GonderDugmesi>Görünen adı değiştir</GonderDugmesi>
    </form>
  );
}

// İki adımlıdır: ilk düğme onay satırını açar, işi onay satırındaki düğme yapar.
function PasifeAlIsi({ id }: Readonly<{ id: string }>) {
  const [onayAcik, onayAcikYap] = useState(false);
  const [durum, eylem] = useActionState(pasifeAl, BOS_KULLANICI_IS_DURUMU);
  return (
    <div className="flex flex-col gap-2">
      <GenelHata ileti={durum.genelHata} />
      {onayAcik ? (
        <form action={eylem} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={id} />
          <p>Kullanıcı pasife alınsın mı?</p>
          <GonderDugmesi>Evet, pasife al</GonderDugmesi>
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
          Pasife al
        </button>
      )}
    </div>
  );
}

function YenidenAcIsi({ id }: Readonly<{ id: string }>) {
  const [durum, eylem] = useActionState(yenidenAc, BOS_KULLANICI_IS_DURUMU);
  return (
    <form action={eylem} className="flex flex-col items-start gap-2">
      <GenelHata ileti={durum.genelHata} />
      <input type="hidden" name="id" value={id} />
      <GonderDugmesi>Yeniden aç</GonderDugmesi>
    </form>
  );
}

function KodUretIsi({ id }: Readonly<{ id: string }>) {
  const [durum, eylem] = useActionState(parolaKoduUret, BOS_KULLANICI_IS_DURUMU);
  return (
    <form action={eylem} className="flex flex-col items-start gap-2">
      <GenelHata ileti={durum.genelHata} />
      {durum.parolaAdresi !== null && <ParolaAdresi adres={durum.parolaAdresi} />}
      <input type="hidden" name="id" value={id} />
      <GonderDugmesi>Parola belirleme kodu üret</GonderDugmesi>
    </form>
  );
}

// Durumu görünmeyen kayıtta (pasifZamani gelmedi) ne pasife al ne yeniden aç gösterilir.
export function KullaniciIsleri({ kayit }: Readonly<{ kayit: KullaniciKaydi }>) {
  const etiketli = kaydiEtiketle('Kullanici', kayit);
  return (
    <div className="flex flex-col gap-6">
      <Can I="guncelle" this={etiketli} field="gorunenAd">
        <GorunenAdFormu id={kayit.id} />
      </Can>
      {kayit.pasifZamani === null && (
        <Can I="pasife_al" this={etiketli}>
          <PasifeAlIsi id={kayit.id} />
        </Can>
      )}
      {typeof kayit.pasifZamani === 'string' && (
        <Can I="yeniden_ac" this={etiketli}>
          <YenidenAcIsi id={kayit.id} />
        </Can>
      )}
      <Can I="parola_baglantisi_uret" this={etiketli}>
        <KodUretIsi id={kayit.id} />
      </Can>
    </div>
  );
}
