import type { ReactNode } from 'react';
import { kaydiGetir } from '../../../../features/kimlik/kayit-istegi';
import { KayitSatirlari } from '../../../../features/kimlik/kayit-satirlari';
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
import { BOS, listeHatasi } from '../../../../shared/liste/liste-parcalari';

function Kabuk({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yetenek</h1>
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
// 'Kayıt bulunamadı' olur; 401 oturum bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki
// gibi ileti olur. Grup, rol ve izin adları listelerden okunur.
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
          <p role="alert">Kayıt bulunamadı</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </Kabuk>
    );
  }
  if (!secenekler.basarili) {
    return <Kabuk>{listeHatasi(secenekler.hata)}</Kabuk>;
  }
  const { kayit } = sonuc;
  const { gruplar, roller, izinler } = secenekler.secenekler;
  return (
    <Kabuk>
      <KayitSatirlari
        satirlar={[
          { etiket: 'Grup', deger: adHaritasi(gruplar).get(kayit.grupId) ?? BOS },
          { etiket: 'Rol', deger: adHaritasi(roller).get(kayit.rolId) ?? BOS },
          { etiket: 'İzin', deger: adHaritasi(izinler).get(kayit.izinId) ?? BOS },
          { etiket: 'Kayıt sınırı', deger: kayitSiniri(kayit.butunKayitlar, kayit.sart) },
          { etiket: 'Bütün birimler', deger: evetHayir(kayit.butunBirimler) },
          { etiket: 'Kolon sınırı', deger: kolonSiniri(kayit.butunKolonlar, kayit.kolonlar) },
          { etiket: 'Tür', deger: yetenekTuru(kayit.sistemSatiri, kayit.tohumAnahtari) },
          {
            etiket: 'Oluşturma zamanı',
            deger:
              kayit.olusturmaZamani === undefined ? BOS : tarihSaat(kayit.olusturmaZamani),
          },
        ]}
      />
      <YetenekIsleri kayit={kayit} />
    </Kabuk>
  );
}
