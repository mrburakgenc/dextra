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
import { AlinamayanListeler } from '../alinamayan-listeler';
import type { Secenekler } from '../uyelik/uyelik-listesi';
import { adHaritasi, kayitSiniri, kolonSiniri, yetenekTuru } from './yetenek-bicimi';
import type {
  YetenekAdListeleri,
  YetenekKaydi,
  YetenekListesiSorgusu,
} from './yetenek-listesi';

// Yetenek listesinin süzgeci, tablosu ve sayfalaması (TS-004 "Yönetim ekranları"). Grup, rol ve
// izin adları seçeneklerden eşlenir; adı bulunamayan kimlik kısaltılarak, gelmeyen kolon boş
// işaretle görünür. İzin yazısı kayıt sayfasına bağlantıdır. Süzgeç adresin sorgusuna yazılan bir
// GET formudur; gönderilince ilk sayfaya dönülür, sıralama korunur. Listesi alınamayan süzgecin
// yerinde ileti çıkar; seçili değeri korunur.

const ADRES = '/yetenekler';
const HUCRE = 'px-3 py-2 text-left';
const GIRDI =
  'rounded border border-gray-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

function Suzgec({
  ad,
  etiket,
  secenekler,
  secili,
}: Readonly<{
  ad: string;
  etiket: string;
  secenekler: Secenekler | null;
  secili: string | undefined;
}>) {
  if (secenekler === null) {
    return (
      <>
        {secili !== undefined && <input type="hidden" name={ad} value={secili} />}
        <AlinamayanListeler listeler={{ [etiket]: null }} />
      </>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`suzgec-${ad}`} className="font-medium">
        {etiket}
      </label>
      <select id={`suzgec-${ad}`} name={ad} defaultValue={secili ?? ''} className={GIRDI}>
        <option value="">Hepsi</option>
        {secenekler.kayitlar.map((secenek) => (
          <option key={secenek.id} value={secenek.id}>
            {secenek.etiket}
          </option>
        ))}
      </select>
    </div>
  );
}

export function YetenekTablosu({
  liste,
  sorgu,
  secenekler,
}: Readonly<{
  liste: Liste<YetenekKaydi>;
  sorgu: YetenekListesiSorgusu;
  secenekler: YetenekAdListeleri;
}>) {
  const { sirala, grupId, rolId } = sorgu;
  const grupAdi = adHaritasi(secenekler.gruplar);
  const rolAdi = adHaritasi(secenekler.roller);
  const izinAdi = adHaritasi(secenekler.izinler);
  return (
    <div className="flex flex-col gap-4">
      <form action={ADRES} aria-label="Süzgeç" className="flex flex-wrap items-end gap-4">
        {sirala !== undefined && <input type="hidden" name="sirala" value={sirala} />}
        <Suzgec ad="grupId" etiket="Grup" secenekler={secenekler.gruplar} secili={grupId} />
        <Suzgec ad="rolId" etiket="Rol" secenekler={secenekler.roller} secili={rolId} />
        <button
          type="submit"
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Süz
        </button>
      </form>

      <ListeTablosu
        baslik="Yetenekler"
        liste={liste}
        basliklar={
          <>
            <th scope="col" className={HUCRE}>
              Grup
            </th>
            <th scope="col" className={HUCRE}>
              Rol
            </th>
            <th scope="col" className={HUCRE}>
              İzin
            </th>
            <th scope="col" className={HUCRE}>
              Kayıt sınırı
            </th>
            <th scope="col" className={HUCRE}>
              Kolon sınırı
            </th>
            <th scope="col" className={HUCRE}>
              Tür
            </th>
            <SiralamaBasligi
              adres={ADRES}
              kolon="olusturmaZamani"
              etiket="Oluşturma zamanı"
              sirala={sirala}
              suzgec={{ grupId, rolId }}
            />
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">{kimliginAdi(grupAdi, kayit.grupId)}</td>
            <td className="px-3 py-2">{kimliginAdi(rolAdi, kayit.rolId)}</td>
            <td className="px-3 py-2">
              <Link href={`${ADRES}/${kayit.id}`} className={BAGLANTI}>
                {kimliginAdi(izinAdi, kayit.izinId)}
              </Link>
            </td>
            <td className="px-3 py-2">{kayitSiniri(kayit.butunKayitlar, kayit.sart)}</td>
            <td className="px-3 py-2">{kolonSiniri(kayit.butunKolonlar, kayit.kolonlar)}</td>
            <td className="px-3 py-2">{yetenekTuru(kayit.sistemSatiri, kayit.tohumAnahtari)}</td>
            <td className="px-3 py-2">
              {kayit.olusturmaZamani === undefined ? BOS : tarihSaat(kayit.olusturmaZamani)}
            </td>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, grupId, rolId }} />
    </div>
  );
}
