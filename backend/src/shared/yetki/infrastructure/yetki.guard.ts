import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { isaretleriOku } from '../../guvenlik/application/isaretler.js';
import { istekBaglami, istekYetkisiniYaz } from '../../http/istek-baglami.js';
import { KodluHata } from '../../http/kodlu-hata.js';
import { YetkiBellegi } from './yetki-bellegi.js';

// Yetki guard'ı (TS-002 AK-18; KR-010 Derleme eşlemesi): kimlik guard'ının ardından bütün uçlara
// bağlanır. Oturumlu istekte kişinin derlenmiş yetkisini yetki belleğinden alır ve istek bağlamına
// yazar. İzin işaretli uçta o kaynak ve eylem için en az bir kural yoksa yetki_yok döner (tür
// düzeyinde soru); kayıt düzeyindeki sınırı yetki kapısı uygular. Oturumsuz istek (herkese açık uç)
// buraya kimlik guard'ından geçerek gelir ve dokunulmadan geçer. Kapalı düşme guard sırasına
// bırakılmaz (AK-37): izin işaretli uçta bağlamda oturum yoksa yetki_yok döner.
@Injectable()
export class YetkiGuard implements CanActivate {
  constructor(private readonly bellek: YetkiBellegi) {}

  async canActivate(baglam: ExecutionContext): Promise<boolean> {
    const [isaret] = isaretleriOku(baglam.getHandler());
    const { oturum } = istekBaglami();
    if (oturum === undefined) {
      if (isaret?.tur === 'izin') {
        throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
      }
      return true;
    }
    const yetki = await this.bellek.al(oturum.kullaniciId, oturum);
    istekYetkisiniYaz(yetki);
    if (isaret?.tur !== 'izin') {
      return true;
    }
    // Koşula ve kolona bakmadan o eylem ve tür için kural var mı (kayıt üzerinde karar verilmez).
    if (
      yetki.yetenek.possibleRulesFor(isaret.eylem, isaret.kaynak).length > 0
    ) {
      return true;
    }
    throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
  }
}
