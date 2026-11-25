import type { ReactNode } from 'react';
import { KAYIT_BULUNAMADI } from '../../../../features/kimlik/is-hatasi';
import { kaydiGetir } from '../../../../features/kimlik/kayit-istegi';
import { KayitBasligi, KayitSatirlari } from '../../../../features/kimlik/kayit-satirlari';
import {
  adHaritasi,
  kayitSiniri,
  kolonSiniri,
  yetenekTuru,
} from '../../../../features/kimlik/yetenek/yetenek-bicimi';
import { YetenekIsleri } from '../../../../features/kimlik/yetenek/yetenek-isleri';
import {
  YetenekKaydi,
  yetenekSecenekleri,
} from '../../../../features/kimlik/yetenek/yetenek-listesi';
import { tarihSaat } from '../../../../shared/bicim/bicim';
import { BOS, kimliginAdi, listeHatasi } from '../../../../shared/liste/liste-parcalari';

function Kabuk({
  children,
  silinmeZamani,
}: Readonly<{ children: ReactNode; silinmeZamani?: string | null | undefined }>) {
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <KayitBasligi baslik="Yetenek" silinmeZamani={silinmeZamani} />
      {children}
    </main>
  );
}

function evetHayir(deger: boolean | undefined): string {
  if (deger === undefined) {
    return BOS;
  }
  return deger ? 'Evet' : 'Hayır';
}

// Yeteneğin kaydı ve işleri (TS-004 "Yönetim ekranları"); kayıt listedeki yazımla gösterilir. 404
// bulunamadı iletisi olur; 401 oturum bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki
// gibi ileti olur. Grup, rol ve izin adları listelerden okunur; liste alınamazsa kayıt yine çizilir
// ve adı bilinmeyen kimlik kısaltılır. Silinmiş kayıtta iş gösterilmez.
export default async function YetenekSayfasi({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [sonuc, secenekler] = await Promise.all([
    kaydiGetir('yetenek', id, YetenekKaydi),
    yetenekSecenekleri(),
  ]);
  if (!sonuc.basarili) {
    return (
      <Kabuk>
        {sonuc.hata.kod === 'bulunamadi' ? (
          <p role="alert">{KAYIT_BULUNAMADI}</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </Kabuk>
    );
  }
  const { kayit } = sonuc;
  const { gruplar, roller, izinler } = secenekler;
  return (
    <Kabuk silinmeZamani={kayit.silinmeZamani}>
      <KayitSatirlari
        kayit={kayit}
        satirlar={[
          {
            etiket: 'Grup',
            alanlar: ['grupId'],
            deger: kimliginAdi(adHaritasi(gruplar), kayit.grupId),
          },
          { etiket: 'Rol', alanlar: ['rolId'], deger: kimliginAdi(adHaritasi(roller), kayit.rolId) },
          {
            etiket: 'İzin',
            alanlar: ['izinId'],
            deger: kimliginAdi(adHaritasi(izinler), kayit.izinId),
          },
          {
            etiket: 'Kayıt sınırı',
            alanlar: ['butunKayitlar', 'sart'],
            deger: kayitSiniri(kayit.butunKayitlar, kayit.sart),
          },
          {
            etiket: 'Bütün birimler',
            alanlar: ['butunBirimler'],
            deger: evetHayir(kayit.butunBirimler),
          },
          {
            etiket: 'Kolon sınırı',
            alanlar: ['butunKolonlar', 'kolonlar'],
            deger: kolonSiniri(kayit.butunKolonlar, kayit.kolonlar),
          },
          {
            etiket: 'Tür',
            alanlar: ['sistemSatiri', 'tohumAnahtari'],
            deger: yetenekTuru(kayit.sistemSatiri, kayit.tohumAnahtari),
          },
          {
            etiket: 'Oluşturma zamanı',
            alanlar: ['olusturmaZamani'],
            deger:
              kayit.olusturmaZamani === undefined ? BOS : tarihSaat(kayit.olusturmaZamani),
          },
        ]}
      />
      {typeof kayit.silinmeZamani !== 'string' && <YetenekIsleri kayit={kayit} />}
    </Kabuk>
  );
}
