import {
  IzinListesiSorgusu,
  izinleriListele,
} from '../../../features/kimlik/izin/izin-listesi';
import { IzinTablosu } from '../../../features/kimlik/izin/izin-tablosu';
import { listeHatasi } from '../../../shared/liste/liste-parcalari';

// İzin kataloğu (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz değer
// varsayılana döner. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function IzinlerSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = IzinListesiSorgusu.parse(await searchParams);
  const sonuc = await izinleriListele(sorgu);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">İzinler</h1>
      {sonuc.basarili ? (
        <IzinTablosu liste={sonuc.liste} sorgu={sorgu} />
      ) : (
        listeHatasi(sonuc.hata)
      )}
    </main>
  );
}
