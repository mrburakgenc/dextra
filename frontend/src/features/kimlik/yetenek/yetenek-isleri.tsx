'use client';

import { kaydiEtiketle } from '../../../shared/yetki/yetki';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { SilmeIsi } from '../is-parcalari';
import { yetenekSil } from './yetenek-eylemleri';
import { YetenekYenileFormu } from './yetenek-formu';
import type { YetenekKaydi } from './yetenek-listesi';
import { sartSatirlari } from './yetenek-sarti';

// Yetenek sayfasındaki işler (TS-004 "Yönetim ekranları" ve "Yetki kurallarının ekrana taşınması"):
// her iş kayıt düzeyinde, kayıt türüyle etiketlenerek sorulur. Yenileme eski satırı kapatıp yeni
// satır açtığı için hem yenile hem olustur eylemiyle sorulur. Görünmeyen iş ekranda hiç yer almaz;
// son sözü backend söyler. Kayıt istemcide etiketlenir; etiket sunucudan istemciye geçerken
// korunmaz.

// Sistem satırı yenilenemez ve silinemez, tohum satırı yenilenemez; türü bilinemeyen kayıtta (kolonu
// gelmeyen) iş gösterilmez.
export function YetenekIsleri({ kayit }: Readonly<{ kayit: YetenekKaydi }>) {
  const etiketli = kaydiEtiketle('Yetenek', kayit);
  return (
    <div className="flex flex-col gap-6">
      {kayit.sistemSatiri === false && kayit.tohumAnahtari === null && (
        <Can I="yenile" this={etiketli}>
          <Can I="olustur" this={etiketli}>
            <YetenekYenileFormu
              id={kayit.id}
              baslangic={{
                sart: sartSatirlari(kayit.sart ?? null),
                butunKayitlar: kayit.butunKayitlar ?? false,
                butunBirimler: kayit.butunBirimler ?? false,
                kolonlar: (kayit.kolonlar ?? []).join(', '),
                butunKolonlar: kayit.butunKolonlar ?? false,
              }}
            />
          </Can>
        </Can>
      )}
      {kayit.sistemSatiri === false && (
        <Can I="sil" this={etiketli}>
          <SilmeIsi id={kayit.id} eylem={yetenekSil} soru="Yetenek silinsin mi?" />
        </Can>
      )}
    </div>
  );
}
