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
import { z } from 'zod';
import {
  HerkeseAcik,
  Izin,
  YalnizKendisi,
} from '../../../../shared/guvenlik/isaretler.js';
import { IstemciAdresiDogrulayici } from '../../../../shared/guvenlik/istemci-adresi-imzasi.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import type { YetenekKurali } from '../../../../shared/yetki/yetenek-derleyici.js';
import { ParolaGirisYontemi } from '../../parola/application/parola-giris-yontemi.js';
import {
  type ParolaGirisGovdesi,
  parolaGirisSemasi,
} from '../../parola/application/parola-giris.schema.js';
import { CikisHandler } from '../application/cikis.handler.js';
import type { GirisCevabi } from '../application/giris.command.js';
import { GirisHandler, girisBasarisiz } from '../application/giris.handler.js';
import { OturumKapatHandler } from '../application/oturum-kapat.handler.js';
import { OturumListeleHandler } from '../application/oturum-listele.handler.js';
import type { OturumListesi } from '../application/oturum-listele.query.js';
import { OturumOkuHandler } from '../application/oturum-oku.handler.js';
import type { YenileCevabi } from '../application/yenile.command.js';
import {
  YenileHandler,
  yenilemeBasarisiz,
} from '../application/yenile.handler.js';
import {
  type OturumListeleParametreleri,
  oturumListeleSemasi,
} from './oturum-listele.schema.js';
import { type YenileGovdesi, yenileSemasi } from './yenile.schema.js';

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
  ): Promise<GirisCevabi> {
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
    @Body({ schema: yenileSemasi }) govde: YenileGovdesi,
    @Headers() basliklar: IncomingHttpHeaders,
  ): Promise<YenileCevabi> {
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
  ): Promise<OturumListesi> {
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
  oku(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.okuHandler.calistir(id);
  }

  // Gövdesizdir (alan taşıyan gövde reddedilir); 204 döner.
  @Post(':id/kapat')
  @Izin('Oturum', 'kapat')
  @HttpCode(HttpStatus.NO_CONTENT)
  kapat(
    @Body({ schema: z.strictObject({}).optional() }) _govde: unknown,
    @Param('id', { schema: z.uuid() }) id: string,
  ): Promise<void> {
    return this.kapatHandler.calistir(id);
  }
}
