import Link from 'next/link';
import type { ReactNode } from 'react';
import { type BackendHatasi, kimlikGerekliyseOturumuBitir } from '../backend/hata';
import type { Liste } from './liste-istegi';
import { type SorguAlanlari, sorguMetni } from './sorgu';

// Liste ekranlarının ortak parçaları (TS-004 "Yönetim ekranları"). Bütün gezinti adres sorgusuyla
// yapılır; sıralama ve süzgeç değişince ilk sayfaya dönülür. Parçalar sunucu bileşenidir.

// Kayıtta gelmeyen (kişinin göremediği) ya da boş kolon.
export const BOS = '—';

export const BAGLANTI =
  'text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

const YETKI_YOK = 'Bu sayfayı görme yetkin yok';

// Liste isteğinin hatası: 401 oturum bitti yoluna yönlendirir (fırlatır); 403 ve öbür hatalar
// ileti olur. Yönlendirme sayfa çizilmeden olsun diye bileşen değil, sayfanın çağırdığı işlevdir.
export function listeHatasi(hata: BackendHatasi): ReactNode {
  kimlikGerekliyseOturumuBitir(hata);
  return (
    <p role="alert">{hata.kod === 'yetki_yok' ? YETKI_YOK : hata.ileti}</p>
  );
}

// suzgec: sıralama ve sayfa dışındaki sorgu alanları; bağlantıda korunur.
export function SiralamaBasligi({
  adres,
  kolon,
  etiket,
  sirala,
  suzgec,
}: Readonly<{
  adres: string;
  kolon: string;
  etiket: string;
  sirala: string | undefined;
  suzgec: SorguAlanlari;
}>) {
  const artan = sirala === kolon;
  const azalan = sirala === `-${kolon}`;
  // Aynı kolona ikinci tıklama yönü çevirir.
  const sonraki = artan ? `-${kolon}` : kolon;
  return (
    <th
      scope="col"
      aria-sort={artan ? 'ascending' : azalan ? 'descending' : undefined}
      className="px-3 py-2 text-left"
    >
      <Link
        href={`${adres}${sorguMetni({ sirala: sonraki, ...suzgec })}`}
        className={BAGLANTI}
      >
        {etiket}
      </Link>
      {(artan || azalan) && <span aria-hidden="true">{artan ? ' ▲' : ' ▼'}</span>}
    </th>
  );
}

// Kayıt yoksa 'Kayıt yok' iletisi; varsa başlık satırı ve kaynağın çizdiği satırlarla tablo.
export function ListeTablosu({
  baslik,
  liste,
  basliklar,
  children,
}: Readonly<{
  baslik: string;
  liste: Liste<unknown>;
  basliklar: ReactNode;
  children: ReactNode;
}>) {
  if (liste.kayitlar.length === 0) {
    return <p>Kayıt yok</p>;
  }
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">
        {baslik}, {liste.sayfa}. sayfa
      </caption>
      <thead>
        <tr className="border-b border-gray-300">{basliklar}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

// sorgu: sayfa dışındaki sorgu alanları (sıralama ve süzgeç); bağlantıda korunur.
export function Sayfalama({
  adres,
  liste,
  sorgu,
}: Readonly<{ adres: string; liste: Liste<unknown>; sorgu: SorguAlanlari }>) {
  return (
    <nav aria-label="Sayfalama" className="flex gap-4">
      {liste.sayfa > 1 && (
        <Link
          href={`${adres}${sorguMetni({ sayfa: liste.sayfa - 1, ...sorgu })}`}
          className={BAGLANTI}
        >
          Önceki
        </Link>
      )}
      {liste.sonrakiVar && (
        <Link
          href={`${adres}${sorguMetni({ sayfa: liste.sayfa + 1, ...sorgu })}`}
          className={BAGLANTI}
        >
          Sonraki
        </Link>
      )}
    </nav>
  );
}
