import type { Liste } from '../../../shared/liste/liste-istegi';
import {
  BOS,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../../shared/liste/liste-parcalari';
import type { IzinKaydi, IzinListesiSorgusu } from './izin-listesi';

// İzin kataloğunun tablosu ve sayfalaması (TS-004 "Yönetim ekranları").

const ADRES = '/izinler';

export function IzinTablosu({
  liste,
  sorgu,
}: Readonly<{ liste: Liste<IzinKaydi>; sorgu: IzinListesiSorgusu }>) {
  const { sirala } = sorgu;
  return (
    <div className="flex flex-col gap-4">
      <ListeTablosu
        baslik="İzinler"
        liste={liste}
        basliklar={
          <>
            <SiralamaBasligi
              adres={ADRES}
              kolon="kaynak"
              etiket="Kaynak"
              sirala={sirala}
              suzgec={{}}
            />
            <SiralamaBasligi
              adres={ADRES}
              kolon="eylem"
              etiket="Eylem"
              sirala={sirala}
              suzgec={{}}
            />
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">{kayit.kaynak ?? BOS}</td>
            <td className="px-3 py-2">{kayit.eylem ?? BOS}</td>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala }} />
    </div>
  );
}
