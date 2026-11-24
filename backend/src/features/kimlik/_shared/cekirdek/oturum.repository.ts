// Çekirdek repository: oturum tablosuna yetki kapısından geçmeden erişir (KR-010 Seçim 48'in adıyla
// istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';

// Saklanan kapatılma nedenleri (TS-002 "Veri modeli").
export type KapatilmaNedeni =
  | 'cikis'
  | 'sahibi_kapatti'
  | 'yonetici'
  | 'pasife_alma'
  | 'parola_degisimi'
  | 'giris_bilgisi_degisti'
  | 'yetki_yukseltme'
  | 'sure'
  | 'yeniden_kullanim'
  | 'tutarsiz_nesil'
  | 'oturum_siniri'
  | 'adres_degisti'
  | 'cihaz_uymadi'
  | 'yontem_kapandi'
  | 'unutma';

export interface KapananOturum {
  id: string;
  kapatilmaZamani: Date;
}

export interface OturumCekirdekRepo {
  // Kişinin kapatılmamış bütün oturumlarını verilen nedenle kapatır ve kapananları döner.
  hepsiniKapat(
    kullaniciId: string,
    neden: KapatilmaNedeni,
  ): Promise<KapananOturum[]>;
}

export const OTURUM_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  OturumCekirdekRepo
>('OturumCekirdekRepo');

export function oturumCekirdekRepo(istemci: RepoIstemcisi): OturumCekirdekRepo {
  return {
    // Kapatılma zamanını uygulama saati verir (TS-002 AK-21): çağrı başına tek zaman, aynı çağrıda
    // kapanan bütün oturumlar onu alır. Dönen satırlar yalnız bu deyimin güncellediklerdir.
    hepsiniKapat: async (kullaniciId, neden) => {
      const kapatilmaZamani = new Date();
      const kapananlar = await istemci.oturum.updateManyAndReturn({
        where: { kullaniciId, kapatilmaZamani: null },
        data: { kapatilmaZamani, kapatilmaNedeni: neden },
        select: { id: true },
      });
      return kapananlar.map(({ id }) => ({ id, kapatilmaZamani }));
    },
  };
}
