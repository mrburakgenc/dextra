import { GrupIsleri } from '../../../../features/kimlik/grup/grup-isleri';
import { GrupKaydi, ustGrupSecenekleri } from '../../../../features/kimlik/grup/grup-listesi';
import { KAYIT_BULUNAMADI } from '../../../../features/kimlik/is-hatasi';
import { kaydiGetir } from '../../../../features/kimlik/kayit-istegi';
import { KayitBasligi, KayitSatirlari } from '../../../../features/kimlik/kayit-satirlari';
import { kimlikGerekliyseOturumuBitir } from '../../../../shared/backend/hata';
import { tarihSaat } from '../../../../shared/bicim/bicim';
import { BOS, kimliginAdi, listeHatasi } from '../../../../shared/liste/liste-parcalari';

// Grubun kaydı ve işleri (TS-004 "Yönetim ekranları"). 404 bulunamadı iletisi olur; 401 oturum
// bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur. Taşı için üst grup
// seçimi grup listesinden kurulur; üst grubun adı da oradan okunur, listede yoksa ya da liste
// alınamazsa kimlik kısaltılarak gösterilir. Liste alınamazsa taşı yerine ileti çıkar (TS-004
// "Yönetim formlarının sertleştirilmesi"). Silinmiş kayıtta iş gösterilmez.
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
          <p role="alert">{KAYIT_BULUNAMADI}</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </main>
    );
  }
  const { kayit } = sonuc;
  const liste = await ustGrupSecenekleri();
  if (!liste.basarili) {
    kimlikGerekliyseOturumuBitir(liste.hata);
  }
  const secenekler = liste.basarili ? liste.secenekler : null;
  const adlar =
    secenekler === null
      ? null
      : new Map(secenekler.gruplar.map((grup) => [grup.id, grup.etiket]));
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <KayitBasligi baslik={kayit.ad ?? 'Grup'} silinmeZamani={kayit.silinmeZamani} />
      <KayitSatirlari
        kayit={kayit}
        satirlar={[
          { etiket: 'Ad', alanlar: ['ad'], deger: kayit.ad ?? BOS },
          { etiket: 'Üst grup', alanlar: ['ustGrupId'], deger: kimliginAdi(adlar, kayit.ustGrupId) },
          {
            etiket: 'Oluşturma zamanı',
            alanlar: ['olusturmaZamani'],
            deger:
              kayit.olusturmaZamani === undefined ? BOS : tarihSaat(kayit.olusturmaZamani),
          },
        ]}
      />
      {typeof kayit.silinmeZamani !== 'string' && (
        <GrupIsleri kayit={kayit} secenekler={secenekler} />
      )}
    </main>
  );
}
