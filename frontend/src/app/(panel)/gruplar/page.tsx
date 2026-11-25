import Link from 'next/link';
import {
  GrupListesiSorgusu,
  gruplariListele,
} from '../../../features/kimlik/grup/grup-listesi';
import { GrupTablosu } from '../../../features/kimlik/grup/grup-tablosu';
import { BAGLANTI, listeHatasi } from '../../../shared/liste/liste-parcalari';
import { sorguMetni } from '../../../shared/liste/sorgu';
import { Can } from '../../../shared/yetki/yetki-saglayici';

// Grup listesi (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz değer
// varsayılana döner. 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur. Liste bir
// grubun altıyla süzülmüşse 'Yeni grup' o grubu üst grup olarak ön seçer.
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
      <Can I="olustur" a="Grup">
        <p>
          <Link
            href={`/gruplar/yeni${sorguMetni({ ustGrupId: sorgu.ustGrupId })}`}
            className={BAGLANTI}
          >
            Yeni grup
          </Link>
        </p>
      </Can>
      {sonuc.basarili ? (
        <GrupTablosu liste={sonuc.liste} sorgu={sorgu} />
      ) : (
        listeHatasi(sonuc.hata)
      )}
    </main>
  );
}
