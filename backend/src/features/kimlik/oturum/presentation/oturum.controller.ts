import type { IncomingHttpHeaders } from 'node:http';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  HerkeseAcik,
  Izin,
  YalnizKendisi,
} from '../../../../shared/guvenlik/application/isaretler.js';
import { IstemciAdresiDogrulayici } from '../../../../shared/guvenlik/application/istemci-adresi-imzasi.js';
import { istekBaglami } from '../../../../shared/observability/istek-baglami/istek-baglami.js';
import type { YetenekKurali } from '../../../../shared/yetki/application/yetenek-derleyici.js';
import {
  type ParolaGirisGovdesi,
  parolaGirisSemasi,
} from '../../parola/application/commands/parola-giris/parola-giris.command.js';
import { ParolaGirisYontemi } from '../../parola/application/commands/parola-giris/parola-giris.handler.js';
import { CikisHandler } from '../application/commands/cikis/cikis.handler.js';
import {
  GirisHandler,
  girisBasarisiz,
} from '../application/commands/giris/giris.handler.js';
import type { GirisSonucu } from '../application/commands/giris/giris.result.js';
import {
  oturumKapatGovdesiSemasi,
  oturumKapatIdSemasi,
} from '../application/commands/oturum-kapat/oturum-kapat.command.js';
import { OturumKapatHandler } from '../application/commands/oturum-kapat/oturum-kapat.handler.js';
import {
  type YenileGovdesi,
  yenileGovdesiSemasi,
} from '../application/commands/yenile/yenile.command.js';
import {
  YenileHandler,
  yenilemeBasarisiz,
} from '../application/commands/yenile/yenile.handler.js';
import type { YenileSonucu } from '../application/commands/yenile/yenile.result.js';
import { OturumListeleHandler } from '../application/queries/oturum-listele/oturum-listele.handler.js';
import {
  type OturumListeleParametreleri,
  oturumListeleSemasi,
} from '../application/queries/oturum-listele/oturum-listele.query.js';
import type { OturumListeleSonucu } from '../application/queries/oturum-listele/oturum-listele.result.js';
import { OturumOkuHandler } from '../application/queries/oturum-oku/oturum-oku.handler.js';
import { oturumOkuIdSemasi } from '../application/queries/oturum-oku/oturum-oku.query.js';
import type { OturumOkuSonucu } from '../application/queries/oturum-oku/oturum-oku.result.js';

// Oturum uçları (TS-002 "Uçlar ve izinler"; AK-7). Giriş oturumsuzdur (herkese açık); deneme sınırı
// sonraki görevlerde gelir ve uç ondan önce yayına çıkmaz. Belirteçler cevap gövdesinde verilir.
@Controller('kimlik/oturum')
export class OturumController {
  constructor(
    private readonly girisHandler: GirisHandler,
    private readonly cikisHandler: CikisHandler,
    private readonly yenileHandler: YenileHandler,
    private readonly parolaYontemi: ParolaGirisYontemi,
    private readonly adresler: IstemciAdresiDogrulayici,
    private readonly listeleHandler: OturumListeleHandler,
    private readonly okuHandler: OturumOkuHandler,
    private readonly kapatHandler: OturumKapatHandler,
  ) {}

  // Parola ile giriş. Guard herkese açık uçta adrese bakmadığı için imza burada doğrulanır; imzası
  // doğrulanmayan istek, öbür başarısızlıklarla aynı cevabı alır ve yöntem çağrılmaz.
  @Post('giris')
  @HerkeseAcik()
  @HttpCode(HttpStatus.OK)
  giris(
    @Body({ schema: parolaGirisSemasi }) govde: ParolaGirisGovdesi,
    @Headers() basliklar: IncomingHttpHeaders,
  ): Promise<GirisSonucu> {
    const adres = this.adresler.dogrula(basliklar);
    if (!adres.gecerli) {
      throw girisBasarisiz();
    }
    return this.girisHandler.calistir({
      yontem: this.parolaYontemi,
      girdi: govde,
      ipAdresi: adres.istemci.adres,
      tarayiciBilgisi: adres.istemci.tarayici,
    });
  }

