// Üyelik yönetiminin uçları (TS-002 AK-39): okuma (Uyelik:oku), ver (Uyelik:olustur) ve kaldır
// (Uyelik:sil). Her uç girdisini işin şemasıyla doğrular ve işin tek işleyicisini çağırır.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import {
  type UyelikKaldirKomutu,
  uyelikKaldirKomutuSemasi,
} from '../application/commands/uyelik-kaldir/uyelik-kaldir.command.js';
import { UyelikKaldirHandler } from '../application/commands/uyelik-kaldir/uyelik-kaldir.handler.js';
import {
  type UyelikVerKomutu,
  uyelikVerKomutuSemasi,
} from '../application/commands/uyelik-ver/uyelik-ver.command.js';
import { UyelikVerHandler } from '../application/commands/uyelik-ver/uyelik-ver.handler.js';
import type { UyelikVerSonucu } from '../application/commands/uyelik-ver/uyelik-ver.result.js';
import { UyelikListeleHandler } from '../application/queries/uyelik-listele/uyelik-listele.handler.js';
import {
  type UyelikListeleSorgusu,
  uyelikListeleSorgusuSemasi,
} from '../application/queries/uyelik-listele/uyelik-listele.query.js';
import type { UyelikListeleSonucu } from '../application/queries/uyelik-listele/uyelik-listele.result.js';
import { UyelikOkuHandler } from '../application/queries/uyelik-oku/uyelik-oku.handler.js';
import {
  type UyelikOkuSorgusu,
  uyelikOkuSorgusuSemasi,
} from '../application/queries/uyelik-oku/uyelik-oku.query.js';
import type { UyelikOkuSonucu } from '../application/queries/uyelik-oku/uyelik-oku.result.js';

// Liste yalnız silinmemiş üyelikleri verir.
@Controller('kimlik/uyelik')
export class UyelikController {
  constructor(
    private readonly uyelikListele: UyelikListeleHandler,
    private readonly uyelikOku: UyelikOkuHandler,
    private readonly uyelikVer: UyelikVerHandler,
    private readonly uyelikKaldir: UyelikKaldirHandler,
  ) {}

  @Get()
  @Izin('Uyelik', 'oku')
  listele(
    @Query({ schema: uyelikListeleSorgusuSemasi }) sorgu: UyelikListeleSorgusu,
  ): Promise<UyelikListeleSonucu> {
    return this.uyelikListele.calistir(sorgu);
  }

  @Get(':id')
  @Izin('Uyelik', 'oku')
  oku(
    @Param({ schema: uyelikOkuSorgusuSemasi }) sorgu: UyelikOkuSorgusu,
  ): Promise<UyelikOkuSonucu> {
    return this.uyelikOku.calistir(sorgu);
  }

  // 201 ve { id }; SuperAdmin üyeliğinde, kişinin kullanıcı adı doluysa parolaBaglantisiKodu da.
  @Post()
  @Izin('Uyelik', 'olustur')
  ver(
    @Body({ schema: uyelikVerKomutuSemasi }) komut: UyelikVerKomutu,
  ): Promise<UyelikVerSonucu> {
    return this.uyelikVer.calistir(komut);
  }

  // Gövdesiz 204 döner.
  @Delete(':id')
  @Izin('Uyelik', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  kaldir(
    @Param({ schema: uyelikKaldirKomutuSemasi }) komut: UyelikKaldirKomutu,
  ): Promise<void> {
    return this.uyelikKaldir.calistir(komut);
  }
}
