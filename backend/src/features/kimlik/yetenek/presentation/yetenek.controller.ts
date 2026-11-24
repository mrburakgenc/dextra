import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { YetenekListeleHandler } from '../application/yetenek-listele.handler.js';
import type { YetenekListesi } from '../application/yetenek-listele.query.js';
import { YetenekOkuHandler } from '../application/yetenek-oku.handler.js';
import {
  type YetenekListeleParametreleri,
  yetenekListeleSemasi,
} from './yetenek-listele.schema.js';

// Yetenek yönetiminin okuma uçları (TS-002 AK-39; izin Yetenek:oku). Liste yalnız silinmemiş
// yetenekleri verir; kayıt şartı ve kolon listesini saklandığı biçimde taşır.
@Controller('kimlik/yetenek')
export class YetenekController {
  constructor(
    private readonly listeleHandler: YetenekListeleHandler,
    private readonly okuHandler: YetenekOkuHandler,
  ) {}

  @Get()
  @Izin('Yetenek', 'oku')
  listele(
    @Query({ schema: yetenekListeleSemasi })
    {
      sayfa,
      boyut,
      sirala,
      grupId,
      rolId,
      izinId,
    }: YetenekListeleParametreleri,
  ): Promise<YetenekListesi> {
    return this.listeleHandler.calistir({
      sayfa,
      boyut,
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(grupId === undefined ? {} : { grupId }),
      ...(rolId === undefined ? {} : { rolId }),
      ...(izinId === undefined ? {} : { izinId }),
    });
  }

  @Get(':id')
  @Izin('Yetenek', 'oku')
  oku(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.okuHandler.calistir(id);
  }
}
