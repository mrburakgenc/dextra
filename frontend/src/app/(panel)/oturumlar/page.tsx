import {
  OturumListesiSorgusu,
  oturumlariListele,
} from '../../../features/kimlik/oturum/oturum-listesi';
import { OturumTablosu } from '../../../features/kimlik/oturum/oturum-tablosu';
import { listeHatasi } from '../../../shared/liste/liste-parcalari';

// Oturum listesi (TS-004 "Parola değiştirme ve oturumlar ekranları"): sorgu ekranın şemasıyla
// doğrulanır, geçersiz değer varsayılana döner. Adreste geçerli kullaniciId varsa liste o kişinin
// oturumlarıdır. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function OturumlarSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = OturumListesiSorgusu.parse(await searchParams);
  const sonuc = await oturumlariListele(sorgu);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">
        {sorgu.kullaniciId === undefined ? 'Oturumlar' : 'Kullanıcının oturumları'}
      </h1>
      {sonuc.basarili ? (
        <OturumTablosu liste={sonuc.liste} sorgu={sorgu} buOturumId={sonuc.buOturumId} />
      ) : (
        listeHatasi(sonuc.hata)
      )}
    </main>
  );
}
