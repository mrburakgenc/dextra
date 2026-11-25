import { z } from 'zod';
import { GrupOlusturFormu } from '../../../../features/kimlik/grup/grup-olustur-formu';
import { ustGrupSecenekleri } from '../../../../features/kimlik/grup/grup-listesi';
import { listeHatasi } from '../../../../shared/liste/liste-parcalari';
import { Can } from '../../../../shared/yetki/yetki-saglayici';

// Adresteki ustGrupId seçimde ön seçili gelir; geçersiz değer yok sayılır.
const YeniGrupSorgusu = z.object({ ustGrupId: z.uuid().optional().catch(undefined) });

// Grup oluştur (TS-004 "Yönetim ekranları"): form tür düzeyinde sorulur; son sözü backend söyler.
// Üst grup seçimi grup listesinden kurulur; liste alınamazsa form yerine ileti gösterilir, 401
// oturum bitti yoluna gider.
export default async function YeniGrupSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { ustGrupId } = YeniGrupSorgusu.parse(await searchParams);
  const sonuc = await ustGrupSecenekleri();
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Yeni grup</h1>
      <Can I="olustur" a="Grup">
        {sonuc.basarili ? (
          <GrupOlusturFormu secenekler={sonuc.secenekler} ustGrupId={ustGrupId} />
        ) : (
          listeHatasi(sonuc.hata)
        )}
      </Can>
      <Can not I="olustur" a="Grup">
        <p role="alert">Bu iş için yetkin yok</p>
      </Can>
    </main>
  );
}
