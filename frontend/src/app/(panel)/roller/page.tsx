import Link from 'next/link';
import {
  RolListesiSorgusu,
  rolleriListele,
} from '../../../features/kimlik/rol/rol-listesi';
import { RolTablosu } from '../../../features/kimlik/rol/rol-tablosu';
import { BAGLANTI, listeHatasi } from '../../../shared/liste/liste-parcalari';
import { Can } from '../../../shared/yetki/yetki-saglayici';

// Rol listesi (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz değer
// varsayılana döner. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function RollerSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = RolListesiSorgusu.parse(await searchParams);
  const sonuc = await rolleriListele(sorgu);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Roller</h1>
      <Can I="olustur" a="Rol">
        <p>
          <Link href="/roller/yeni" className={BAGLANTI}>
            Yeni rol
          </Link>
        </p>
      </Can>
      {sonuc.basarili ? (
        <RolTablosu liste={sonuc.liste} sorgu={sorgu} />
      ) : (
        listeHatasi(sonuc.hata)
      )}
    </main>
  );
}
