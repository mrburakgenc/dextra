import type {
  OturumDenetimiGirdisi,
  OturumDenetimiSonucu,
} from '../../../../shared/kimlik/oturum-denetimi.contract.js';
import type { DenetimSatiri } from './oturum-denetimi.repository.js';

// Hareketsizlik sınırı (TS-002 AK-9; KR-009 varsayılanı): son döndürmeden bu kadar sonra oturum açık
// sayılmaz. Proje ayarı sonra gelir.
export const HAREKETSIZLIK_SINIRI_MS = 30 * 60 * 1000;

// Okunan satırdan sonucu verir. Açık oturum (TS-002 "Veri modeli"): kapatılmamış, mutlak bitişi
// geçmemiş ve son döndürmesinden beri hareketsizlik sınırı dolmamış oturum. Adres yalnız öbür
// bakımlardan geçerli oturumda karşılaştırılır; yazma yalnız o dalda gerekir.
export function denetimSonucu(
  satir: DenetimSatiri | null,
  { ipAdresi, tarayiciBilgisi }: OturumDenetimiGirdisi,
  simdi: number,
): OturumDenetimiSonucu {
  if (satir === null) {
    return { gecerli: false, neden: 'yok' };
  }
  if (satir.kapali) {
    return { gecerli: false, neden: 'kapali' };
  }
  if (satir.kullaniciPasif || satir.sistemAktoru) {
    return { gecerli: false, neden: 'kullanici_pasif' };
  }
  if (
    satir.mutlakBitisZamani.getTime() <= simdi ||
    satir.sonDondurmeZamani.getTime() + HAREKETSIZLIK_SINIRI_MS <= simdi
  ) {
    return { gecerli: false, neden: 'suresi_doldu' };
  }
  if (
    satir.ipAdresi !== ipAdresi ||
    satir.tarayiciBilgisi !== tarayiciBilgisi
  ) {
    return { gecerli: false, neden: 'adres_degisti' };
  }
  return {
    gecerli: true,
    kullaniciId: satir.kullaniciId,
    kisiSurumu: satir.kisiSurumu,
    genelSurum: satir.genelSurum,
  };
}
