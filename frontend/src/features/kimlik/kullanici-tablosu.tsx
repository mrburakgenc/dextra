import Link from 'next/link';
import { tarihSaat } from '../../shared/bicim/bicim';
import type { Liste } from '../../shared/liste/liste-istegi';
import {
  BAGLANTI,
  BOS,
  kimliginAdi,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../shared/liste/liste-parcalari';
import { sorguMetni } from '../../shared/liste/sorgu';
import { Kolon } from '../../shared/yetki/yetki-saglayici';
import type { KullaniciKaydi, KullaniciListesiSorgusu } from './kullanici-listesi';

// Kullanıcı listesinin tablosu, süzgeci ve sayfalaması (TS-004 "Yönetim ekranları"). Bütün
// gezinti adres sorgusuyla yapılır; sıralama ve süzgeç değişince ilk sayfaya dönülür. Kişinin
// tür düzeyinde okuyamadığı kolon çizilmez; görünen ad kayıt bağlantısıdır ve hep çizilir.

const ADRES = '/kullanicilar';
const KAYNAK = 'Kullanici';

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
            <Kolon a={KAYNAK} alanlar={['kullaniciAdi']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="kullaniciAdi"
                etiket="Kullanıcı adı"
                sirala={sirala}
                suzgec={{ pasif }}
              />
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['pasifZamani']}>
              <th scope="col" className="px-3 py-2 text-left">
                Durum
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="olusturmaZamani"
                etiket="Oluşturma zamanı"
                sirala={sirala}
                suzgec={{ pasif }}
              />
            </Kolon>
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">
              <Link href={`${ADRES}/${kayit.id}`} className={BAGLANTI}>
                {kayit.gorunenAd ?? kimliginAdi(null, kayit.id)}
              </Link>
            </td>
            <Kolon a={KAYNAK} alanlar={['kullaniciAdi']}>
              <td className="px-3 py-2">{kayit.kullaniciAdi ?? BOS}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['pasifZamani']}>
              <td className="px-3 py-2">{durum(kayit.pasifZamani)}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <td className="px-3 py-2">
                {kayit.olusturmaZamani === undefined
                  ? BOS
                  : tarihSaat(kayit.olusturmaZamani)}
              </td>
            </Kolon>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, pasif }} />
    </div>
  );
}
