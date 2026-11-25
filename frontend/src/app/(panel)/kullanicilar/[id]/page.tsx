import { KullaniciIsleri } from '../../../../features/kimlik/kullanici-isleri';
import { kullaniciyiGetir } from '../../../../features/kimlik/kullanici-kaydi';
import { KullaniciKaydiGorunumu } from '../../../../features/kimlik/kullanici-kaydi-gorunumu';
import { listeHatasi } from '../../../../shared/liste/liste-parcalari';

// Kullanıcının kaydı ve işleri (TS-004 "Yönetim ekranları"). 404 'Kayıt bulunamadı' olur; 401
// oturum bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur.
export default async function KullaniciSayfasi({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const sonuc = await kullaniciyiGetir(id);
  if (!sonuc.basarili) {
    return (
      <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <h1 className="text-3xl font-bold">Kullanıcı</h1>
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
      <h1 className="text-3xl font-bold">{kayit.gorunenAd ?? 'Kullanıcı'}</h1>
      <KullaniciKaydiGorunumu kayit={kayit} />
      <KullaniciIsleri kayit={kayit} />
    </main>
  );
}
