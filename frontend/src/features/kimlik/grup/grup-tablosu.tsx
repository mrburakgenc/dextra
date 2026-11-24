import Link from 'next/link';
import { tarihSaat } from '../../../shared/bicim/bicim';
import type { Liste } from '../../../shared/liste/liste-istegi';
import {
  BAGLANTI,
  BOS,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../../shared/liste/liste-parcalari';
import { sorguMetni } from '../../../shared/liste/sorgu';
import type { GrupKaydi, GrupListesiSorgusu } from './grup-listesi';

// Grup listesinin tablosu, üst grup süzgeci ve sayfalaması (TS-004 "Yönetim ekranları"). Grup
// adına tıklama yalnız o grubun altındakileri gösterir (ustGrupId); 'Hepsi' süzgeci kaldırır.

const ADRES = '/gruplar';

export function GrupTablosu({
  liste,
  sorgu,
}: Readonly<{ liste: Liste<GrupKaydi>; sorgu: GrupListesiSorgusu }>) {
  const { sirala, ustGrupId } = sorgu;
  // Üst grubun adı aynı sayfadaki kayıtlardan bulunur; sayfada yoksa boş işaret gösterilir.
  // Anahtar tipi boş ve gelmeyen ustGrupId'yi de kabul eder; onlar için ad bulunmaz.
  const adlar = new Map<GrupKaydi['ustGrupId'], string | undefined>(
    liste.kayitlar.map((kayit) => [kayit.id, kayit.ad]),
  );
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Üst grup süzgeci">
        <Link
          href={`${ADRES}${sorguMetni({ sirala })}`}
          aria-current={ustGrupId === undefined ? 'page' : undefined}
          className={BAGLANTI}
        >
          Hepsi
        </Link>
      </nav>

      <ListeTablosu
        baslik="Gruplar"
        liste={liste}
        basliklar={
          <>
            <SiralamaBasligi
              adres={ADRES}
              kolon="ad"
              etiket="Ad"
              sirala={sirala}
              suzgec={{ ustGrupId }}
            />
            <th scope="col" className="px-3 py-2 text-left">
              Üst grup
            </th>
            <SiralamaBasligi
              adres={ADRES}
              kolon="olusturmaZamani"
              etiket="Oluşturma zamanı"
              sirala={sirala}
              suzgec={{ ustGrupId }}
            />
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">
              {kayit.ad === undefined ? (
                BOS
              ) : (
                <Link
                  href={`${ADRES}${sorguMetni({ sirala, ustGrupId: kayit.id })}`}
                  className={BAGLANTI}
                >
                  {kayit.ad}
                </Link>
              )}
            </td>
            <td className="px-3 py-2">
              {adlar.get(kayit.ustGrupId) ?? BOS}
            </td>
            <td className="px-3 py-2">
              {kayit.olusturmaZamani === undefined
                ? BOS
                : tarihSaat(kayit.olusturmaZamani)}
            </td>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, ustGrupId }} />
    </div>
  );
}
