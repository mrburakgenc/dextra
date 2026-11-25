'use client';

import { useActionState, useState } from 'react';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { kaydiEtiketle } from '../../../shared/yetki/yetki';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { BOS_FORM_DURUMU, BOS_KULLANICI_IS_DURUMU } from '../form-durumu';
import { GenelHata } from '../is-parcalari';
import { ParolaAdresi } from '../parola-adresi';
import { uyelikKaldir, uyelikVer } from './uyelik-eylemleri';
import type { Secenekler, UyelikKaydi } from './uyelik-listesi';

// Üyelik işleri (TS-004 "Yönetim ekranları" ve "Yetki kurallarının ekrana taşınması"): kaldır kayıt
// düzeyinde, kayıt türüyle etiketlenerek sorulur; ver formu tür düzeyinde sayfada sorulur.
// Görünmeyen iş ekranda hiç yer almaz; son sözü backend söyler. Kayıt istemcide etiketlenir; etiket
// sunucudan istemciye geçerken korunmaz.

const IKINCIL_DUGME =
  'rounded border border-gray-500 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

// Geri alınamayan kaldırma iki adımlıdır: ilk düğme onay satırını açar, işi onay satırındaki düğme
// yapar.
function KaldirIsi({ id }: Readonly<{ id: string }>) {
  const [onayAcik, onayAcikYap] = useState(false);
  const [durum, gonder] = useActionState(uyelikKaldir, BOS_FORM_DURUMU);
  return (
    <div className="flex flex-col gap-2">
      <GenelHata ileti={durum.genelHata} />
      {onayAcik ? (
        <form action={gonder} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={id} />
          <p>Üyelik kaldırılsın mı?</p>
          <GonderDugmesi>Evet, kaldır</GonderDugmesi>
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
          Kaldır
        </button>
      )}
    </div>
  );
}

export function UyelikKaldir({ kayit }: Readonly<{ kayit: UyelikKaydi }>) {
  return (
    <Can I="sil" this={kaydiEtiketle('Uyelik', kayit)}>
      <KaldirIsi id={kayit.id} />
    </Can>
  );
}

// Etiketi seçime bağlı, hatası seçimin yanında ve ekran okuyucuya duyurulan seçim (TS-004 form
// kuralları). Seçenekler listenin ilk 100 kaydıdır; daha fazlası varsa altında not gösterilir.
export function SecimAlani({
  ad,
  etiket,
  secenekler,
  fazlasiNotu,
  hata,
}: Readonly<{
  ad: string;
  etiket: string;
  secenekler: Secenekler;
  fazlasiNotu: string;
  hata: string | undefined;
}>) {
  const hataKimligi = `${ad}-hata`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={ad} className="font-medium">
        {etiket}
      </label>
      <select
        id={ad}
        name={ad}
        defaultValue=""
        aria-invalid={hata !== undefined}
        aria-describedby={hata === undefined ? undefined : hataKimligi}
        className="rounded border border-gray-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <option value="">Seç</option>
        {secenekler.kayitlar.map((secenek) => (
          <option key={secenek.id} value={secenek.id}>
            {secenek.etiket}
          </option>
        ))}
      </select>
      {secenekler.dahaFazlasiVar && <p className="text-sm">{fazlasiNotu}</p>}
      {hata !== undefined && (
        <p id={hataKimligi} role="alert" className="text-sm text-red-700">
          {hata}
        </p>
      )}
    </div>
  );
}

// Başarıda eylem sayfayı tazeler; formun durumu tazelemeden sonra da kalır, böylece cevapta gelen
// parola belirleme adresi bu çizimde bir kez gösterilir.
export function UyelikVerFormu({
  kullaniciId,
  gruplar,
  roller,
}: Readonly<{ kullaniciId: string; gruplar: Secenekler; roller: Secenekler }>) {
  const [durum, eylem] = useActionState(uyelikVer, BOS_KULLANICI_IS_DURUMU);
  return (
    <form action={eylem} aria-label="Üyelik ver" className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      {durum.parolaAdresi !== null && (
        <>
          <p role="status" className="font-medium">
            Bu kişinin oturumları kapatıldı ve parolası sıfırlandı
          </p>
          <ParolaAdresi adres={durum.parolaAdresi} />
        </>
      )}
      <input type="hidden" name="kullaniciId" value={kullaniciId} />
      <SecimAlani
        ad="grupId"
        etiket="Grup"
        secenekler={gruplar}
        fazlasiNotu="İlk 100 grup gösteriliyor"
        hata={durum.alanHatalari['grupId']}
      />
      <SecimAlani
        ad="rolId"
        etiket="Rol"
        secenekler={roller}
        fazlasiNotu="İlk 100 rol gösteriliyor"
        hata={durum.alanHatalari['rolId']}
      />
      <GonderDugmesi>Üyelik ver</GonderDugmesi>
    </form>
  );
}
