import Link from 'next/link';
import { tarihSaat } from '../../../shared/bicim/bicim';
import {
  BAGLANTI,
  BOS,
  kimliginAdi,
} from '../../../shared/liste/liste-parcalari';
import { Alan } from '../../../shared/ui/alan';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { Kolon } from '../../../shared/yetki/yetki-saglayici';
import { SecimAlani } from '../uyelik/uyelik-isleri';
import type { Secenekler } from '../uyelik/uyelik-listesi';
import { etkiYazimi, kolonSiniri } from './yetenek-bicimi';
import type { TeshisCevabi, TeshisKarari } from './yetenek-teshisi';

// Teşhis ekranının formu ve sonucu (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-14, AU-32 ve
// AU-35). Form adresin sorgusuna yazılan bir GET formudur; sayfa yenilenince aynı sorgu yeniden
// sorulur. Sonuç kaydın bütünü kararını, kaydı tutan kuralları, kolon başına kararları ve kişinin son
// ret kayıtlarını gösterir; kaydın kolon değerleri gösterilmez (cevapta yoktur). Karar açık, kapalı
// ya da belirsizdir. Kural kimliği yetenek kayıt sayfasına bağlantıdır. Etki, öncelik ve kolonlar
// kolonu yetenek tablosundaki gibi tür düzeyinde sorulur. Sunucu bileşenidir.

const TESHIS_ADRESI = '/teshis';
const YETENEK = 'Yetenek';
const HUCRE = 'px-3 py-2 text-left';
const TABLO = 'w-full border-collapse';

export function TeshisFormu({
  izinler,
  degerler,
  alanHatalari,
}: Readonly<{
  izinler: Secenekler;
  degerler: Readonly<Record<string, string | undefined>>;
  alanHatalari: Readonly<Record<string, string>>;
}>) {
  return (
    <form
      action={TESHIS_ADRESI}
      aria-label="Teşhis sorgusu"
      className="flex flex-col gap-4"
    >
      <Alan
        ad="kullaniciId"
        etiket="Kullanıcı kimliği"
        tur="text"
        otomatikTamamlama="off"
        hata={alanHatalari['kullaniciId']}
        varsayilan={degerler['kullaniciId']}
      />
      <SecimAlani
        ad="izin"
        etiket="İzin"
        secenekler={izinler}
        fazlasiNotu="İlk 100 izin gösteriliyor"
        hata={alanHatalari['izin']}
        varsayilan={degerler['izin']}
      />
      <Alan
        ad="kayitId"
        etiket="Kayıt kimliği"
        tur="text"
        otomatikTamamlama="off"
        hata={alanHatalari['kayitId']}
        varsayilan={degerler['kayitId']}
      />
      <GonderDugmesi>Teşhis et</GonderDugmesi>
    </form>
  );
}

function kararYazimi(acik: boolean | null): string {
  if (acik === null) {
    return 'Belirsiz';
  }
  return acik ? 'Açık' : 'Kapalı';
}

function evetHayir(deger: boolean): string {
  return deger ? 'Evet' : 'Hayır';
}

function KuralBaglantisi({ id }: Readonly<{ id: string | null }>) {
  if (id === null) {
    return BOS;
  }
  return (
    <Link href={`/yetenekler/${id}`} className={BAGLANTI}>
      {kimliginAdi(null, id)}
    </Link>
  );
}

function KararSatirlari({ karar }: Readonly<{ karar: TeshisKarari }>) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
      <dt className="font-medium">Karar</dt>
      <dd>{kararYazimi(karar.acik)}</dd>
      <dt className="font-medium">Kararı veren kural</dt>
      <dd>
        <KuralBaglantisi id={karar.kararVeren} />
      </dd>
    </dl>
  );
}

