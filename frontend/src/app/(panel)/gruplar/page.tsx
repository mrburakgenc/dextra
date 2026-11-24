import {
  GrupListesiSorgusu,
  gruplariListele,
} from '../../../features/kimlik/grup/grup-listesi';
import { GrupTablosu } from '../../../features/kimlik/grup/grup-tablosu';
import { listeHatasi } from '../../../shared/liste/liste-parcalari';

// Grup listesi (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz değer
// varsayılana döner. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function GruplarSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = GrupListesiSorgusu.parse(await searchParams);
  const sonuc = await gruplariListele(sorgu);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Gruplar</h1>
      {sonuc.basarili ? (
        <GrupTablosu liste={sonuc.liste} sorgu={sorgu} />
      ) : (
        listeHatasi(sonuc.hata)
      )}
    </main>
  );
}
