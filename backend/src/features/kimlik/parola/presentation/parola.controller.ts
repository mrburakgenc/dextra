import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ParolaBelirleHandler } from '../application/parola-belirle.handler.js';
import {
  type ParolaBelirleGovdesi,
  parolaBelirleSemasi,
} from './parola-belirle.schema.js';

// Parola uçları. "Bağlantıyla parola belirle" oturumsuzdur (herkese açık); işaretler (AK-12) ve deneme
// sınırı sonraki görevlerde gelir; uç deneme sınırı kurulmadan yayına çıkmaz (KR-009 Seçim 9).
@Controller('kimlik/parola')
export class ParolaController {
  constructor(private readonly parolaBelirle: ParolaBelirleHandler) {}

  // Başarıda gövdesiz 204 döner; bağlantı kendiliğinden oturum açmaz.
  @Post('belirle')
  @HttpCode(HttpStatus.NO_CONTENT)
  belirle(
    @Body({ schema: parolaBelirleSemasi }) govde: ParolaBelirleGovdesi,
  ): Promise<void> {
    return this.parolaBelirle.calistir(govde);
  }
}