export function TeshisSonucu({ cevap }: Readonly<{ cevap: TeshisCevabi }>) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Kaydın bütünü</h2>
        <KararSatirlari karar={cevap.kayitKarari} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Kaydı tutan kurallar</h2>
        {cevap.tutanKurallar.length === 0 ? (
          <p>Tutan kural yok</p>
        ) : (
          <table className={TABLO}>
            <caption className="sr-only">Kaydı tutan kurallar</caption>
            <thead>
              <tr className="border-b border-gray-300">
                <th scope="col" className={HUCRE}>
                  Kural
                </th>
                <Kolon a={YETENEK} alanlar={['giremez']}>
                  <th scope="col" className={HUCRE}>
                    Etki
                  </th>
                </Kolon>
                <Kolon a={YETENEK} alanlar={['oncelik']}>
                  <th scope="col" className={HUCRE}>
                    Öncelik
                  </th>
                </Kolon>
                <Kolon a={YETENEK} alanlar={['butunKolonlar', 'kolonlar']}>
                  <th scope="col" className={HUCRE}>
                    Kolonlar
                  </th>
                </Kolon>
                <th scope="col" className={HUCRE}>
                  Muaf
                </th>
                <th scope="col" className={HUCRE}>
                  Bozuk
                </th>
                <th scope="col" className={HUCRE}>
                  Değerlendirilemedi
                </th>
              </tr>
            </thead>
            <tbody>
              {cevap.tutanKurallar.map((kural) => (
                <tr key={kural.yetenekId} className="border-b border-gray-200">
                  <td className="px-3 py-2">
                    <KuralBaglantisi id={kural.yetenekId} />
                  </td>
                  <Kolon a={YETENEK} alanlar={['giremez']}>
                    <td className="px-3 py-2">
                      {etkiYazimi(kural.etki === 'yasak')}
                    </td>
                  </Kolon>
                  <Kolon a={YETENEK} alanlar={['oncelik']}>
                    <td className="px-3 py-2">{String(kural.oncelik)}</td>
                  </Kolon>
                  <Kolon a={YETENEK} alanlar={['butunKolonlar', 'kolonlar']}>
                    <td className="px-3 py-2">
                      {kolonSiniri(kural.butunKolonlar, kural.kolonlar)}
                    </td>
                  </Kolon>
                  <td className="px-3 py-2">{evetHayir(kural.muaf)}</td>
                  <td className="px-3 py-2">{evetHayir(kural.bozuk)}</td>
                  <td className="px-3 py-2">
                    {evetHayir(kural.degerlendirilemedi)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Kolon kararları</h2>
        <table className={TABLO}>
          <caption className="sr-only">Kolon kararları</caption>
          <thead>
            <tr className="border-b border-gray-300">
              <th scope="col" className={HUCRE}>
                Kolon
              </th>
              <th scope="col" className={HUCRE}>
                Karar
              </th>
              <th scope="col" className={HUCRE}>
                Kararı veren kural
              </th>
            </tr>
          </thead>
          <tbody>
            {cevap.kolonKararlari.map((karar) => (
              <tr key={karar.kolon} className="border-b border-gray-200">
                <td className="px-3 py-2">{karar.kolon}</td>
                <td className="px-3 py-2">{kararYazimi(karar.acik)}</td>
                <td className="px-3 py-2">
                  <KuralBaglantisi id={karar.kararVeren} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Son ret kayıtları</h2>
        {cevap.retKayitlari.length === 0 ? (
          <p>Ret kaydı yok</p>
        ) : (
          <table className={TABLO}>
            <caption className="sr-only">Son ret kayıtları</caption>
            <thead>
              <tr className="border-b border-gray-300">
                <th scope="col" className={HUCRE}>
                  Zaman
                </th>
                <th scope="col" className={HUCRE}>
                  Eylem
                </th>
                <th scope="col" className={HUCRE}>
                  Kaynak
                </th>
                <th scope="col" className={HUCRE}>
                  Kayıt
                </th>
                <th scope="col" className={HUCRE}>
                  Kararı veren yasak
                </th>
              </tr>
            </thead>
            <tbody>
              {cevap.retKayitlari.map((ret, sira) => (
                // Ret kaydının kimliği cevapta yoktur; sıra yeniden eskiyedir ve değişmez.
                <tr key={sira} className="border-b border-gray-200">
                  <td className="px-3 py-2">{tarihSaat(ret.zaman)}</td>
                  <td className="px-3 py-2">{ret.eylem}</td>
                  <td className="px-3 py-2">{ret.kaynak}</td>
                  <td className="px-3 py-2">
                    {kimliginAdi(null, ret.kayitId)}
                  </td>
                  <td className="px-3 py-2">
                    <KuralBaglantisi id={ret.kararVerenYasakId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
