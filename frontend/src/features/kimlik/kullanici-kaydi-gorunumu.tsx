import { tarihSaat } from '../../shared/bicim/bicim';
import { BOS } from '../../shared/liste/liste-parcalari';
import type { KullaniciKaydi } from './kullanici-kaydi';

// Kaydın kolonları (TS-004 "Yönetim ekranları"): gelmeyen (kişinin göremediği) ya da boş kolon
// boş işaretle gösterilir; ekran onu istemez ve tahmin etmez. Sunucu bileşenidir.

function zaman(an: string | null | undefined): string {
  return an === undefined || an === null ? BOS : tarihSaat(an);
}

function durum(pasifZamani: KullaniciKaydi['pasifZamani']): string {
  if (pasifZamani === undefined) {
    return BOS;
  }
  return pasifZamani === null ? 'Etkin' : `Pasif (${tarihSaat(pasifZamani)})`;
}

function evetHayir(deger: boolean | undefined): string {
  if (deger === undefined) {
    return BOS;
  }
  return deger ? 'Evet' : 'Hayır';
}

export function KullaniciKaydiGorunumu({ kayit }: Readonly<{ kayit: KullaniciKaydi }>) {
  const satirlar = [
    { etiket: 'Kullanıcı adı', deger: kayit.kullaniciAdi ?? BOS },
    { etiket: 'Görünen ad', deger: kayit.gorunenAd ?? BOS },
    { etiket: 'Telefon', deger: kayit.telefon ?? BOS },
    { etiket: 'Sistem aktörü', deger: evetHayir(kayit.sistemAktoru) },
    { etiket: 'Durum', deger: durum(kayit.pasifZamani) },
    { etiket: 'Unutulma zamanı', deger: zaman(kayit.unutulmaZamani) },
    { etiket: 'Oluşturma zamanı', deger: zaman(kayit.olusturmaZamani) },
  ];
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      {satirlar.map((satir) => (
        <div key={satir.etiket} className="contents">
          <dt className="font-medium">{satir.etiket}</dt>
          <dd>{satir.deger}</dd>
        </div>
      ))}
    </dl>
  );
}
