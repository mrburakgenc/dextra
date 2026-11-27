import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { cikisYap } from '../../features/kimlik/eylemler';
import { kimlikGerekliyseOturumuBitir } from '../../shared/backend/hata';
import { backendIstegi, ULASILAMIYOR } from '../../shared/backend/istek';
import { BAGLANTI } from '../../shared/liste/liste-parcalari';
import { erisimBelirteciniOku, yenilemeCerezleriVar } from '../../shared/oturum/cerezler';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';
import { YenidenDene } from '../../shared/ui/yeniden-dene';
import { Can, YetkiSaglayici } from '../../shared/yetki/yetki-saglayici';

// "yetkilerim" cevabının ekrana giden kısmı; yetenekId ekranda kullanılmadığı için atılır.
const YetkilerimCevabi = z.object({
  kurallar: z.array(
    z.object({
      action: z.string(),
      subject: z.string(),
      conditions: z.record(z.string(), z.unknown()).optional(),
      fields: z.array(z.string()).optional(),
      inverted: z.boolean().optional(),
    }),
  ),
});

// Menü bağlantıları; her biri o kaynakta o eylemi yapabilen kişiye görünür. Teşhis yalnız
// Yetenek:teshis izni olana görünür (TS-008 "Yönetim, izinler ve teşhis").
const MENU = [
  {
    etiket: 'Kullanıcılar',
    adres: '/kullanicilar',
    kaynak: 'Kullanici',
    eylem: 'oku',
  },
  { etiket: 'Roller', adres: '/roller', kaynak: 'Rol', eylem: 'oku' },
  { etiket: 'Gruplar', adres: '/gruplar', kaynak: 'Grup', eylem: 'oku' },
  { etiket: 'İzinler', adres: '/izinler', kaynak: 'Izin', eylem: 'oku' },
  {
    etiket: 'Yetenekler',
    adres: '/yetenekler',
    kaynak: 'Yetenek',
    eylem: 'oku',
  },
  { etiket: 'Oturumlar', adres: '/oturumlar', kaynak: 'Oturum', eylem: 'oku' },
  { etiket: 'Teşhis', adres: '/teshis', kaynak: 'Yetenek', eylem: 'teshis' },
] as const;

// Korumalı düzen: erişim çerezi yoksa backend'e gidilmeden giriş ekranına dönülür. Bu bir
// kolaylıktır, güvenlik denetimi değildir; kararı backend verir (TS-004). Kişinin yetki
// kuralları her sayfa isteğinde sunucuda çekilir ve istemcideki yetki sağlayıcısına verilir.
// Yenilenemeyen oturum (TS-004 "Oturumun yenilenmesi"): erişim çerezi yokken yenileme ve cihaz
// çerezi duruyorsa ara katman backend'e ulaşamamıştır; kişi girişe gitmez, backend'e gidilmeden
// ileti ve aynı adrese tam sayfa yüklemesiyle giden 'Yeniden dene' bağlantısı gösterilir.
export default async function PanelDuzeni({
  children,
}: Readonly<{ children: ReactNode }>) {
  if ((await erisimBelirteciniOku()) === undefined) {
    if (await yenilemeCerezleriVar()) {
      return (
        <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
          <p role="alert">{ULASILAMIYOR}</p>
          <p>
            <YenidenDene className={BAGLANTI} />
          </p>
        </main>
      );
    }
    redirect('/giris');
  }
  const sonuc = await backendIstegi({
    yol: '/kimlik/oturum/yetkilerim',
    yontem: 'GET',
    oturumlu: true,
  });
  let icerik: ReactNode;
  // Hatada kural yoktur; menüdeki bağlantılar görünmez.
  let kurallar: z.infer<typeof YetkilerimCevabi>['kurallar'] = [];
  // Sözleşmeye uymayan başarı cevabı ulaşılamadı gibi gösterilir; düzen fırlatmaz.
  const okunan = sonuc.basarili ? YetkilerimCevabi.safeParse(sonuc.govde) : null;
  if (okunan?.success === true) {
    kurallar = okunan.data.kurallar;
    icerik = children;
  } else {
    // 401 çerezleri silen /oturum-bitti yoluna gider; öbür hatalarda (ulaşılamadı dahil)
    // içerik yerine ileti gösterilir ve çerezler silinmez.
    if (!sonuc.basarili) {
      kimlikGerekliyseOturumuBitir(sonuc.hata);
    }
    icerik = (
      <main id="ana-icerik" className="mx-auto max-w-2xl p-8">
        <p role="alert">{sonuc.basarili ? ULASILAMIYOR : sonuc.hata.ileti}</p>
      </main>
    );
  }
  // Menünün her bağlantısı <Can> ile tür düzeyinde sorulur (TS-004 "Yönetim ekranları").
  return (
    <YetkiSaglayici kurallar={kurallar}>
      <header className="flex items-center justify-between border-b border-gray-300 px-8 py-4">
        <p className="text-xl font-bold">Dextra</p>
        <nav aria-label="Ana menü">
          <ul className="flex gap-4">
            {MENU.map((oge) => (
              <Can key={oge.adres} I={oge.eylem} a={oge.kaynak}>
                <li>
                  <Link
                    href={oge.adres}
                    className="text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    {oge.etiket}
                  </Link>
                </li>
              </Can>
            ))}
          </ul>
        </nav>
        {/* Parolamı değiştir oturumu olan herkesin işidir; yetenek aramaz (TS-004). */}
        <div className="flex items-center gap-4">
          <Link href="/parola" className={BAGLANTI}>
            Parolamı değiştir
          </Link>
          <form action={cikisYap}>
            <GonderDugmesi>Çıkış</GonderDugmesi>
          </form>
        </div>
      </header>
      {icerik}
    </YetkiSaglayici>
  );
}
