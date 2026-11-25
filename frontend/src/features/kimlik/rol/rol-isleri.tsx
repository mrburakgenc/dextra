'use client';

import { kaydiEtiketle } from '../../../shared/yetki/yetki';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { AdFormu, SilmeIsi } from '../is-parcalari';
import { rolAdiniDegistir, rolSil } from './rol-eylemleri';
import type { RolKaydi } from './rol-listesi';

// Rol sayfasındaki işler (TS-004 "Yönetim ekranları" ve "Yetki kurallarının ekrana taşınması"):
// her iş kayıt düzeyinde, kayıt türüyle etiketlenerek sorulur; ad formu ayrıca kolon düzeyinde
// sorulur. Görünmeyen iş ekranda hiç yer almaz; son sözü backend söyler. Kayıt istemcide
// etiketlenir; etiket sunucudan istemciye geçerken korunmaz.

// Sistem rolü (kodu dolu) silinemez; kodu gelmeyen kayıtta da sil gösterilmez.
export function RolIsleri({ kayit }: Readonly<{ kayit: RolKaydi }>) {
  const etiketli = kaydiEtiketle('Rol', kayit);
  return (
    <div className="flex flex-col gap-6">
      <Can I="guncelle" this={etiketli} field="ad">
        <AdFormu id={kayit.id} eylem={rolAdiniDegistir} />
      </Can>
      {kayit.kod === null && (
        <Can I="sil" this={etiketli}>
          <SilmeIsi id={kayit.id} eylem={rolSil} soru="Rol silinsin mi?" />
        </Can>
      )}
    </div>
  );
}
