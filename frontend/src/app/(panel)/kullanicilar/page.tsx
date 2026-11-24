import type { ReactNode } from 'react';
import {
  KullaniciListesiSorgusu,
  kullanicilariListele,
} from '../../../features/kimlik/kullanici-listesi';
import { KullaniciTablosu } from '../../../features/kimlik/kullanici-tablosu';
import { kimlikGerekliyseOturumuBitir } from '../../../shared/backend/hata';

const YETKI_YOK = 'Bu sayfayı görme yetkin yok';

// Kullanıcı listesi (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz
// değer varsayılana döner. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function KullanicilarSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = KullaniciListesiSorgusu.parse(await searchParams);
  const sonuc = await kullanicilariListele(sorgu);
  let icerik: ReactNode;
  if (sonuc.basarili) {
    icerik = <KullaniciTablosu liste={sonuc.liste} sorgu={sorgu} />;
  } else {
    kimlikGerekliyseOturumuBitir(sonuc.hata);
    icerik = (
      <p role="alert">
        {sonuc.hata.kod === 'yetki_yok' ? YETKI_YOK : sonuc.hata.ileti}
      </p>
    );
  }
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Kullanıcılar</h1>
      {icerik}
    </main>
  );
}
