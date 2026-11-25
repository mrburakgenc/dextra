import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  HerkeseAcik,
  YalnizKendisi,
} from '../../../../shared/guvenlik/isaretler.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { ParolaBelirleHandler } from '../application/parola-belirle.handler.js';
import { ParolaDegistirHandler } from '../application/parola-degistir.handler.js';
import {
  type ParolaBelirleGovdesi,
  parolaBelirleSemasi,
} from './parola-belirle.schema.js';
import {
  type ParolaDegistirGovdesi,
  parolaDegistirSemasi,
} from './parola-degistir.schema.js';

// Parola uçları. "Bağlantıyla parola belirle" oturumsuzdur (herkese açık; AK-12); deneme sınırı
// sonraki görevlerde gelir; uç deneme sınırı kurulmadan yayına çıkmaz (KR-009 Seçim 9).
@Controller('kimlik/parola')
export class ParolaController {
  constructor(
    private readonly parolaBelirle: ParolaBelirleHandler,
    private readonly parolaDegistir: ParolaDegistirHandler,
  ) {}

  // Başarıda gövdesiz 204 döner; bağlantı kendiliğinden oturum açmaz.
  @Post('belirle')
  @HerkeseAcik()
  @HttpCode(HttpStatus.NO_CONTENT)
  belirle(
    @Body({ schema: parolaBelirleSemasi }) govde: ParolaBelirleGovdesi,
  ): Promise<void> {
    return this.parolaBelirle.calistir(govde);
  }

  // Oturumu açık kişinin parolasını değiştirir (AK-50); kişi ve oturum istek bağlamından gelir.
  // Başarıda gövdesiz 204 döner ve kişinin bütün oturumları, bu istekteki dahil, kapanır. Eski
  // parolayı sınadığı için deneme sınırı ister; uç sınır kurulmadan yayına çıkmaz (AK-50).
  @Post('degistir')
  @YalnizKendisi()
  @HttpCode(HttpStatus.NO_CONTENT)
  degistir(
    @Body({ schema: parolaDegistirSemasi }) govde: ParolaDegistirGovdesi,
  ): Promise<void> {
    const { oturum } = istekBaglami();
    // Yalnız kendisi işaretli uçta guard oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    return this.parolaDegistir.calistir({
      kullaniciId: oturum.kullaniciId,
      oturumId: oturum.oturumId,
      ...govde,
    });
  }
}
