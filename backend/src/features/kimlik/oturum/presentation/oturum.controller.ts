import type { IncomingHttpHeaders } from 'node:http';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  HerkeseAcik,
  YalnizKendisi,
} from '../../../../shared/guvenlik/isaretler.js';
import { IstemciAdresiDogrulayici } from '../../../../shared/guvenlik/istemci-adresi-imzasi.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import type { YetenekKurali } from '../../../../shared/yetki/yetenek-derleyici.js';
import { ParolaGirisYontemi } from '../../parola/application/parola-giris-yontemi.js';
import {
  type ParolaGirisGovdesi,
  parolaGirisSemasi,
} from '../../parola/presentation/parola-giris.schema.js';
import { CikisHandler } from '../application/cikis.handler.js';
import type { GirisCevabi } from '../application/giris.command.js';
import { GirisHandler, girisBasarisiz } from '../application/giris.handler.js';

// Oturum uçları (TS-002 "Uçlar ve izinler"; AK-7). Giriş oturumsuzdur (herkese açık); deneme sınırı
// sonraki görevlerde gelir ve uç ondan önce yayına çıkmaz. Belirteçler cevap gövdesinde verilir.
@Controller('kimlik/oturum')
export class OturumController {
  constructor(
    private readonly girisHandler: GirisHandler,
    private readonly cikisHandler: CikisHandler,
    private readonly parolaYontemi: ParolaGirisYontemi,
    private readonly adresler: IstemciAdresiDogrulayici,
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
}
