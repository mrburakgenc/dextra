import { GrupIsleri } from '../../../../features/kimlik/grup/grup-isleri';
import { GrupKaydi, ustGrupSecenekleri } from '../../../../features/kimlik/grup/grup-listesi';
import { kaydiGetir } from '../../../../features/kimlik/kayit-istegi';
import { KayitSatirlari } from '../../../../features/kimlik/kayit-satirlari';
import { tarihSaat } from '../../../../shared/bicim/bicim';
import { BOS, listeHatasi } from '../../../../shared/liste/liste-parcalari';

// Grubun kaydı ve işleri (TS-004 "Yönetim ekranları"). 404 'Kayıt bulunamadı' olur; 401 oturum
// bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur. Taşı için üst grup
// seçimi grup listesinden kurulur; üst grubun adı da oradan okunur, listede yoksa boş işaret
// gösterilir. Liste alınamazsa taşı yerine liste hatası gösterilir.
export default async function GrupSayfasi({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const sonuc = await kaydiGetir('grup', id, GrupKaydi);
  if (!sonuc.basarili) {
    return (
      <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <h1 className="text-3xl font-bold">Grup</h1>
        {sonuc.hata.kod === 'bulunamadi' ? (
          <p role="alert">Kayıt bulunamadı</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </main>
    );
  }
  const { kayit } = sonuc;
  const liste = await ustGrupSecenekleri();
  const secenekler = liste.basarili ? liste.secenekler : null;
  const ustGrup = secenekler?.gruplar.find((grup) => grup.id === kayit.ustGrupId);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">{kayit.ad ?? 'Grup'}</h1>
      <KayitSatirlari
        satirlar={[
          { etiket: 'Ad', deger: kayit.ad ?? BOS },
          { etiket: 'Üst grup', deger: ustGrup?.etiket ?? BOS },
          {
            etiket: 'Oluşturma zamanı',
            deger:
              kayit.olusturmaZamani === undefined ? BOS : tarihSaat(kayit.olusturmaZamani),
          },
        ]}
      />
      <GrupIsleri kayit={kayit} secenekler={secenekler} />
      {!liste.basarili && listeHatasi(liste.hata)}
    </main>
  );
}
