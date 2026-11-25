import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import type { AcilanKullanici } from '../application/kullanici-ac.command.js';
import { KullaniciAcHandler } from '../application/kullanici-ac.handler.js';
import { KullaniciGuncelleHandler } from '../application/kullanici-guncelle.handler.js';
import { KullaniciListeleHandler } from '../application/kullanici-listele.handler.js';
import type { KullaniciListesi } from '../application/kullanici-listele.query.js';
import { KullaniciOkuHandler } from '../application/kullanici-oku.handler.js';
import { KullaniciPasifeAlHandler } from '../application/kullanici-pasife-al.handler.js';
import { KullaniciYenidenAcHandler } from '../application/kullanici-yeniden-ac.handler.js';
import { ParolaBaglantisiUretHandler } from '../application/parola-baglantisi-uret.handler.js';
import {
  type KullaniciAcGovdesi,
  kullaniciAcSemasi,
} from './kullanici-ac.schema.js';
import {
  type KullaniciGuncelleGovdesi,
  kullaniciGuncelleSemasi,
} from './kullanici-guncelle.schema.js';
import {
  type KullaniciListeleParametreleri,
  kullaniciListeleSemasi,
} from './kullanici-listele.schema.js';

// Kullanıcı yönetiminin uçları (TS-002 AK-39). Okuma uçları (izin Kullanici:oku): sistem aktörleri ve
// unutulmuş kişiler de kayıttır; neyin görüneceğini yalnız isteyenin yeteneği belirler. Kullanıcı aç
// (izin Kullanici:olustur): 201 ve { id, parolaBaglantisiKodu }. Güncelle (izin Kullanici:guncelle):
// yalnız görünen ad, gövdesiz 204. Parola bağlantısı üret (izin Kullanici:parola_baglantisi_uret):
// gövdesiz istek, 201 ve { parolaBaglantisiKodu }. Pasife al (izin Kullanici:pasife_al) ve yeniden aç
// (izin Kullanici:yeniden_ac): gövdesiz istek, 204.
@Controller('kimlik/kullanici')
export class KullaniciController {
  constructor(
    private readonly listeleHandler: KullaniciListeleHandler,
    private readonly okuHandler: KullaniciOkuHandler,
    private readonly acHandler: KullaniciAcHandler,
    private readonly guncelleHandler: KullaniciGuncelleHandler,
    private readonly baglantiHandler: ParolaBaglantisiUretHandler,
    private readonly pasifeAlHandler: KullaniciPasifeAlHandler,
    private readonly yenidenAcHandler: KullaniciYenidenAcHandler,
  ) {}

  @Post()
  @Izin('Kullanici', 'olustur')
  ac(
    @Body({ schema: kullaniciAcSemasi }) govde: KullaniciAcGovdesi,
  ): Promise<AcilanKullanici> {
    return this.acHandler.calistir(govde);
  }

  @Get()
  @Izin('Kullanici', 'oku')
  listele(
    @Query({ schema: kullaniciListeleSemasi })
    { sayfa, boyut, sirala, pasif }: KullaniciListeleParametreleri,
  ): Promise<KullaniciListesi> {
    return this.listeleHandler.calistir({
      sayfa,
      boyut,
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(pasif === undefined ? {} : { pasif }),
    });
  }

  @Get(':id')
  @Izin('Kullanici', 'oku')
  oku(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.okuHandler.calistir(id);
  }

  // Gövdesiz 204 döner; ekran kaydı yeniden çeker.
  @Patch(':id')
  @Izin('Kullanici', 'guncelle')
  @HttpCode(HttpStatus.NO_CONTENT)
  guncelle(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: kullaniciGuncelleSemasi })
    { gorunenAd }: KullaniciGuncelleGovdesi,
  ): Promise<void> {
    return this.guncelleHandler.calistir(id, gorunenAd);
  }

  // Gövdesizdir: gövde ya hiç gelmez ya da alansız bir nesnedir; alan taşıyan gövde reddedilir.
  @Post(':id/parola-baglantisi')
  @Izin('Kullanici', 'parola_baglantisi_uret')
  async parolaBaglantisiUret(
    @Body({ schema: z.strictObject({}).optional() }) _govde: unknown,
    @Param('id', { schema: z.uuid() }) id: string,
  ): Promise<{ parolaBaglantisiKodu: string }> {
    return { parolaBaglantisiKodu: await this.baglantiHandler.calistir(id) };
  }

  // Gövdesizdir (alan taşıyan gövde reddedilir); 204 döner.
  @Post(':id/pasife-al')
  @Izin('Kullanici', 'pasife_al')
  @HttpCode(HttpStatus.NO_CONTENT)
  pasifeAl(
    @Body({ schema: z.strictObject({}).optional() }) _govde: unknown,
    @Param('id', { schema: z.uuid() }) id: string,
  ): Promise<void> {
    return this.pasifeAlHandler.calistir(id);
  }

  // Gövdesizdir (alan taşıyan gövde reddedilir); 204 döner.
  @Post(':id/yeniden-ac')
  @Izin('Kullanici', 'yeniden_ac')
  @HttpCode(HttpStatus.NO_CONTENT)
  yenidenAc(
    @Body({ schema: z.strictObject({}).optional() }) _govde: unknown,
    @Param('id', { schema: z.uuid() }) id: string,
  ): Promise<void> {
    return this.yenidenAcHandler.calistir(id);
  }
}
