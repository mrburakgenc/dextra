import { YetenekYazFormu } from '../../../../features/kimlik/yetenek/yetenek-formu';
import { yetenekSecenekleri } from '../../../../features/kimlik/yetenek/yetenek-listesi';
import { listeHatasi } from '../../../../shared/liste/liste-parcalari';
import { Can } from '../../../../shared/yetki/yetki-saglayici';

// Yetenek yaz (TS-004 "Yönetim ekranları"): form tür düzeyinde sorulur; son sözü backend söyler.
// Grup, rol ve izin seçimleri listelerden kurulur; biri alınamazsa form yerine ileti gösterilir, 401
// oturum bitti yoluna gider.
export default async function YeniYetenekSayfasi() {
  const sonuc = await yetenekSecenekleri();
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yeni yetenek</h1>
      <Can I="olustur" a="Yetenek">
        {sonuc.basarili ? (
          <YetenekYazFormu secenekler={sonuc.secenekler} />
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </Can>
      <Can not I="olustur" a="Yetenek">
        <p role="alert">Bu iş için yetkin yok</p>
      </Can>
    </main>
  );
}
