import { tarihSaat } from '../../shared/bicim/bicim';
import { BOS } from '../../shared/liste/liste-parcalari';
import { KayitSatirlari } from './kayit-satirlari';
import type { KullaniciKaydi } from './kullanici-kaydi';

// Kaydın kolonları (TS-004 "Yönetim ekranları"): gelmeyen (kişinin göremediği) kolonun satırı
// çizilmez, gelmiş boş kolon boş işaretle gösterilir; ekran gelmeyeni istemez ve tahmin etmez.
// Sunucu bileşenidir.

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
  return (
    <KayitSatirlari
      kayit={kayit}
      satirlar={[
        { etiket: 'Kullanıcı adı', alanlar: ['kullaniciAdi'], deger: kayit.kullaniciAdi ?? BOS },
        { etiket: 'Görünen ad', alanlar: ['gorunenAd'], deger: kayit.gorunenAd ?? BOS },
        { etiket: 'Telefon', alanlar: ['telefon'], deger: kayit.telefon ?? BOS },
        {
          etiket: 'Sistem aktörü',
          alanlar: ['sistemAktoru'],
          deger: evetHayir(kayit.sistemAktoru),
        },
        { etiket: 'Durum', alanlar: ['pasifZamani'], deger: durum(kayit.pasifZamani) },
        {
          etiket: 'Unutulma zamanı',
          alanlar: ['unutulmaZamani'],
          deger: zaman(kayit.unutulmaZamani),
        },
        {
          etiket: 'Oluşturma zamanı',
          alanlar: ['olusturmaZamani'],
          deger: zaman(kayit.olusturmaZamani),
        },
      ]}
    />
  );
}
