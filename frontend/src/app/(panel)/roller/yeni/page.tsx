import { YETKI_YOK } from '../../../../features/kimlik/is-hatasi';
import { RolOlusturFormu } from '../../../../features/kimlik/rol/rol-olustur-formu';
import { Can } from '../../../../shared/yetki/yetki-saglayici';

// Rol oluştur (TS-004 "Yönetim ekranları"): form tür düzeyinde sorulur; son sözü backend söyler.
export default function YeniRolSayfasi() {
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yeni rol</h1>
      <Can I="olustur" a="Rol">
        <RolOlusturFormu />
      </Can>
      <Can not I="olustur" a="Rol">
        <p role="alert">{YETKI_YOK}</p>
      </Can>
    </main>
  );
}
