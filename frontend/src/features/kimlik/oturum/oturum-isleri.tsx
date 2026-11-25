'use client';

import { useActionState, useState } from 'react';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { kaydiEtiketle } from '../../../shared/yetki/yetki';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { BOS_FORM_DURUMU } from '../form-durumu';
import { GenelHata } from '../is-parcalari';
import { oturumKapat } from './oturum-eylemleri';
import type { OturumKaydi } from './oturum-listesi';

// Oturum kapatma (TS-004 "Parola değiştirme ve oturumlar ekranları" ve "Yetki kurallarının ekrana
// taşınması"): kayıt düzeyinde, kayıt türüyle etiketlenerek sorulur; görünmeyen iş ekranda hiç yer
// almaz, son sözü backend söyler. Kayıt istemcide etiketlenir; etiket sunucudan istemciye geçerken
// korunmaz.

const IKINCIL_DUGME =
  'rounded border border-gray-500 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

// Geri alınamayan kapatma iki adımlıdır: ilk düğme onay satırını açar, işi onay satırındaki düğme
// yapar. Düğmeler satır başına yinelendiği için erişilebilir adları oturumu adlandırır; görünen yazı
// kısa kalır ve adın başında geçer (WCAG 2.5.3). oturum: '<başlangıç> başlayan …<kimliğin son 8
// karakteri> oturumu'.
function KapatIsi({
  id,
  bu,
  oturum,
}: Readonly<{ id: string; bu: boolean; oturum: string }>) {
  const [onayAcik, onayAcikYap] = useState(false);
  const [durum, gonder] = useActionState(oturumKapat, BOS_FORM_DURUMU);
  return (
    <div className="flex flex-col gap-2">
      <GenelHata ileti={durum.genelHata} />
      {onayAcik ? (
        <form action={gonder} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={id} />
          {bu && <input type="hidden" name="buOturum" value="evet" />}
          <p>{bu ? 'Bu oturum kapatılsın mı? Oturumun biter.' : 'Oturum kapatılsın mı?'}</p>
          <GonderDugmesi erisilebilirAd={`Evet, kapat: ${oturum}`}>Evet, kapat</GonderDugmesi>
          <button
            type="button"
            autoFocus
            aria-label={`Vazgeç: ${oturum} açık kalsın`}
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
          aria-label={`Kapat: ${oturum}`}
          onClick={() => {
            onayAcikYap(true);
          }}
          className={IKINCIL_DUGME}
        >
          Kapat
        </button>
      )}
    </div>
  );
}

// bu: kayıt isteği yapan oturumdur; oturum: satırın erişilebilir adı.
export function OturumKapat({
  kayit,
  bu,
  oturum,
}: Readonly<{ kayit: OturumKaydi; bu: boolean; oturum: string }>) {
  return (
    <Can I="kapat" this={kaydiEtiketle('Oturum', kayit)}>
      <KapatIsi id={kayit.id} bu={bu} oturum={oturum} />
    </Can>
  );
}
