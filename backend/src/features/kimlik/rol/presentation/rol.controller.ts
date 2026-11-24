import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import type { ListeCevabi, ListeSorgusu } from '../application/liste.query.js';
import { RolSorgulariHandler } from '../application/rol-sorgulari.handler.js';
import { izinListeSemasi, rolListeSemasi } from './liste.schema.js';

// Rol ve izin okuma uçları (TS-002 AK-39, "Uçlar ve izinler"). Kayıtlar yalnız isteyenin görebildiği
// kolonları ve kimliği taşır; görülemeyen ya da var olmayan rol bulunamadi döner.
@Controller('kimlik')
export class RolController {
  constructor(private readonly sorgular: RolSorgulariHandler) {}

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
