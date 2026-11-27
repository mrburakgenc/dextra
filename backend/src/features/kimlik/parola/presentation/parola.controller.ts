import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  HerkeseAcik,
  YalnizKendisi,
} from '../../../../shared/guvenlik/application/isaretler.js';
import { istekBaglami } from '../../../../shared/observability/istek-baglami/istek-baglami.js';
import {
  type ParolaBelirleKomutu,
  parolaBelirleKomutuSemasi,
} from '../application/commands/parola-belirle/parola-belirle.command.js';
import { ParolaBelirleHandler } from '../application/commands/parola-belirle/parola-belirle.handler.js';
import {
  type ParolaDegistirGovdesi,
  parolaDegistirGovdesiSemasi,
} from '../application/commands/parola-degistir/parola-degistir.command.js';
import { ParolaDegistirHandler } from '../application/commands/parola-degistir/parola-degistir.handler.js';

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
    @Body({ schema: parolaBelirleKomutuSemasi }) komut: ParolaBelirleKomutu,
  ): Promise<void> {
    return this.parolaBelirle.calistir(komut);
  }

  // Oturumu açık kişinin parolasını değiştirir (AK-50); kişi ve oturum istek bağlamından gelir.
  // Başarıda gövdesiz 204 döner ve kişinin bütün oturumları, bu istekteki dahil, kapanır. Eski
  // parolayı sınadığı için deneme sınırı ister; uç sınır kurulmadan yayına çıkmaz (AK-50).
  @Post('degistir')
  @YalnizKendisi()
  @HttpCode(HttpStatus.NO_CONTENT)
  degistir(
    @Body({ schema: parolaDegistirGovdesiSemasi }) govde: ParolaDegistirGovdesi,
  ): Promise<void> {
    const { oturum } = istekBaglami();
    // Yalnız kendisi işaretli uçta guard oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    // Kimlik alanları gövdeden sonra yazılır: gövde onların üstüne yazamaz (KU-013).
    return this.parolaDegistir.calistir({
      ...govde,
      kullaniciId: oturum.kullaniciId,
      oturumId: oturum.oturumId,
    });
  }
}
