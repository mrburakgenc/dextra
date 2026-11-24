import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { UyelikListeleHandler } from '../application/uyelik-listele.handler.js';
import type { UyelikListesi } from '../application/uyelik-listele.query.js';
import { UyelikOkuHandler } from '../application/uyelik-oku.handler.js';
import {
  type UyelikListeleParametreleri,
  uyelikListeleSemasi,
} from './uyelik-listele.schema.js';

// Üyelik yönetiminin okuma uçları (TS-002 AK-39; izin Uyelik:oku). Liste yalnız silinmemiş
// üyelikleri verir.
@Controller('kimlik/uyelik')
export class UyelikController {
  constructor(
    private readonly listeleHandler: UyelikListeleHandler,
    private readonly okuHandler: UyelikOkuHandler,
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
}
