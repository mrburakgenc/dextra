import { KAYIT_BULUNAMADI } from '../../../../features/kimlik/is-hatasi';
import { KullaniciIsleri } from '../../../../features/kimlik/kullanici-isleri';
import { kullaniciyiGetir } from '../../../../features/kimlik/kullanici-kaydi';
import { KullaniciKaydiGorunumu } from '../../../../features/kimlik/kullanici-kaydi-gorunumu';
import { uyelikleriGetir } from '../../../../features/kimlik/uyelik/uyelik-listesi';
import { Uyelikler } from '../../../../features/kimlik/uyelik/uyelikler';
import { listeHatasi } from '../../../../shared/liste/liste-parcalari';
import { Can } from '../../../../shared/yetki/yetki-saglayici';

// Kullanıcının kaydı ve işleri (TS-004 "Yönetim ekranları"). 404 bulunamadı iletisi olur; 401
// oturum bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur. Üyelikler
// bölümü yalnız Uyelik kaynağını okuyabilen kişiye görünür; üyelik listesi alınamazsa bölümde ileti
// gösterilir, grup ya da rol listesi alınamazsa bölüm yine çizilir.
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
          <p role="alert">{KAYIT_BULUNAMADI}</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </main>
    );
  }
  const { kayit } = sonuc;
  const uyelikler = await uyelikleriGetir(kayit.id);
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">{kayit.gorunenAd ?? 'Kullanıcı'}</h1>
      <KullaniciKaydiGorunumu kayit={kayit} />
      <KullaniciIsleri kayit={kayit} />
      <Can I="oku" a="Uyelik">
        <section aria-labelledby="uyelikler-baslik" className="flex flex-col gap-4">
          <h2 id="uyelikler-baslik" className="text-2xl font-bold">
            Üyelikler
          </h2>
          {uyelikler.basarili ? (
            <Uyelikler kullaniciId={kayit.id} veri={uyelikler.uyelikler} />
          ) : (
            listeHatasi(uyelikler.hata)
          )}
        </section>
      </Can>
    </main>
  );
}
