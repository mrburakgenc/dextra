import type { IncomingMessage } from 'node:http';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { istekOturumunuYaz } from '../http/istek-baglami.js';
import { KodluHata } from '../http/kodlu-hata.js';
import {
  OTURUM_DENETIMI,
  type OturumDenetimi,
} from '../kimlik/oturum-denetimi.contract.js';
import { BelirtecServisi } from './belirtec.js';
import { isaretleriOku } from './isaretler.js';
import { IstemciAdresiDogrulayici } from './istemci-adresi-imzasi.js';

// Yetkilendirme şeması büyük-küçük harf duyarsızdır (RFC 7235); belirteç boşluk taşımaz.
const BEARER = /^Bearer (\S+)$/i;

// Kimlik guard'ı (TS-002 AK-12, AK-14): bütün uçlara bağlanır. Herkese açık uçta hiçbir şey istemez.
// Öbürlerinde sırayla erişim belirtecini, istemci adresi imzasını ve oturumu (OturumDenetimi)
// doğrular ve oturumu istek bağlamına yazar. Biri tutmazsa kimlik_gerekli döner; cevap nedeni
// taşımaz. Adres imzası geçersizse oturuma gidilmez, adres uymazlığında oturumu sözleşmenin
// uygulaması kapatır (KR-009 Kural 8). İzin işaretli uç, yetki denetimi bağlanana kadar oturum
// doğrulansa da yetki_yok döner (AK-14). İşaretsiz uç açılışta reddedildiği için burada yalnız
// kapalı düşer (oturum doğrulanır, sonra yetki_yok).
@Injectable()
export class KimlikGuard implements CanActivate {
  constructor(
    private readonly belirtecler: BelirtecServisi,
    private readonly adresler: IstemciAdresiDogrulayici,
    @Inject(OTURUM_DENETIMI) private readonly oturumlar: OturumDenetimi,
  ) {}

  async canActivate(baglam: ExecutionContext): Promise<boolean> {
    const [isaret] = isaretleriOku(baglam.getHandler());
    if (isaret?.tur === 'herkese_acik') {
      return true;
    }
    const istek = baglam.switchToHttp().getRequest<IncomingMessage>();
    if (!(await this.oturumuDogrula(istek))) {
      throw new KodluHata('kimlik_gerekli', 'Kimlik doğrulanamadı');
    }
    if (isaret?.tur === 'yalniz_kendisi') {
      return true;
    }
    throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
  }

  private async oturumuDogrula(istek: IncomingMessage): Promise<boolean> {
    const eslesme = BEARER.exec(istek.headers.authorization ?? '');
    if (eslesme?.[1] === undefined) {
      return false;
    }
    const belirtec = await this.belirtecler.erisimBelirteciDogrula(eslesme[1]);
    if (!belirtec.gecerli) {
      return false;
    }
    const adres = this.adresler.dogrula(istek.headers);
    if (!adres.gecerli) {
      return false;
    }
    const { kullaniciId, oturumId } = belirtec.icerik;
    const oturum = await this.oturumlar.denetle({
      oturumId,
      ipAdresi: adres.istemci.adres,
      tarayiciBilgisi: adres.istemci.tarayici,
    });
    // Belirteç oturumun sahibinden başkasını söylüyorsa kabul edilmez.
    if (!oturum.gecerli || oturum.kullaniciId !== kullaniciId) {
      return false;
    }
    istekOturumunuYaz({
      kullaniciId,
      oturumId,
      kisiSurumu: oturum.kisiSurumu,
      genelSurum: oturum.genelSurum,
    });
    return true;
  }
}
