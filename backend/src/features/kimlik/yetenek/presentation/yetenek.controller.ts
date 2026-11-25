// Yetenek yönetiminin uçları (TS-002 AK-39): okuma (Yetenek:oku), yaz (Yetenek:olustur), yenile
// (Yetenek:yenile; yeni satırı yazmak ayrıca Yetenek:olustur ister) ve sil (Yetenek:sil). Her uç
// girdisini işin şemasıyla doğrular ve işin tek işleyicisini çağırır.
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
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import {
  type YetenekOlusturKomutu,
  yetenekOlusturKomutuSemasi,
} from '../application/commands/yetenek-olustur/yetenek-olustur.command.js';
import { YetenekOlusturHandler } from '../application/commands/yetenek-olustur/yetenek-olustur.handler.js';
import type { YetenekOlusturSonucu } from '../application/commands/yetenek-olustur/yetenek-olustur.result.js';
import {
  type YetenekSilKomutu,
  yetenekSilKomutuSemasi,
} from '../application/commands/yetenek-sil/yetenek-sil.command.js';
import { YetenekSilHandler } from '../application/commands/yetenek-sil/yetenek-sil.handler.js';
import {
  type YetenekYenileGovdesi,
  yetenekYenileGovdesiSemasi,
  type YetenekYenileYolu,
  yetenekYenileYoluSemasi,
} from '../application/commands/yetenek-yenile/yetenek-yenile.command.js';
import { YetenekYenileHandler } from '../application/commands/yetenek-yenile/yetenek-yenile.handler.js';
import type { YetenekYenileSonucu } from '../application/commands/yetenek-yenile/yetenek-yenile.result.js';
import { YetenekListeleHandler } from '../application/queries/yetenek-listele/yetenek-listele.handler.js';
import {
  type YetenekListeleSorgusu,
  yetenekListeleSorgusuSemasi,
} from '../application/queries/yetenek-listele/yetenek-listele.query.js';
import type { YetenekListeleSonucu } from '../application/queries/yetenek-listele/yetenek-listele.result.js';
import { YetenekOkuHandler } from '../application/queries/yetenek-oku/yetenek-oku.handler.js';
import {
  type YetenekOkuSorgusu,
  yetenekOkuSorgusuSemasi,
} from '../application/queries/yetenek-oku/yetenek-oku.query.js';
import type { YetenekOkuSonucu } from '../application/queries/yetenek-oku/yetenek-oku.result.js';

// Liste yalnız silinmemiş yetenekleri verir; kayıt şartı ve kolon listesini saklandığı biçimde taşır.
// Yaz ve yenile 201 ile yeni satırın { id }'sini, sil gövdesiz 204 döner. Güncelleme ucu yoktur: satır
// yerinde düzenlenmez, yenile eskisini silip yerine yenisini yazar (TS-002 değişmez 6).
@Controller('kimlik/yetenek')
export class YetenekController {
  constructor(
    private readonly yetenekListele: YetenekListeleHandler,
    private readonly yetenekOku: YetenekOkuHandler,
    private readonly yetenekOlustur: YetenekOlusturHandler,
    private readonly yetenekSil: YetenekSilHandler,
    private readonly yetenekYenile: YetenekYenileHandler,
  ) {}

  @Post()
  @Izin('Yetenek', 'olustur')
  olustur(
    @Body({ schema: yetenekOlusturKomutuSemasi }) komut: YetenekOlusturKomutu,
  ): Promise<YetenekOlusturSonucu> {
    return this.yetenekOlustur.calistir(komut);
  }

  @Post(':id/yenile')
  @Izin('Yetenek', 'yenile')
  yenile(
    @Param({ schema: yetenekYenileYoluSemasi }) { id }: YetenekYenileYolu,
    @Body({ schema: yetenekYenileGovdesiSemasi })
    { icerik }: YetenekYenileGovdesi,
  ): Promise<YetenekYenileSonucu> {
    return this.yetenekYenile.calistir({ id, icerik });
  }

  @Delete(':id')
  @Izin('Yetenek', 'sil')
  @HttpCode(HttpStatus.NO_CONTENT)
  sil(
    @Param({ schema: yetenekSilKomutuSemasi }) komut: YetenekSilKomutu,
  ): Promise<void> {
    return this.yetenekSil.calistir(komut);
  }

  @Get()
  @Izin('Yetenek', 'oku')
  listele(
    @Query({ schema: yetenekListeleSorgusuSemasi })
    sorgu: YetenekListeleSorgusu,
  ): Promise<YetenekListeleSonucu> {
    return this.yetenekListele.calistir(sorgu);
  }

  @Get(':id')
  @Izin('Yetenek', 'oku')
  oku(
    @Param({ schema: yetenekOkuSorgusuSemasi }) sorgu: YetenekOkuSorgusu,
  ): Promise<YetenekOkuSonucu> {
    return this.yetenekOku.calistir(sorgu);
  }
}
