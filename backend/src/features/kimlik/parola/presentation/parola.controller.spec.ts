import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  istekBaglamiAraKatmani,
  istekOturumunuYaz,
} from '../../../../shared/observability/istek-baglami/istek-baglami.js';
import type { ParolaBelirleHandler } from '../application/commands/parola-belirle/parola-belirle.handler.js';
import type {
  ParolaDegistirGovdesi,
  ParolaDegistirKomutu,
} from '../application/commands/parola-degistir/parola-degistir.command.js';
import type { ParolaDegistirHandler } from '../application/commands/parola-degistir/parola-degistir.handler.js';
import { ParolaController } from './parola.controller.js';

// KU-013: isteği yapanın kimliği gövdeden okunmaz. Gövdede kimlik alanı olsa bile parola değiştirme
// komutundaki kişi ve oturum istek bağlamındaki oturumdan gelir.
describe('parola denetleyicisi: değiştir', () => {
  it('gövdede kullaniciId ve oturumId olsa da komuttakiler oturumunkidir', async () => {
    let komut: ParolaDegistirKomutu | undefined;
    const degistir = {
      calistir: (k: ParolaDegistirKomutu) => {
        komut = k;
        return Promise.resolve();
      },
    } as unknown as ParolaDegistirHandler;
    const denetleyici = new ParolaController(
      {} as unknown as ParolaBelirleHandler,
      degistir,
    );
    const govde = {
      eskiParola: 'eski',
      yeniParola: 'yeni',
      kullaniciId: 'baskasi',
      oturumId: 'baska-oturum',
    } as unknown as ParolaDegistirGovdesi;

    await new Promise<void>((coz, reddet) => {
      istekBaglamiAraKatmani(
        {} as unknown as IncomingMessage,
        { setHeader: () => undefined } as unknown as ServerResponse,
        () => {
          istekOturumunuYaz({
            kullaniciId: 'ayse',
            oturumId: 'ayse-oturum',
            kisiSurumu: 1,
            genelSurum: 1,
          });
          denetleyici.degistir(govde).then(coz, reddet);
        },
      );
    });

    expect(komut).toMatchObject({
      kullaniciId: 'ayse',
      oturumId: 'ayse-oturum',
      eskiParola: 'eski',
      yeniParola: 'yeni',
    });
  });
});