  // Oturum yenileme (TS-002 AK-49). Herkese açıktır: erişim belirtecinin süresi dolmuş olabilir.
  // Adres imzası girişteki gibi burada doğrulanır; imzasız istek hiçbir satıra dokunmadan, öbür
  // başarısızlıklarla aynı cevabı alır.
  @Post('yenile')
  @HerkeseAcik()
  @HttpCode(HttpStatus.OK)
  yenile(
    @Body({ schema: yenileGovdesiSemasi }) govde: YenileGovdesi,
    @Headers() basliklar: IncomingHttpHeaders,
  ): Promise<YenileSonucu> {
    const adres = this.adresler.dogrula(basliklar);
    if (!adres.gecerli) {
      throw yenilemeBasarisiz();
    }
    return this.yenileHandler.calistir({
      ...govde,
      ipAdresi: adres.istemci.adres,
      tarayiciBilgisi: adres.istemci.tarayici,
    });
  }

  // İsteği yapan oturumu kapatır; başarıda gövdesiz 204 döner.
  @Post('cikis')
  @YalnizKendisi()
  @HttpCode(HttpStatus.NO_CONTENT)
  cikis(): Promise<void> {
    const { oturum } = istekBaglami();
    // Yalnız kendisi işaretli uçta guard oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    return this.cikisHandler.calistir(oturum);
  }

  // Yetkilerim (TS-002 AK-18; KR-008 Seçim 46): isteği yapanın derlenmiş kuralları, yetki guard'ının
  // istek bağlamına yazdığı hâliyle. Her kural CASL kuralıdır: kaynak (subject), eylem (action),
  // koşul (conditions; bütün kayıtlarda yok), kolonlar (fields; bütün kolonlarda yok) ve yetenek
  // kimliği (yetenekId).
  @Get('yetkilerim')
  @YalnizKendisi()
  yetkilerim(): { kurallar: readonly YetenekKurali[] } {
    const { yetki } = istekBaglami();
    // Oturumlu istekte yetki guard'ı yetkiyi bağlama yazmadan isteği geçirmez.
    if (yetki === undefined) {
      throw new Error('İstek bağlamında yetki yok');
    }
    return { kurallar: yetki.kurallar };
  }

  // Oturum yönetiminin uçları (TS-002 AK-39, AK-51). Kişinin kendi oturumları da bu uçlardan, temel
  // üyeliğe tohumlanmış yeteneklerle okunur ve kapatılır. ':id' yolları sabit yollardan (giris,
  // yenile, cikis, yetkilerim) sonra tanımlanır ve kimlik biçimini ister; onları gölgelemez.
  @Get()
  @Izin('Oturum', 'oku')
  listele(
    @Query({ schema: oturumListeleSemasi })
    { sayfa, boyut, sirala, kullaniciId, acik }: OturumListeleParametreleri,
  ): Promise<OturumListeleSonucu> {
    return this.listeleHandler.calistir({
      sayfa,
      boyut,
      siralama: sirala,
      ...(kullaniciId === undefined ? {} : { kullaniciId }),
      ...(acik === undefined ? {} : { acik }),
    });
  }

  @Get(':id')
  @Izin('Oturum', 'oku')
  oku(
    @Param('id', { schema: oturumOkuIdSemasi }) id: string,
  ): Promise<OturumOkuSonucu> {
    return this.okuHandler.calistir({ id });
  }

  // Gövdesizdir (alan taşıyan gövde reddedilir); 204 döner.
  @Post(':id/kapat')
  @Izin('Oturum', 'kapat')
  @HttpCode(HttpStatus.NO_CONTENT)
  kapat(
    @Body({ schema: oturumKapatGovdesiSemasi }) _govde: unknown,
    @Param('id', { schema: oturumKapatIdSemasi }) id: string,
  ): Promise<void> {
    return this.kapatHandler.calistir({ id });
  }
}
