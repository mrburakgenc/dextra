import { YETKI_YOK } from '../../../../features/kimlik/is-hatasi';
import { KullaniciAcFormu } from '../../../../features/kimlik/kullanici-ac-formu';
import { Can } from '../../../../shared/yetki/yetki-saglayici';

// Kullanıcı aç (TS-004 "Yönetim ekranları"): form tür düzeyinde sorulur; son sözü backend söyler.
export default function YeniKullaniciSayfasi() {
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yeni kullanıcı</h1>
      <Can I="olustur" a="Kullanici">
        <KullaniciAcFormu />
      </Can>
      <Can not I="olustur" a="Kullanici">
        <p role="alert">{YETKI_YOK}</p>
      </Can>
    </main>
  );
}
