import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  YetenekListesiSorgusu,
  yetenekleriListele,
  yetenekSecenekleri,
} from '../../../features/kimlik/yetenek/yetenek-listesi';
import { YetenekTablosu } from '../../../features/kimlik/yetenek/yetenek-tablosu';
import { BAGLANTI, listeHatasi } from '../../../shared/liste/liste-parcalari';
import { Can } from '../../../shared/yetki/yetki-saglayici';

// Yetenek listesi (TS-004 "Yönetim ekranları"): sorgu ekranın şemasıyla doğrulanır, geçersiz değer
// varsayılana döner. Liste ve ad listeleri birlikte istenir; biri alınamazsa ilk hatası gösterilir.
// 401 oturum bitti yoluna gider; 403 ve öbür hatalar ileti olur.
export default async function YeteneklerSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = YetenekListesiSorgusu.parse(await searchParams);
  const [sonuc, secenekler] = await Promise.all([
    yetenekleriListele(sorgu),
    yetenekSecenekleri(),
  ]);
  let icerik: ReactNode;
  if (!sonuc.basarili) {
    icerik = listeHatasi(sonuc.hata);
  } else if (!secenekler.basarili) {
    icerik = listeHatasi(secenekler.hata);
  } else {
    icerik = (
      <YetenekTablosu liste={sonuc.liste} sorgu={sorgu} secenekler={secenekler.secenekler} />
    );
  }
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yetenekler</h1>
      <Can I="olustur" a="Yetenek">
        <p>
          <Link href="/yetenekler/yeni" className={BAGLANTI}>
            Yeni yetenek
          </Link>
        </p>
      </Can>
      {icerik}
    </main>
  );
}
