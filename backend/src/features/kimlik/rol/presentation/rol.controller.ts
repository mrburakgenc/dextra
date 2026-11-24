import {
  Body,
  Controller,
  Delete,
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
import type { ListeCevabi, ListeSorgusu } from '../application/liste.query.js';
import { RolKomutlariHandler } from '../application/rol-komutlari.handler.js';
import { RolSorgulariHandler } from '../application/rol-sorgulari.handler.js';
import { izinListeSemasi, rolListeSemasi } from './liste.schema.js';
import { type RolGovdesi, rolGovdesiSemasi } from './rol-yaz.schema.js';

// Rol ve izin uçları (TS-002 AK-39, "Uçlar ve izinler"). Okumada kayıtlar yalnız isteyenin
// görebildiği kolonları ve kimliği taşır; görülemeyen ya da var olmayan rol bulunamadi döner.
// Oluşturma 201 ve { id }, adını değiştirme ve silme gövdesiz 204 döner.
@Controller('kimlik')
export class RolController {
  constructor(
    private readonly sorgular: RolSorgulariHandler,
    private readonly komutlar: RolKomutlariHandler,
  ) {}

  @Post('rol')
  @Izin('Rol', 'olustur')
  async olustur(
    @Body({ schema: rolGovdesiSemasi }) { ad }: RolGovdesi,
  ): Promise<{ id: string }> {
    return { id: await this.komutlar.olustur(ad) };
  }

  @Patch('rol/:id')
  @Izin('Rol', 'guncelle')
  @HttpCode(HttpStatus.NO_CONTENT)
  adDegistir(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: rolGovdesiSemasi }) { ad }: RolGovdesi,
  ): Promise<void> {
    return this.komutlar.adDegistir(id, ad);
  }

  @Delete('rol/:id')
  @Izin('Rol', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  sil(@Param('id', { schema: z.uuid() }) id: string): Promise<void> {
    return this.komutlar.sil(id);
  }

  @Get('rol')
  @Izin('Rol', 'oku')
  roller(
    @Query({ schema: rolListeSemasi }) sorgu: ListeSorgusu,
  ): Promise<ListeCevabi> {
    return this.sorgular.roller(sorgu);
  }

  @Get('rol/:id')
  @Izin('Rol', 'oku')
  rol(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.sorgular.rol(id);
  }

  @Get('izin')
  @Izin('Izin', 'oku')
  izinler(
    @Query({ schema: izinListeSemasi }) sorgu: ListeSorgusu,
  ): Promise<ListeCevabi> {
    return this.sorgular.izinler(sorgu);
  }
}
