import Link from 'next/link';
import { tarihSaat } from '../../shared/bicim/bicim';
import {
  type KullaniciListesi,
  type KullaniciListesiSorgusu,
  sorguMetni,
} from './kullanici-listesi';

// Kullanıcı listesinin tablosu, süzgeci ve sayfalaması (TS-004 "Yönetim ekranları"). Bütün
// gezinti adres sorgusuyla yapılır; sıralama ve süzgeç değişince ilk sayfaya dönülür.

const ADRES = '/kullanicilar';
// Kayıtta gelmeyen (kişinin göremediği) ya da boş kolon.
const BOS = '—';

type Kolon = 'gorunenAd' | 'kullaniciAdi' | 'olusturmaZamani';
type Kayit = KullaniciListesi['kayitlar'][number];

const SUZGECLER = [
  { etiket: 'Yalnız etkinler', pasif: 'false' },
  { etiket: 'Yalnız pasifler', pasif: 'true' },
  { etiket: 'Hepsi', pasif: undefined },
] as const;

const BAGLANTI =
  'text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

function durum(pasifZamani: Kayit['pasifZamani']): string {
  if (pasifZamani === undefined) {
    return BOS;
  }
  return pasifZamani === null ? 'Etkin' : 'Pasif';
}

function SiralamaBasligi({
  kolon,
  etiket,
  sorgu,
}: Readonly<{ kolon: Kolon; etiket: string; sorgu: KullaniciListesiSorgusu }>) {
  const artan = sorgu.sirala === kolon;
  const azalan = sorgu.sirala === `-${kolon}`;
  // Aynı kolona ikinci tıklama yönü çevirir.
  const sonraki: KullaniciListesiSorgusu['sirala'] = artan ? `-${kolon}` : kolon;
  return (
    <th
      scope="col"
      aria-sort={artan ? 'ascending' : azalan ? 'descending' : undefined}
      className="px-3 py-2 text-left"
    >
      <Link
        href={`${ADRES}${sorguMetni({ sirala: sonraki, pasif: sorgu.pasif })}`}
        className={BAGLANTI}
      >
        {etiket}
      </Link>
      {(artan || azalan) && <span aria-hidden="true">{artan ? ' ▲' : ' ▼'}</span>}
    </th>
  );
}

export function KullaniciTablosu({
  liste,
  sorgu,
}: Readonly<{ liste: KullaniciListesi; sorgu: KullaniciListesiSorgusu }>) {
  const { sirala, pasif } = sorgu;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Durum süzgeci">
        <ul className="flex gap-4">
          {SUZGECLER.map((suzgec) => (
            <li key={suzgec.etiket}>
              <Link
                href={`${ADRES}${sorguMetni({ sirala, pasif: suzgec.pasif })}`}
                aria-current={pasif === suzgec.pasif ? 'page' : undefined}
                className={BAGLANTI}
              >
                {suzgec.etiket}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {liste.kayitlar.length === 0 ? (
        <p>Kayıt yok</p>
      ) : (
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Kullanıcılar, {liste.sayfa}. sayfa
          </caption>
          <thead>
            <tr className="border-b border-gray-300">
              <SiralamaBasligi kolon="gorunenAd" etiket="Görünen ad" sorgu={sorgu} />
              <SiralamaBasligi
                kolon="kullaniciAdi"
                etiket="Kullanıcı adı"
                sorgu={sorgu}
              />
              <th scope="col" className="px-3 py-2 text-left">
                Durum
              </th>
              <SiralamaBasligi
                kolon="olusturmaZamani"
                etiket="Oluşturma zamanı"
                sorgu={sorgu}
              />
            </tr>
          </thead>
          <tbody>
            {liste.kayitlar.map((kayit) => (
              <tr key={kayit.id} className="border-b border-gray-200">
                <td className="px-3 py-2">{kayit.gorunenAd ?? BOS}</td>
                <td className="px-3 py-2">{kayit.kullaniciAdi ?? BOS}</td>
                <td className="px-3 py-2">{durum(kayit.pasifZamani)}</td>
                <td className="px-3 py-2">
                  {kayit.olusturmaZamani === undefined
                    ? BOS
                    : tarihSaat(kayit.olusturmaZamani)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <nav aria-label="Sayfalama" className="flex gap-4">
        {liste.sayfa > 1 && (
          <Link
            href={`${ADRES}${sorguMetni({ sayfa: liste.sayfa - 1, sirala, pasif })}`}
            className={BAGLANTI}
          >
            Önceki
          </Link>
        )}
        {liste.sonrakiVar && (
          <Link
            href={`${ADRES}${sorguMetni({ sayfa: liste.sayfa + 1, sirala, pasif })}`}
            className={BAGLANTI}
          >
            Sonraki
          </Link>
        )}
      </nav>
    </div>
  );
}
