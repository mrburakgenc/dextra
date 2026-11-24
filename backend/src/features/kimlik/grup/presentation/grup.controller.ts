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
import { GrupGuncelleHandler } from '../application/grup-guncelle.handler.js';
import { GrupListeleHandler } from '../application/grup-listele.handler.js';
import type { GrupListesi } from '../application/grup-listele.query.js';
import { GrupOkuHandler } from '../application/grup-oku.handler.js';
import { GrupOlusturHandler } from '../application/grup-olustur.handler.js';
import {
  type GrupListeleParametreleri,
  grupListeleSemasi,
} from './grup-listele.schema.js';
import {
  type GrupGuncelleGovdesi,
  type GrupOlusturGovdesi,
  grupGuncelleSemasi,
  grupOlusturSemasi,
} from './grup-yaz.schema.js';

// Grup yönetiminin uçları (TS-002 AK-39): okuma (Grup:oku), oluştur (Grup:olustur) ve adını
// değiştir (Grup:guncelle). Liste düzdür; ağacı ekran kayıtların ustGrupId alanından kurar.
@Controller('kimlik/grup')
export class GrupController {
  constructor(
    private readonly listeleHandler: GrupListeleHandler,
    private readonly okuHandler: GrupOkuHandler,
    private readonly olusturHandler: GrupOlusturHandler,
    private readonly guncelleHandler: GrupGuncelleHandler,
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

  @Post()
  @Izin('Grup', 'olustur')
  async olustur(
    @Body({ schema: grupOlusturSemasi }) govde: GrupOlusturGovdesi,
  ): Promise<{ id: string }> {
    return { id: await this.olusturHandler.calistir(govde) };
  }

  // Gövdesiz 204 döner; ekran kaydı yeniden çeker.
  @Patch(':id')
  @Izin('Grup', 'guncelle')
  @HttpCode(HttpStatus.NO_CONTENT)
  guncelle(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: grupGuncelleSemasi }) { ad }: GrupGuncelleGovdesi,
  ): Promise<void> {
    return this.guncelleHandler.calistir(id, ad);
  }
}
