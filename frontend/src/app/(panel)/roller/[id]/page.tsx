import { KAYIT_BULUNAMADI } from '../../../../features/kimlik/is-hatasi';
import { kaydiGetir } from '../../../../features/kimlik/kayit-istegi';
import { KayitBasligi, KayitSatirlari } from '../../../../features/kimlik/kayit-satirlari';
import { RolIsleri } from '../../../../features/kimlik/rol/rol-isleri';
import { RolKaydi } from '../../../../features/kimlik/rol/rol-listesi';
import { BOS, listeHatasi } from '../../../../shared/liste/liste-parcalari';

// Rolün kaydı ve işleri (TS-004 "Yönetim ekranları"). 404 bulunamadı iletisi olur; 401 oturum
// bitti yoluna gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur. Silinmiş kayıtta
// iş gösterilmez.
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
          <p role="alert">{KAYIT_BULUNAMADI}</p>
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </main>
    );
  }
  const { kayit } = sonuc;
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <KayitBasligi baslik={kayit.ad ?? 'Rol'} silinmeZamani={kayit.silinmeZamani} />
      <KayitSatirlari
        satirlar={[
          { etiket: 'Ad', deger: kayit.ad ?? BOS },
          { etiket: 'Kod', deger: kayit.kod ?? BOS },
        ]}
      />
      {typeof kayit.silinmeZamani !== 'string' && <RolIsleri kayit={kayit} />}
    </main>
  );
}
