import { kaydiGetir } from '../../../../features/kimlik/kayit-istegi';
import { KayitSatirlari } from '../../../../features/kimlik/kayit-satirlari';
import { RolIsleri } from '../../../../features/kimlik/rol/rol-isleri';
import { RolKaydi } from '../../../../features/kimlik/rol/rol-listesi';
import { BOS, listeHatasi } from '../../../../shared/liste/liste-parcalari';

// Rolün kaydı ve işleri (TS-004 "Yönetim ekranları"). 404 'Kayıt bulunamadı' olur; 401 oturum
// bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur.
export default async function RolSayfasi({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const sonuc = await kaydiGetir('rol', id, RolKaydi);
  if (!sonuc.basarili) {
    return (
      <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <h1 className="text-3xl font-bold">Rol</h1>
        {sonuc.hata.kod === 'bulunamadi' ? (
          <p role="alert">Kayıt bulunamadı</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </main>
    );
  }
  const { kayit } = sonuc;
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">{kayit.ad ?? 'Rol'}</h1>
      <KayitSatirlari
        satirlar={[
          { etiket: 'Ad', deger: kayit.ad ?? BOS },
          { etiket: 'Kod', deger: kayit.kod ?? BOS },
        ]}
      />
      <RolIsleri kayit={kayit} />
    </main>
  );
}
