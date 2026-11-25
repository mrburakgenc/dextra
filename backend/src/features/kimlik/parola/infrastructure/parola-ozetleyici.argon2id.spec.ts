import { argon2Sync, randomBytes } from 'node:crypto';
import {
  ARGON2ID_AYARLARI,
  Argon2idParolaOzetleyici,
} from './parola-ozetleyici.argon2id.js';

const PAROLA = 'uzun bir parola cümlesi';

describe('Argon2id parola özetleyicisi', () => {
  const ozetleyici = new Argon2idParolaOzetleyici();

  it('doğru parola doğrulanır, yanlış parola reddedilir', async () => {
    const ozet = await ozetleyici.ozetle(PAROLA);

    await expect(ozetleyici.dogrula(PAROLA, ozet)).resolves.toBe(true);
    await expect(
      ozetleyici.dogrula('uzun bir parola cümlesİ', ozet),
    ).resolves.toBe(false);
  });

  it('aynı parolanın iki özeti farklıdır (tuz her özette yenidir)', async () => {
    const birinci = await ozetleyici.ozetle(PAROLA);
    const ikinci = await ozetleyici.ozetle(PAROLA);

    expect(birinci).not.toBe(ikinci);
  });

  it('özet dizgesi algoritmayı, ayarları ve tuzu taşır', async () => {
    const ozet = await ozetleyici.ozetle(PAROLA);

    expect(ARGON2ID_AYARLARI).toEqual({
      memory: 19456,
      passes: 2,
      parallelism: 1,
    });
    expect(ozet).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
  });

  it('başka ayarlarla üretilmiş özet dizgedeki ayarlarla doğrulanır', async () => {
    const tuz = randomBytes(16);
    const ham = argon2Sync('argon2id', {
      message: PAROLA,
      nonce: tuz,
      tagLength: 24,
      memory: 8192,
      passes: 3,
      parallelism: 2,
    });
    const b64 = (veri: Buffer): string =>
      veri.toString('base64').replace(/=+$/, '');
    const ozet = `$argon2id$v=19$m=8192,t=3,p=2$${b64(tuz)}$${b64(ham)}`;

    await expect(ozetleyici.dogrula(PAROLA, ozet)).resolves.toBe(true);
    await expect(ozetleyici.dogrula(`${PAROLA}!`, ozet)).resolves.toBe(false);
  });
});
