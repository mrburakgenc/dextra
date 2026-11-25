import Link from 'next/link';
import type { Liste } from '../../../shared/liste/liste-istegi';
import {
  BAGLANTI,
  BOS,
  kimliginAdi,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../../shared/liste/liste-parcalari';
import { Kolon } from '../../../shared/yetki/yetki-saglayici';
import type { RolKaydi, RolListesiSorgusu } from './rol-listesi';

// Rol listesinin tablosu ve sayfalaması (TS-004 "Yönetim ekranları"). Rolün adı kayıt sayfasına
// bağlantıdır ve hep çizilir; kişinin tür düzeyinde okuyamadığı kolon çizilmez.

const ADRES = '/roller';
const KAYNAK = 'Rol';

// Kodu dolu rol sistem rolüdür.
function kodHucresi(kod: RolKaydi['kod']) {
  if (kod === undefined || kod === null) {
    return BOS;
  }
  return (
    <>
      {kod}{' '}
      <span className="rounded bg-gray-200 px-2 text-sm">sistem rolü</span>
    </>
  );
}

export function RolTablosu({
  liste,
  sorgu,
}: Readonly<{ liste: Liste<RolKaydi>; sorgu: RolListesiSorgusu }>) {
  const { sirala } = sorgu;
  return (
    <div className="flex flex-col gap-4">
      <ListeTablosu
        baslik="Roller"
        liste={liste}
        basliklar={
          <>
            <SiralamaBasligi
              adres={ADRES}
              kolon="ad"
              etiket="Ad"
              sirala={sirala}
              suzgec={{}}
            />
            <Kolon a={KAYNAK} alanlar={['kod']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="kod"
                etiket="Kod"
                sirala={sirala}
                suzgec={{}}
              />
            </Kolon>
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">
              <Link href={`${ADRES}/${kayit.id}`} className={BAGLANTI}>
                {kayit.ad ?? kimliginAdi(null, kayit.id)}
              </Link>
            </td>
            <Kolon a={KAYNAK} alanlar={['kod']}>
              <td className="px-3 py-2">{kodHucresi(kayit.kod)}</td>
            </Kolon>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala }} />
    </div>
  );
}
