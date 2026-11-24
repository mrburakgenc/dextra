import type { Liste } from '../../../shared/liste/liste-istegi';
import {
  BOS,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../../shared/liste/liste-parcalari';
import type { RolKaydi, RolListesiSorgusu } from './rol-listesi';

// Rol listesinin tablosu ve sayfalaması (TS-004 "Yönetim ekranları").

const ADRES = '/roller';

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
            <SiralamaBasligi
              adres={ADRES}
              kolon="kod"
              etiket="Kod"
              sirala={sirala}
              suzgec={{}}
            />
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">{kayit.ad ?? BOS}</td>
            <td className="px-3 py-2">{kodHucresi(kayit.kod)}</td>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala }} />
    </div>
  );
}
