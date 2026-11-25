// Kullanıcı yönetiminin uçları (TS-002 AK-39): her uç girdisini işin şemasıyla doğrular ve işin tek
// işleyicisini çağırır.
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
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import {
  type KullaniciAcKomutu,
  kullaniciAcKomutuSemasi,
} from '../application/commands/kullanici-ac/kullanici-ac.command.js';
import { KullaniciAcHandler } from '../application/commands/kullanici-ac/kullanici-ac.handler.js';
import type { KullaniciAcSonucu } from '../application/commands/kullanici-ac/kullanici-ac.result.js';
import {
  type KullaniciGuncelleGovdesi,
  kullaniciGuncelleGovdesiSemasi,
  type KullaniciGuncelleYolu,
  kullaniciGuncelleYoluSemasi,
} from '../application/commands/kullanici-guncelle/kullanici-guncelle.command.js';
import { KullaniciGuncelleHandler } from '../application/commands/kullanici-guncelle/kullanici-guncelle.handler.js';
import {
  type KullaniciPasifeAlKomutu,
  kullaniciPasifeAlGovdesiSemasi,
  kullaniciPasifeAlYoluSemasi,
} from '../application/commands/kullanici-pasife-al/kullanici-pasife-al.command.js';
import { KullaniciPasifeAlHandler } from '../application/commands/kullanici-pasife-al/kullanici-pasife-al.handler.js';
import {
  type KullaniciYenidenAcKomutu,
  kullaniciYenidenAcGovdesiSemasi,
  kullaniciYenidenAcYoluSemasi,
} from '../application/commands/kullanici-yeniden-ac/kullanici-yeniden-ac.command.js';
import { KullaniciYenidenAcHandler } from '../application/commands/kullanici-yeniden-ac/kullanici-yeniden-ac.handler.js';
import {
  type ParolaBaglantisiUretKomutu,
  parolaBaglantisiUretGovdesiSemasi,
  parolaBaglantisiUretYoluSemasi,
} from '../application/commands/parola-baglantisi-uret/parola-baglantisi-uret.command.js';
import { ParolaBaglantisiUretHandler } from '../application/commands/parola-baglantisi-uret/parola-baglantisi-uret.handler.js';
import type { ParolaBaglantisiUretSonucu } from '../application/commands/parola-baglantisi-uret/parola-baglantisi-uret.result.js';
import { KullaniciListeleHandler } from '../application/queries/kullanici-listele/kullanici-listele.handler.js';
import {
  type KullaniciListeleSorgusu,
  kullaniciListeleSorgusuSemasi,
} from '../application/queries/kullanici-listele/kullanici-listele.query.js';
import type { KullaniciListeleSonucu } from '../application/queries/kullanici-listele/kullanici-listele.result.js';
import { KullaniciOkuHandler } from '../application/queries/kullanici-oku/kullanici-oku.handler.js';
import {
  type KullaniciOkuSorgusu,
  kullaniciOkuSorgusuSemasi,
} from '../application/queries/kullanici-oku/kullanici-oku.query.js';
import type { KullaniciOkuSonucu } from '../application/queries/kullanici-oku/kullanici-oku.result.js';

// Okuma uçları (izin Kullanici:oku): sistem aktörleri ve unutulmuş kişiler de kayıttır; neyin
// görüneceğini yalnız isteyenin yeteneği belirler. Kullanıcı aç (izin Kullanici:olustur): 201 ve
// { id, parolaBaglantisiKodu }. Güncelle (izin Kullanici:guncelle): yalnız görünen ad, gövdesiz 204.
// Parola bağlantısı üret (izin Kullanici:parola_baglantisi_uret): gövdesiz istek, 201 ve
// { parolaBaglantisiKodu }. Pasife al (izin Kullanici:pasife_al) ve yeniden aç (izin
// Kullanici:yeniden_ac): gövdesiz istek, 204.
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
    @Body({ schema: kullaniciAcKomutuSemasi }) komut: KullaniciAcKomutu,
  ): Promise<KullaniciAcSonucu> {
    return this.acHandler.calistir(komut);
  }

  @Get()
  @Izin('Kullanici', 'oku')
  listele(
    @Query({ schema: kullaniciListeleSorgusuSemasi })
    sorgu: KullaniciListeleSorgusu,
  ): Promise<KullaniciListeleSonucu> {
    return this.listeleHandler.calistir(sorgu);
  }

  @Get(':id')
  @Izin('Kullanici', 'oku')
  oku(
    @Param({ schema: kullaniciOkuSorgusuSemasi }) sorgu: KullaniciOkuSorgusu,
  ): Promise<KullaniciOkuSonucu> {
    return this.okuHandler.calistir(sorgu);
  }

  // Gövdesiz 204 döner; ekran kaydı yeniden çeker.
  @Patch(':id')
  @Izin('Kullanici', 'guncelle')
  @HttpCode(HttpStatus.NO_CONTENT)
  guncelle(
    @Param({ schema: kullaniciGuncelleYoluSemasi })
    { id }: KullaniciGuncelleYolu,
    @Body({ schema: kullaniciGuncelleGovdesiSemasi })
    { gorunenAd }: KullaniciGuncelleGovdesi,
  ): Promise<void> {
    return this.guncelleHandler.calistir({ id, gorunenAd });
  }

  // Gövdesizdir: gövde ya hiç gelmez ya da alansız bir nesnedir; alan taşıyan gövde reddedilir.
  @Post(':id/parola-baglantisi')
  @Izin('Kullanici', 'parola_baglantisi_uret')
  parolaBaglantisiUret(
    @Body({ schema: parolaBaglantisiUretGovdesiSemasi }) _govde: unknown,
    @Param({ schema: parolaBaglantisiUretYoluSemasi })
    komut: ParolaBaglantisiUretKomutu,
  ): Promise<ParolaBaglantisiUretSonucu> {
    return this.baglantiHandler.calistir(komut);
  }

  // Gövdesizdir (alan taşıyan gövde reddedilir); 204 döner.
  @Post(':id/pasife-al')
  @Izin('Kullanici', 'pasife_al')
  @HttpCode(HttpStatus.NO_CONTENT)
  pasifeAl(
    @Body({ schema: kullaniciPasifeAlGovdesiSemasi }) _govde: unknown,
    @Param({ schema: kullaniciPasifeAlYoluSemasi })
    komut: KullaniciPasifeAlKomutu,
  ): Promise<void> {
    return this.pasifeAlHandler.calistir(komut);
  }

  // Gövdesizdir (alan taşıyan gövde reddedilir); 204 döner.
  @Post(':id/yeniden-ac')
  @Izin('Kullanici', 'yeniden_ac')
  @HttpCode(HttpStatus.NO_CONTENT)
  yenidenAc(
    @Body({ schema: kullaniciYenidenAcGovdesiSemasi }) _govde: unknown,
    @Param({ schema: kullaniciYenidenAcYoluSemasi })
    komut: KullaniciYenidenAcKomutu,
  ): Promise<void> {
    return this.yenidenAcHandler.calistir(komut);
  }
}
