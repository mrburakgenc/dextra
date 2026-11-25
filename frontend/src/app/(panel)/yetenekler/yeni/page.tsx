import { AlinamayanListeler } from '../../../../features/kimlik/alinamayan-listeler';
import { YETKI_YOK } from '../../../../features/kimlik/is-hatasi';
import { YetenekYazFormu } from '../../../../features/kimlik/yetenek/yetenek-formu';
import { yetenekSecenekleri } from '../../../../features/kimlik/yetenek/yetenek-listesi';
import { Can } from '../../../../shared/yetki/yetki-saglayici';

// Yetenek yaz (TS-004 "Yönetim ekranları"): form tür düzeyinde sorulur; son sözü backend söyler.
// Grup, rol ve izin seçimleri listelerden kurulur; biri alınamazsa form yerine hangi listenin
// alınamadığını söyleyen ileti gösterilir (TS-004 "Yönetim formlarının sertleştirilmesi"), 401
// oturum bitti yoluna gider.
export default async function YeniYetenekSayfasi() {
  const { gruplar, roller, izinler } = await yetenekSecenekleri();
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yeni yetenek</h1>
      <Can I="olustur" a="Yetenek">
        {gruplar !== null && roller !== null && izinler !== null ? (
          <YetenekYazFormu secenekler={{ gruplar, roller, izinler }} />
        ) : (
          <AlinamayanListeler listeler={{ Grup: gruplar, Rol: roller, İzin: izinler }} />
        )}
      </Can>
      <Can not I="olustur" a="Yetenek">
        <p role="alert">{YETKI_YOK}</p>
      </Can>
    </main>
  );
}
