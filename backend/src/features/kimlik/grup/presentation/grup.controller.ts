import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { GrupListeleHandler } from '../application/grup-listele.handler.js';
import type { GrupListesi } from '../application/grup-listele.query.js';
import { GrupOkuHandler } from '../application/grup-oku.handler.js';
import {
  type GrupListeleParametreleri,
  grupListeleSemasi,
} from './grup-listele.schema.js';

// Grup yönetiminin okuma uçları (TS-002 AK-39; izin Grup:oku). Liste düzdür; ağacı ekran
// kayıtların ustGrupId alanından kurar.
@Controller('kimlik/grup')
export class GrupController {
  constructor(
    private readonly listeleHandler: GrupListeleHandler,
    private readonly okuHandler: GrupOkuHandler,
  ) {}

  @Get()
  @Izin('Grup', 'oku')
  listele(
    @Query({ schema: grupListeleSemasi })
    { sayfa, boyut, sirala, ustGrupId }: GrupListeleParametreleri,
  ): Promise<GrupListesi> {
    return this.listeleHandler.calistir({
      sayfa,
      boyut,
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(ustGrupId === undefined ? {} : { ustGrupId }),
    });
  }

  @Get(':id')
  @Izin('Grup', 'oku')
  oku(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.okuHandler.calistir(id);
  }
}
