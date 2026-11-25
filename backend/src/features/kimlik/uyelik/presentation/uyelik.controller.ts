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
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { UyelikKaldirHandler } from '../application/uyelik-kaldir.handler.js';
import { UyelikListeleHandler } from '../application/uyelik-listele.handler.js';
import type { UyelikListesi } from '../application/uyelik-listele.query.js';
import { UyelikOkuHandler } from '../application/uyelik-oku.handler.js';
import {
  UyelikVerHandler,
  type VerilenUyelik,
} from '../application/uyelik-ver.handler.js';
import {
  type UyelikListeleParametreleri,
  uyelikListeleSemasi,
} from './uyelik-listele.schema.js';
import { type UyelikVerGovdesi, uyelikVerSemasi } from './uyelik-yaz.schema.js';

// Üyelik yönetiminin uçları (TS-002 AK-39): okuma (Uyelik:oku), ver (Uyelik:olustur) ve kaldır
// (Uyelik:sil). Liste yalnız silinmemiş üyelikleri verir.
@Controller('kimlik/uyelik')
export class UyelikController {
  constructor(
    private readonly listeleHandler: UyelikListeleHandler,
    private readonly okuHandler: UyelikOkuHandler,
    private readonly verHandler: UyelikVerHandler,
    private readonly kaldirHandler: UyelikKaldirHandler,
  ) {}

  @Get()
  @Izin('Uyelik', 'oku')
  listele(
    @Query({ schema: uyelikListeleSemasi })
    {
      sayfa,
      boyut,
      sirala,
      kullaniciId,
      grupId,
      rolId,
    }: UyelikListeleParametreleri,
  ): Promise<UyelikListesi> {
    return this.listeleHandler.calistir({
      sayfa,
      boyut,
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(kullaniciId === undefined ? {} : { kullaniciId }),
      ...(grupId === undefined ? {} : { grupId }),
      ...(rolId === undefined ? {} : { rolId }),
    });
  }

  @Get(':id')
  @Izin('Uyelik', 'oku')
  oku(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.okuHandler.calistir(id);
  }

  // 201 ve { id }; SuperAdmin üyeliğinde, kişinin kullanıcı adı doluysa parolaBaglantisiKodu da.
  @Post()
  @Izin('Uyelik', 'olustur')
  ver(
    @Body({ schema: uyelikVerSemasi }) govde: UyelikVerGovdesi,
  ): Promise<VerilenUyelik> {
    return this.verHandler.calistir(govde);
  }

  // Gövdesiz 204 döner.
  @Delete(':id')
  @Izin('Uyelik', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  kaldir(@Param('id', { schema: z.uuid() }) id: string): Promise<void> {
    return this.kaldirHandler.calistir(id);
  }
}
