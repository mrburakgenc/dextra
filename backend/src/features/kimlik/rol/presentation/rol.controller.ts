// Rol ve izin uçları (TS-002 AK-39, "Uçlar ve izinler"): her uç girdisini işin şemasıyla doğrular ve
// işin tek işleyicisini çağırır.
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
  type RolAdiniDegistirGovdesi,
  rolAdiniDegistirGovdesiSemasi,
  type RolAdiniDegistirYolu,
  rolAdiniDegistirYoluSemasi,
} from '../application/commands/rol-adini-degistir/rol-adini-degistir.command.js';
import { RolAdiniDegistirHandler } from '../application/commands/rol-adini-degistir/rol-adini-degistir.handler.js';
import {
  type RolOlusturKomutu,
  rolOlusturKomutuSemasi,
} from '../application/commands/rol-olustur/rol-olustur.command.js';
import { RolOlusturHandler } from '../application/commands/rol-olustur/rol-olustur.handler.js';
import type { RolOlusturSonucu } from '../application/commands/rol-olustur/rol-olustur.result.js';
import {
  type RolSilKomutu,
  rolSilKomutuSemasi,
} from '../application/commands/rol-sil/rol-sil.command.js';
import { RolSilHandler } from '../application/commands/rol-sil/rol-sil.handler.js';
import { IzinListeleHandler } from '../application/queries/izin-listele/izin-listele.handler.js';
import {
  type IzinListeleSorgusu,
  izinListeleSorgusuSemasi,
} from '../application/queries/izin-listele/izin-listele.query.js';
import type { IzinListeleSonucu } from '../application/queries/izin-listele/izin-listele.result.js';
import { RolListeleHandler } from '../application/queries/rol-listele/rol-listele.handler.js';
import {
  type RolListeleSorgusu,
  rolListeleSorgusuSemasi,
} from '../application/queries/rol-listele/rol-listele.query.js';
import type { RolListeleSonucu } from '../application/queries/rol-listele/rol-listele.result.js';
import { RolOkuHandler } from '../application/queries/rol-oku/rol-oku.handler.js';
import {
  type RolOkuSorgusu,
  rolOkuSorgusuSemasi,
} from '../application/queries/rol-oku/rol-oku.query.js';
import type { RolOkuSonucu } from '../application/queries/rol-oku/rol-oku.result.js';

// Okumada kayıtlar yalnız isteyenin görebildiği kolonları ve kimliği taşır; görülemeyen ya da var
// olmayan rol bulunamadi döner. Oluşturma 201 ve { id }, adını değiştirme ve silme gövdesiz 204 döner.
@Controller('kimlik')
export class RolController {
  constructor(
    private readonly rolOlustur: RolOlusturHandler,
    private readonly rolAdiniDegistir: RolAdiniDegistirHandler,
    private readonly rolSil: RolSilHandler,
    private readonly rolListele: RolListeleHandler,
    private readonly rolOku: RolOkuHandler,
    private readonly izinListele: IzinListeleHandler,
  ) {}

  @Post('rol')
  @Izin('Rol', 'olustur')
  olustur(
    @Body({ schema: rolOlusturKomutuSemasi }) komut: RolOlusturKomutu,
  ): Promise<RolOlusturSonucu> {
    return this.rolOlustur.calistir(komut);
  }

  @Patch('rol/:id')
  @Izin('Rol', 'guncelle')
  @HttpCode(HttpStatus.NO_CONTENT)
  adDegistir(
    @Param({ schema: rolAdiniDegistirYoluSemasi }) { id }: RolAdiniDegistirYolu,
    @Body({ schema: rolAdiniDegistirGovdesiSemasi })
    { ad }: RolAdiniDegistirGovdesi,
  ): Promise<void> {
    return this.rolAdiniDegistir.calistir({ id, ad });
  }

  @Delete('rol/:id')
  @Izin('Rol', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  sil(
    @Param({ schema: rolSilKomutuSemasi }) komut: RolSilKomutu,
  ): Promise<void> {
    return this.rolSil.calistir(komut);
  }

  @Get('rol')
  @Izin('Rol', 'oku')
  roller(
    @Query({ schema: rolListeleSorgusuSemasi }) sorgu: RolListeleSorgusu,
  ): Promise<RolListeleSonucu> {
    return this.rolListele.calistir(sorgu);
  }

  @Get('rol/:id')
  @Izin('Rol', 'oku')
  rol(
    @Param({ schema: rolOkuSorgusuSemasi }) sorgu: RolOkuSorgusu,
  ): Promise<RolOkuSonucu> {
    return this.rolOku.calistir(sorgu);
  }

  @Get('izin')
  @Izin('Izin', 'oku')
  izinler(
    @Query({ schema: izinListeleSorgusuSemasi }) sorgu: IzinListeleSorgusu,
  ): Promise<IzinListeleSonucu> {
    return this.izinListele.calistir(sorgu);
  }
}
