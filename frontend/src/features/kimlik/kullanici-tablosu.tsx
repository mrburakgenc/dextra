import Link from 'next/link';
import { tarihSaat } from '../../shared/bicim/bicim';
import type { Liste } from '../../shared/liste/liste-istegi';
import {
  BAGLANTI,
  BOS,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../shared/liste/liste-parcalari';
import { sorguMetni } from '../../shared/liste/sorgu';
import type { KullaniciKaydi, KullaniciListesiSorgusu } from './kullanici-listesi';

// Kullanıcı listesinin tablosu, süzgeci ve sayfalaması (TS-004 "Yönetim ekranları"). Bütün
// gezinti adres sorgusuyla yapılır; sıralama ve süzgeç değişince ilk sayfaya dönülür.

const ADRES = '/kullanicilar';

const SUZGECLER = [
  { etiket: 'Yalnız etkinler', pasif: 'false' },
  { etiket: 'Yalnız pasifler', pasif: 'true' },
  { etiket: 'Hepsi', pasif: undefined },
] as const;

function durum(pasifZamani: KullaniciKaydi['pasifZamani']): string {
  if (pasifZamani === undefined) {
    return BOS;
  }
  return pasifZamani === null ? 'Etkin' : 'Pasif';
}

export function KullaniciTablosu({
  liste,
  sorgu,
}: Readonly<{ liste: Liste<KullaniciKaydi>; sorgu: KullaniciListesiSorgusu }>) {
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

      <ListeTablosu
        baslik="Kullanıcılar"
        liste={liste}
        basliklar={
          <>
            <SiralamaBasligi
              adres={ADRES}
              kolon="gorunenAd"
              etiket="Görünen ad"
              sirala={sirala}
              suzgec={{ pasif }}
            />
            <SiralamaBasligi
              adres={ADRES}
              kolon="kullaniciAdi"
              etiket="Kullanıcı adı"
              sirala={sirala}
              suzgec={{ pasif }}
            />
            <th scope="col" className="px-3 py-2 text-left">
              Durum
            </th>
            <SiralamaBasligi
              adres={ADRES}
              kolon="olusturmaZamani"
              etiket="Oluşturma zamanı"
              sirala={sirala}
              suzgec={{ pasif }}
            />
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">
              {kayit.gorunenAd === undefined ? (
                BOS
              ) : (
                <Link href={`${ADRES}/${kayit.id}`} className={BAGLANTI}>
                  {kayit.gorunenAd}
                </Link>
              )}
            </td>
            <td className="px-3 py-2">{kayit.kullaniciAdi ?? BOS}</td>
            <td className="px-3 py-2">{durum(kayit.pasifZamani)}</td>
            <td className="px-3 py-2">
              {kayit.olusturmaZamani === undefined
                ? BOS
                : tarihSaat(kayit.olusturmaZamani)}
            </td>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, pasif }} />
    </div>
  );
}
