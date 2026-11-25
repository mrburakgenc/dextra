// Giriş yöntemi sözleşmesi (TS-002 "Yapı"; KR-009 Seçim 3 ve 10): kimlik'in oturum çekirdeği tüketir,
// kimlik ve proje uygular. Ortak kodda durur, çünkü projenin kendi yöntemi başka bir feature'da yaşar.
// İki adımlı yöntemin başlatma adımı (kod iste) kodla giriş yazılırken eklenir.
import type { z } from 'zod';
import type { Islem } from '../../database/domain/islem.js';
import type {
  GirisDogrulamaSonucu,
  GirisKesinlestirmeSonucu,
} from '../domain/i-giris-yontemi.contract.js';

export interface GirisYontemi<TGirdi> {
  // Oturum satırına yazılan yöntem adı: 'parola', 'tek_kullanimlik_kod' ya da projenin yöntemi.
  readonly ad: string;
  readonly dogrulaSemasi: z.ZodType<TGirdi>;
  // İşlemin dışında koşar; oturum açmaz, kişiyi kilitlemez. Kişinin etkin olduğuna çekirdek bakar.
  dogrula(girdi: TGirdi): Promise<GirisDogrulamaSonucu>;
  // Kişinin kilidi altında, oturumla aynı işlemde kısa bir denetim ya da tek bir yazmadır.
  kesinlestir(
    islem: Islem,
    kullaniciId: string,
    kanit: string,
  ): Promise<GirisKesinlestirmeSonucu>;
}
