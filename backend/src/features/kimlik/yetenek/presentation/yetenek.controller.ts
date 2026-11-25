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
import { YetenekListeleHandler } from '../application/yetenek-listele.handler.js';
import type { YetenekListesi } from '../application/yetenek-listele.query.js';
import { YetenekOkuHandler } from '../application/yetenek-oku.handler.js';
import { YetenekOlusturHandler } from '../application/yetenek-olustur.handler.js';
import { YetenekSilHandler } from '../application/yetenek-sil.handler.js';
import { YetenekYenileHandler } from '../application/yetenek-yenile.handler.js';
import {
  type YetenekListeleParametreleri,
  yetenekListeleSemasi,
} from './yetenek-listele.schema.js';
import {
  type YetenekYazGovdesi,
  type YetenekYenileGovdesi,
  yetenekYazSemasi,
  yetenekYenileSemasi,
} from './yetenek-yaz.schema.js';

// Yetenek yönetiminin uçları (TS-002 AK-39): okuma (Yetenek:oku), yaz (Yetenek:olustur), yenile
// (Yetenek:yenile; yeni satırı yazmak ayrıca Yetenek:olustur ister) ve sil (Yetenek:sil). Liste yalnız
// silinmemiş yetenekleri verir; kayıt şartı ve kolon listesini saklandığı biçimde taşır. Güncelleme ucu
// yoktur: satır yerinde düzenlenmez, yenile eskisini silip yerine yenisini yazar (TS-002 değişmez 6).
@Controller('kimlik/yetenek')
export class YetenekController {
  constructor(
    private readonly listeleHandler: YetenekListeleHandler,
    private readonly okuHandler: YetenekOkuHandler,
    private readonly olusturHandler: YetenekOlusturHandler,
    private readonly silHandler: YetenekSilHandler,
    private readonly yenileHandler: YetenekYenileHandler,
  ) {}

  @Post()
  @Izin('Yetenek', 'olustur')
  async olustur(
    @Body({ schema: yetenekYazSemasi }) govde: YetenekYazGovdesi,
  ): Promise<{ id: string }> {
    return { id: await this.olusturHandler.calistir(govde) };
  }

  // Yeni satırın kimliğini döner.
  @Post(':id/yenile')
  @Izin('Yetenek', 'yenile')
  async yenile(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: yetenekYenileSemasi }) govde: YetenekYenileGovdesi,
  ): Promise<{ id: string }> {
    return { id: await this.yenileHandler.calistir(id, govde) };
  }

  // Gövdesiz 204 döner.
  @Delete(':id')
  @Izin('Yetenek', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  sil(@Param('id', { schema: z.uuid() }) id: string): Promise<void> {
    return this.silHandler.calistir(id);
  }

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
