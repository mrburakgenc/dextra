import type { ReactNode } from 'react';
import { AlinamayanListeler } from '../../../features/kimlik/alinamayan-listeler';
import { KAYIT_BULUNAMADI } from '../../../features/kimlik/is-hatasi';
import {
  semaAlanHatalari,
  TeshisSemasi,
} from '../../../features/kimlik/semalar';
import {
  teshisIzinleri,
  yetenekTeshisi,
} from '../../../features/kimlik/yetenek/yetenek-teshisi';
import {
  TeshisFormu,
  TeshisSonucu,
} from '../../../features/kimlik/yetenek/yetenek-teshisi-gorunumu';
import { alanHatalari } from '../../../shared/backend/hata';
import { listeHatasi, YETKI_YOK } from '../../../shared/liste/liste-parcalari';
import { Can } from '../../../shared/yetki/yetki-saglayici';

function tekDeger(deger: string | string[] | undefined): string | undefined {
  return typeof deger === 'string' ? deger : undefined;
}

// Backend'in kaynak ve eylem hatası formda izin seçiminin altında gösterilir.
function formAlani(alan: string): string {
  return alan === 'kaynak' || alan === 'eylem' ? 'izin' : alan;
}

// Teşhis (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-14, AU-19 ve AU-32): sayfa Yetenek:teshis
// iznini tür düzeyinde sorar; son sözü backend söyler. Sorgu adresin sorgusundadır: alanlardan biri
// bile adreste varsa sorgu ekranın şemasıyla doğrulanır; hatalı alan formda gösterilir ve teşhis
// backend'e sorulmaz. İzin seçimi izin kataloğundan kurulur; alınamazsa form yerine ileti çıkar.
// Backend'in doğrulama hatası alanlara dağılır; 404 bulunamadı iletisi olur; 401 oturum bitti yoluna
// gider; 403 ve öbür hatalar liste ekranlarındaki gibi ileti olur.
export default async function TeshisSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const sorgu = await searchParams;
  const degerler = {
    kullaniciId: tekDeger(sorgu['kullaniciId']),
    izin: tekDeger(sorgu['izin']),
    kayitId: tekDeger(sorgu['kayitId']),
  };
  const girdi = Object.values(degerler).some((deger) => deger !== undefined)
    ? TeshisSemasi.safeParse(degerler)
    : undefined;
  const [izinler, sonuc] = await Promise.all([
    teshisIzinleri(),
    girdi?.success === true ? yetenekTeshisi(girdi.data) : undefined,
  ]);
  let hatalar = girdi?.success === false ? semaAlanHatalari(girdi.error) : {};
  let icerik: ReactNode = null;
  if (sonuc?.basarili === true) {
    icerik = <TeshisSonucu cevap={sonuc.kayit} />;
  } else if (sonuc !== undefined) {
    const backendHatalari = Object.entries(alanHatalari(sonuc.hata));
    if (sonuc.hata.kod === 'bulunamadi') {
      icerik = <p role="alert">{KAYIT_BULUNAMADI}</p>;
    } else if (backendHatalari.length > 0) {
      hatalar = Object.fromEntries(
        backendHatalari.map(([alan, neden]) => [formAlani(alan), neden]),
      );
    } else {
      icerik = listeHatasi(sonuc.hata);
    }
  }
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Teşhis</h1>
      <Can I="teshis" a="Yetenek">
        <>
          {izinler === null ? (
            <AlinamayanListeler listeler={{ İzin: null }} />
          ) : (
            <TeshisFormu
              izinler={izinler}
              degerler={degerler}
              alanHatalari={hatalar}
            />
          )}
          {icerik}
        </>
      </Can>
      <Can not I="teshis" a="Yetenek">
        <p role="alert">{YETKI_YOK}</p>
      </Can>
    </main>
  );
}
