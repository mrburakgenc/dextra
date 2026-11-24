import {
  KullaniciListesiSorgusu,
  kullanicilariListele,
} from '../../../features/kimlik/kullanici-listesi';
import { KullaniciTablosu } from '../../../features/kimlik/kullanici-tablosu';
import { listeHatasi } from '../../../shared/liste/liste-parcalari';

// Kullanıcı listesi (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz
// değer varsayılana döner. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function KullanicilarSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = KullaniciListesiSorgusu.parse(await searchParams);
  const sonuc = await kullanicilariListele(sorgu);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Kullanıcılar</h1>
      {sonuc.basarili ? (
        <KullaniciTablosu liste={sonuc.liste} sorgu={sorgu} />
      ) : (
        listeHatasi(sonuc.hata)
      )}
    </main>
  );
}
