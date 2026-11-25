// Grup yönetiminin uçları (TS-002 AK-39): okuma (Grup:oku), oluştur (Grup:olustur), adını
// değiştir (Grup:guncelle), taşı (Grup:tasi) ve sil (Grup:sil). Her uç girdisini işin şemasıyla
// doğrular ve işin tek işleyicisini çağırır.
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
import { Izin } from '../../../../shared/guvenlik/application/isaretler.js';
import {
  type GrupGuncelleGovdesi,
  grupGuncelleGovdesiSemasi,
  type GrupGuncelleYolu,
  grupGuncelleYoluSemasi,
} from '../application/commands/grup-guncelle/grup-guncelle.command.js';
import { GrupGuncelleHandler } from '../application/commands/grup-guncelle/grup-guncelle.handler.js';
import {
  type GrupOlusturKomutu,
  grupOlusturKomutuSemasi,
} from '../application/commands/grup-olustur/grup-olustur.command.js';
import { GrupOlusturHandler } from '../application/commands/grup-olustur/grup-olustur.handler.js';
import type { GrupOlusturSonucu } from '../application/commands/grup-olustur/grup-olustur.result.js';
import {
  type GrupSilKomutu,
  grupSilKomutuSemasi,
} from '../application/commands/grup-sil/grup-sil.command.js';
import { GrupSilHandler } from '../application/commands/grup-sil/grup-sil.handler.js';
import {
  type GrupTasiGovdesi,
  grupTasiGovdesiSemasi,
  type GrupTasiYolu,
  grupTasiYoluSemasi,
} from '../application/commands/grup-tasi/grup-tasi.command.js';
import { GrupTasiHandler } from '../application/commands/grup-tasi/grup-tasi.handler.js';
import { GrupListeleHandler } from '../application/queries/grup-listele/grup-listele.handler.js';
import {
  type GrupListeleSorgusu,
  grupListeleSorgusuSemasi,
} from '../application/queries/grup-listele/grup-listele.query.js';
import type { GrupListeleSonucu } from '../application/queries/grup-listele/grup-listele.result.js';
import { GrupOkuHandler } from '../application/queries/grup-oku/grup-oku.handler.js';
import {
  type GrupOkuSorgusu,
  grupOkuSorgusuSemasi,
} from '../application/queries/grup-oku/grup-oku.query.js';
import type { GrupOkuSonucu } from '../application/queries/grup-oku/grup-oku.result.js';

// Liste düzdür; ağacı ekran kayıtların ustGrupId alanından kurar. Oluşturma 201 ve { id }, adını
// değiştirme, taşıma ve silme gövdesiz 204 döner.
@Controller('kimlik/grup')
export class GrupController {
  constructor(
    private readonly grupListele: GrupListeleHandler,
    private readonly grupOku: GrupOkuHandler,
    private readonly grupOlustur: GrupOlusturHandler,
    private readonly grupGuncelle: GrupGuncelleHandler,
    private readonly grupTasi: GrupTasiHandler,
    private readonly grupSil: GrupSilHandler,
  ) {}

  @Get()
  @Izin('Grup', 'oku')
  listele(
    @Query({ schema: grupListeleSorgusuSemasi }) sorgu: GrupListeleSorgusu,
  ): Promise<GrupListeleSonucu> {
    return this.grupListele.calistir(sorgu);
  }

  @Get(':id')
  @Izin('Grup', 'oku')
  oku(
    @Param({ schema: grupOkuSorgusuSemasi }) sorgu: GrupOkuSorgusu,
  ): Promise<GrupOkuSonucu> {
    return this.grupOku.calistir(sorgu);
  }

  @Post()
  @Izin('Grup', 'olustur')
  olustur(
    @Body({ schema: grupOlusturKomutuSemasi }) komut: GrupOlusturKomutu,
  ): Promise<GrupOlusturSonucu> {
    return this.grupOlustur.calistir(komut);
  }

  // Gövdesiz 204 döner; ekran kaydı yeniden çeker.
  @Patch(':id')
  @Izin('Grup', 'guncelle')
  @HttpCode(HttpStatus.NO_CONTENT)
  guncelle(
    @Param({ schema: grupGuncelleYoluSemasi }) { id }: GrupGuncelleYolu,
    @Body({ schema: grupGuncelleGovdesiSemasi }) { ad }: GrupGuncelleGovdesi,
  ): Promise<void> {
    return this.grupGuncelle.calistir({ id, ad });
  }

  @Post(':id/tasi')
  @Izin('Grup', 'tasi')
  @HttpCode(HttpStatus.NO_CONTENT)
  tasi(
    @Param({ schema: grupTasiYoluSemasi }) { id }: GrupTasiYolu,
    @Body({ schema: grupTasiGovdesiSemasi }) { ustGrupId }: GrupTasiGovdesi,
  ): Promise<void> {
    return this.grupTasi.calistir({ id, ustGrupId });
  }

  @Delete(':id')
  @Izin('Grup', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  sil(
    @Param({ schema: grupSilKomutuSemasi }) komut: GrupSilKomutu,
  ): Promise<void> {
    return this.grupSil.calistir(komut);
  }
}
