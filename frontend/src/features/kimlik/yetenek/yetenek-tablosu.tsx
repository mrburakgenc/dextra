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
import { Kolon } from '../../../shared/yetki/yetki-saglayici';
import { AlinamayanListeler } from '../alinamayan-listeler';
import type { Secenekler } from '../uyelik/uyelik-listesi';
import {
  adHaritasi,
  etkiYazimi,
  kayitSiniri,
  kolonSiniri,
  yetenekTuru,
} from './yetenek-bicimi';
import type {
  YetenekAdListeleri,
  YetenekKaydi,
  YetenekListesiSorgusu,
} from './yetenek-listesi';

// Yetenek listesinin süzgeci, tablosu ve sayfalaması (TS-004 "Yönetim ekranları"). Grup, rol ve
// izin adları seçeneklerden eşlenir; adı bulunamayan kimlik kısaltılarak görünür. Kişinin tür
// düzeyinde okuyamadığı kolon çizilmez; çizilen kolonda alanı gelmeyen kaydın hücresi boş işarettir.
// İzin yazısı kayıt sayfasına bağlantıdır ve hep çizilir; izin gelmediyse yazı kaydın kısaltılmış
// kimliğidir. Süzgeç adresin sorgusuna yazılan bir GET formudur; gönderilince ilk sayfaya dönülür,
// sıralama korunur. Listesi alınamayan süzgecin yerinde ileti çıkar; seçili değeri korunur.

const ADRES = '/yetenekler';
const KAYNAK = 'Yetenek';
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
            <Kolon a={KAYNAK} alanlar={['grupId']}>
              <th scope="col" className={HUCRE}>
                Grup
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['rolId']}>
              <th scope="col" className={HUCRE}>
                Rol
              </th>
            </Kolon>
            <th scope="col" className={HUCRE}>
              İzin
            </th>
            <Kolon a={KAYNAK} alanlar={['butunKayitlar', 'sart']}>
              <th scope="col" className={HUCRE}>
                Kayıt sınırı
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['butunKolonlar', 'kolonlar']}>
              <th scope="col" className={HUCRE}>
                Kolon sınırı
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['giremez']}>
              <th scope="col" className={HUCRE}>
                Etki
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['oncelik']}>
              <th scope="col" className={HUCRE}>
                Öncelik
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['sistemSatiri', 'tohumAnahtari']}>
              <th scope="col" className={HUCRE}>
                Tür
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <SiralamaBasligi
                adres={ADRES}
                kolon="olusturmaZamani"
                etiket="Oluşturma zamanı"
                sirala={sirala}
                suzgec={{ grupId, rolId }}
              />
            </Kolon>
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <Kolon a={KAYNAK} alanlar={['grupId']}>
              <td className="px-3 py-2">{kimliginAdi(grupAdi, kayit.grupId)}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['rolId']}>
              <td className="px-3 py-2">{kimliginAdi(rolAdi, kayit.rolId)}</td>
            </Kolon>
            <td className="px-3 py-2">
              <Link href={`${ADRES}/${kayit.id}`} className={BAGLANTI}>
                {kayit.izinId === undefined
                  ? kimliginAdi(null, kayit.id)
                  : kimliginAdi(izinAdi, kayit.izinId)}
              </Link>
            </td>
            <Kolon a={KAYNAK} alanlar={['butunKayitlar', 'sart']}>
              <td className="px-3 py-2">{kayitSiniri(kayit.butunKayitlar, kayit.sart)}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['butunKolonlar', 'kolonlar']}>
              <td className="px-3 py-2">{kolonSiniri(kayit.butunKolonlar, kayit.kolonlar)}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['giremez']}>
              <td className="px-3 py-2">{etkiYazimi(kayit.giremez)}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['oncelik']}>
              <td className="px-3 py-2">
                {kayit.oncelik === undefined ? BOS : String(kayit.oncelik)}
              </td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['sistemSatiri', 'tohumAnahtari']}>
              <td className="px-3 py-2">{yetenekTuru(kayit.sistemSatiri, kayit.tohumAnahtari)}</td>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <td className="px-3 py-2">
                {kayit.olusturmaZamani === undefined ? BOS : tarihSaat(kayit.olusturmaZamani)}
              </td>
            </Kolon>
          </tr>
        ))}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, grupId, rolId }} />
    </div>
  );
}
