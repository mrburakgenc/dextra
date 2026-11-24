import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { cikisYap } from '../../features/kimlik/eylemler';
import { kimlikGerekliyseOturumuBitir } from '../../shared/backend/hata';
import { backendIstegi } from '../../shared/backend/istek';
import { erisimBelirteciniOku } from '../../shared/oturum/cerezler';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { YetkiSaglayici } from '../../shared/yetki/yetki-saglayici';

// "yetkilerim" cevabının ekrana giden kısmı; yetenekId ekranda kullanılmadığı için atılır.
const YetkilerimCevabi = z.object({
  kurallar: z.array(
    z.object({
      action: z.string(),
      subject: z.string(),
      conditions: z.record(z.string(), z.unknown()).optional(),
      fields: z.array(z.string()).optional(),
    }),
  ),
});

// Korumalı düzen: erişim çerezi yoksa backend'e gidilmeden giriş ekranına dönülür. Bu bir
// kolaylıktır, güvenlik denetimi değildir; kararı backend verir (TS-004). Kişinin yetki
// kuralları her sayfa isteğinde sunucuda çekilir ve istemcideki yetki sağlayıcısına verilir.
export default async function PanelDuzeni({
  children,
}: Readonly<{ children: ReactNode }>) {
  if ((await erisimBelirteciniOku()) === undefined) {
    redirect('/giris');
  }
  const sonuc = await backendIstegi({
    yol: '/kimlik/oturum/yetkilerim',
    yontem: 'GET',
    oturumlu: true,
  });
  let icerik: ReactNode;
  if (sonuc.basarili) {
    const { kurallar } = YetkilerimCevabi.parse(sonuc.govde);
    icerik = <YetkiSaglayici kurallar={kurallar}>{children}</YetkiSaglayici>;
  } else {
    // 401 çerezleri silen /oturum-bitti yoluna gider; öbür hatalarda (ulaşılamadı dahil)
    // içerik yerine ileti gösterilir ve çerezler silinmez.
    kimlikGerekliyseOturumuBitir(sonuc.hata);
    icerik = (
      <main id="ana-icerik" className="mx-auto max-w-2xl p-8">
        <p role="alert">{sonuc.hata.ileti}</p>
      </main>
    );
  }
  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-300 px-8 py-4">
        <p className="text-xl font-bold">Dextra</p>
        <form action={cikisYap}>
          <GonderDugmesi>Çıkış</GonderDugmesi>
        </form>
      </header>
      {icerik}
    </>
  );
}
