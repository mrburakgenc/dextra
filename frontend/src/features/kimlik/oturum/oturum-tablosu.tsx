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
import { OturumKapat } from './oturum-isleri';
import type { OturumKaydi, OturumListesiSorgusu } from './oturum-listesi';

// Oturum listesinin tablosu, görünüm seçimi ve sayfalaması (TS-004 "Parola değiştirme ve oturumlar
// ekranları"). Bütün gezinti adres sorgusuyla yapılır; görünüm ve sıralama değişince ilk sayfaya
// dönülür, kişi süzgeci korunur. Sunucu bileşenidir.

const ADRES = '/oturumlar';
const HUCRE = 'px-3 py-2';

const GORUNUMLER = [
  { etiket: 'Açık oturumlar', acik: 'true' },
  { etiket: 'Geçmiş oturumlar', acik: 'false' },
] as const;

// Kapatılma nedenlerinin ekrandaki adı; tanınmayan kod olduğu gibi yazılır.
const NEDENLER: Readonly<Record<string, string>> = {
  cikis: 'Çıkış',
  sahibi_kapatti: 'Sahibi kapattı',
  yonetici: 'Yönetici kapattı',
  parola_degisimi: 'Parola değişti',
  pasife_alma: 'Hesap pasife alındı',
  oturum_siniri: 'Oturum sınırı',
  sure: 'Süresi doldu',
  adres_degisti: 'Adres değişti',
  cihaz_uymadi: 'Cihaz uymadı',
  yeniden_kullanim: 'Güvenlik: belirteç yeniden kullanıldı',
  tutarsiz_nesil: 'Güvenlik: tutarsız belirteç',
};

function zaman(an: string | undefined): string {
  return an === undefined ? BOS : tarihSaat(an);
}

// Açık görünümde her kayıt açıktır. Geçmiş görünümde kapatılma zamanı doluysa neden etiketi, boşsa
// (kapatılmadan süresi dolan oturum) 'Süresi doldu'; kolon gelmediyse boş işaret.
function durum(kayit: OturumKaydi, acik: boolean): string {
  if (acik) {
    return 'Açık';
  }
  if (kayit.kapatilmaZamani === undefined) {
    return BOS;
  }
  if (kayit.kapatilmaZamani === null) {
    return 'Süresi doldu';
  }
  const neden = kayit.kapatilmaNedeni;
  if (neden === undefined || neden === null) {
    return `Kapatıldı: ${BOS}`;
  }
  return `Kapatıldı: ${NEDENLER[neden] ?? neden}`;
}

// Satır başına yinelenen düğmenin erişilebilir adındaki oturum adı; kısaltılmış kimlik satırları
// ayırt eder.
function oturumAdi(kayit: OturumKaydi): string {
  const kisa = kimliginAdi(null, kayit.id);
  return kayit.baslangicZamani === undefined
    ? `${kisa} oturumu`
    : `${tarihSaat(kayit.baslangicZamani)} başlayan ${kisa} oturumu`;
}

export function OturumTablosu({
  liste,
  sorgu,
  buOturumId,
}: Readonly<{
  liste: Liste<OturumKaydi>;
  sorgu: OturumListesiSorgusu;
  buOturumId: string;
}>) {
  const { sirala, acik, kullaniciId } = sorgu;
  const acikGorunum = acik === 'true';
  // Kişi süzgeci yokken kayıtlar birden çok kişiye aitse kimin oturumu olduğu da gösterilir.
  const kisiler = new Set(liste.kayitlar.map((kayit) => kayit.kullaniciId));
  kisiler.delete(undefined);
  const kullaniciKolonu = kullaniciId === undefined && kisiler.size > 1;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Görünüm">
        <ul className="flex gap-4">
          {GORUNUMLER.map((gorunum) => (
            <li key={gorunum.acik}>
              <Link
                href={`${ADRES}${sorguMetni({ sirala, acik: gorunum.acik, kullaniciId })}`}
                aria-current={acik === gorunum.acik ? 'page' : undefined}
                className={BAGLANTI}
              >
                {gorunum.etiket}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ListeTablosu
        baslik="Oturumlar"
        liste={liste}
        basliklar={
          <>
            {kullaniciKolonu && (
              <th scope="col" className={`${HUCRE} text-left`}>
                Kullanıcı
              </th>
            )}
            <SiralamaBasligi
              adres={ADRES}
              kolon="baslangicZamani"
              etiket="Başlangıç"
              sirala={sirala}
              suzgec={{ acik, kullaniciId }}
            />
            <SiralamaBasligi
              adres={ADRES}
              kolon="sonDondurmeZamani"
              etiket="Son etkinlik"
              sirala={sirala}
              suzgec={{ acik, kullaniciId }}
            />
            <th scope="col" className={`${HUCRE} text-left`}>
              Adres
            </th>
            <th scope="col" className={`${HUCRE} text-left`}>
              Tarayıcı bilgisi
            </th>
            <th scope="col" className={`${HUCRE} text-left`}>
              Durum
            </th>
            {acikGorunum && (
              <th scope="col" className={`${HUCRE} text-left`}>
                İşler
              </th>
            )}
          </>
        }
      >
        {liste.kayitlar.map((kayit) => {
          const bu = kayit.id === buOturumId;
          return (
            <tr key={kayit.id} className="border-b border-gray-200">
              {kullaniciKolonu && (
                <td className={HUCRE}>
                  {kayit.kullaniciId === undefined ? (
                    BOS
                  ) : (
                    <Link href={`/kullanicilar/${kayit.kullaniciId}`} className={BAGLANTI}>
                      {kimliginAdi(null, kayit.kullaniciId)}
                    </Link>
                  )}
                </td>
              )}
              <td className={HUCRE}>{zaman(kayit.baslangicZamani)}</td>
              <td className={HUCRE}>{zaman(kayit.sonDondurmeZamani)}</td>
              <td className={HUCRE}>{kayit.ipAdresi ?? BOS}</td>
              <td className={HUCRE}>{kayit.tarayiciBilgisi ?? BOS}</td>
              <td className={HUCRE}>
                {durum(kayit, acikGorunum)}
                {bu && (
                  <>
                    {' '}
                    <strong className="rounded bg-blue-100 px-2 text-sm">Bu oturum</strong>
                  </>
                )}
              </td>
              {acikGorunum && (
                <td className={HUCRE}>
                  <OturumKapat kayit={kayit} bu={bu} oturum={oturumAdi(kayit)} />
                </td>
              )}
            </tr>
          );
        })}
      </ListeTablosu>

      <Sayfalama adres={ADRES} liste={liste} sorgu={{ sirala, acik, kullaniciId }} />
    </div>
  );
}
