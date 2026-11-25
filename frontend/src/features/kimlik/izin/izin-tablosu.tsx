import type { Liste } from '../../../shared/liste/liste-istegi';
import {
  BOS,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../../shared/liste/liste-parcalari';
import { Kolon } from '../../../shared/yetki/yetki-saglayici';
import type { IzinKaydi, IzinListesiSorgusu } from './izin-listesi';

// İzin kataloğunun tablosu ve sayfalaması (TS-004 "Yönetim ekranları"). Kişinin tür düzeyinde
// okuyamadığı kolon çizilmez.

const ADRES = '/izinler';
const KAYNAK = 'Izin';

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
            <Kolon a={KAYNAK} alanlar={['kaynak']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="kaynak"
                etiket="Kaynak"
                sirala={sirala}
                suzgec={{}}
              />
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['eylem']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="eylem"
                etiket="Eylem"
                sirala={sirala}
                suzgec={{}}
              />
            </Kolon>
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <Kolon a={KAYNAK} alanlar={['kaynak']}>
              <td className="px-3 py-2">{kayit.kaynak ?? BOS}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['eylem']}>
              <td className="px-3 py-2">{kayit.eylem ?? BOS}</td>
            </Kolon>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala }} />
    </div>
  );
}
