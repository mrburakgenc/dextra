import Link from 'next/link';
import { tarihSaat } from '../../../shared/bicim/bicim';
import type { Liste } from '../../../shared/liste/liste-istegi';
import {
  BAGLANTI,
  BOS,
  kimliginAdi,
  ListeTablosu,
  Sayfalama,
  SiralamaBasligi,
} from '../../../shared/liste/liste-parcalari';
import { sorguMetni } from '../../../shared/liste/sorgu';
import { Kolon } from '../../../shared/yetki/yetki-saglayici';
import type { GrupKaydi, GrupListesiSorgusu } from './grup-listesi';

// Grup listesinin tablosu, üst grup süzgeci ve sayfalaması (TS-004 "Yönetim ekranları"). Grubun
// adı kayıt sayfasına bağlantıdır; 'Alt gruplar' yalnız o grubun altındakileri gösterir
// (ustGrupId); 'Hepsi' süzgeci kaldırır. Kişinin tür düzeyinde okuyamadığı kolon çizilmez; bağlantı
// kolonları hep çizilir.

const ADRES = '/gruplar';
const KAYNAK = 'Grup';

export function GrupTablosu({
  liste,
  sorgu,
}: Readonly<{ liste: Liste<GrupKaydi>; sorgu: GrupListesiSorgusu }>) {
  const { sirala, ustGrupId } = sorgu;
  // Üst grubun adı aynı sayfadaki kayıtlardan bulunur; sayfada yoksa kimlik kısaltılarak gösterilir
  // (TS-004 "Yönetim formlarının sertleştirilmesi").
  const adlar = new Map(liste.kayitlar.map((kayit) => [kayit.id, kayit.ad]));
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
            <Kolon a={KAYNAK} alanlar={['ustGrupId']}>
              <th scope="col" className="px-3 py-2 text-left">
                Üst grup
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="olusturmaZamani"
                etiket="Oluşturma zamanı"
                sirala={sirala}
                suzgec={{ ustGrupId }}
              />
            </Kolon>
            <th scope="col" className="px-3 py-2 text-left">
              Alt gruplar
            </th>
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
            <Kolon a={KAYNAK} alanlar={['ustGrupId']}>
              <td className="px-3 py-2">
                {kimliginAdi(adlar, kayit.ustGrupId)}
              </td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <td className="px-3 py-2">
                {kayit.olusturmaZamani === undefined
                  ? BOS
                  : tarihSaat(kayit.olusturmaZamani)}
              </td>
            </Kolon>
            <td className="px-3 py-2">
              <Link
                href={`${ADRES}${sorguMetni({ sirala, ustGrupId: kayit.id })}`}
                className={BAGLANTI}
              >
                Alt gruplar
              </Link>
            </td>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, ustGrupId }} />
    </div>
  );
}
