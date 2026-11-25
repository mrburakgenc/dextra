'use client';

import { useActionState } from 'react';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { kaydiEtiketle } from '../../../shared/yetki/yetki';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { BOS_FORM_DURUMU } from '../form-durumu';
import { AdFormu, GenelHata, SilmeIsi } from '../is-parcalari';
import { grupAdiniDegistir, grupSil, grupTasi } from './grup-eylemleri';
import type { GrupKaydi, UstGrupSecenekleri } from './grup-listesi';
import { UstGrupAlani } from './ust-grup-alani';

// Grup sayfasındaki işler (TS-004 "Yönetim ekranları" ve "Yetki kurallarının ekrana taşınması"):
// her iş kayıt düzeyinde, kayıt türüyle etiketlenerek sorulur; ad formu ayrıca kolon düzeyinde
// sorulur. Görünmeyen iş ekranda hiç yer almaz; son sözü backend söyler. Kayıt istemcide
// etiketlenir; etiket sunucudan istemciye geçerken korunmaz.

function TasiIsi({
  id,
  secenekler,
}: Readonly<{ id: string; secenekler: UstGrupSecenekleri }>) {
  const [durum, eylem] = useActionState(grupTasi, BOS_FORM_DURUMU);
  return (
    <form action={eylem} aria-label="Taşı" className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      <input type="hidden" name="id" value={id} />
      <UstGrupAlani
        etiket="Yeni üst grup"
        secenekler={secenekler}
        varsayilan={undefined}
        hata={durum.alanHatalari['ustGrupId']}
      />
      <GonderDugmesi>Taşı</GonderDugmesi>
    </form>
  );
}

// secenekler: üst grup seçimi; liste alınamadıysa null'dır ve taşı gösterilmez.
export function GrupIsleri({
  kayit,
  secenekler,
}: Readonly<{ kayit: GrupKaydi; secenekler: UstGrupSecenekleri | null }>) {
  const etiketli = kaydiEtiketle('Grup', kayit);
  return (
    <div className="flex flex-col gap-6">
      <Can I="guncelle" this={etiketli} field="ad">
        <AdFormu id={kayit.id} eylem={grupAdiniDegistir} />
      </Can>
      {secenekler !== null && (
        <Can I="tasi" this={etiketli}>
          <TasiIsi id={kayit.id} secenekler={secenekler} />
        </Can>
      )}
      <Can I="sil" this={etiketli}>
        <SilmeIsi id={kayit.id} eylem={grupSil} soru="Grup silinsin mi?" />
      </Can>
    </div>
  );
}
