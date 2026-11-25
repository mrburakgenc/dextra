import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { ParolaOzetleyici } from '../../domain/parola-ozetleyici.port.js';

// Argon2id ayarları (KR-009 Seçim 6; OWASP'ın en az ayarları): bellek KiB cinsindendir (19 MiB).
export const ARGON2ID_AYARLARI = {
  memory: 19 * 1024,
  passes: 2,
  parallelism: 1,
} as const;
const TUZ_BAYT = 16;
const OZET_BAYT = 32;
// Node'un Argon2 gerçeklemesinin sürümü (0x13).
const ARGON2_SURUMU = 19;

const argon2Calistir = promisify(argon2);

// Saklanan dizge PHC biçimindedir: $argon2id$v=19$m=<KiB>,t=<tur>,p=<paralellik>$<tuz>$<özet>
// (tuz ve özet dolgusuz base64). Ayarlar dizgede durduğu için ayar değişince eski özet doğrulanabilir.
const PHC_BICIMI =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function dolgusuz(veri: Buffer): string {
  return veri.toString('base64').replace(/=+$/, '');
}

// Parola özetleyicisinin Node'un yerleşik Argon2id işleviyle gerçeklemesi (TS-002 AK-4; paket yok).
@Injectable()
export class Argon2idParolaOzetleyici extends ParolaOzetleyici {
  async ozetle(parola: string): Promise<string> {
    const tuz = randomBytes(TUZ_BAYT);
    const ozet = await argon2Calistir('argon2id', {
      message: parola,
      nonce: tuz,
      tagLength: OZET_BAYT,
      ...ARGON2ID_AYARLARI,
    });
    const { memory, passes, parallelism } = ARGON2ID_AYARLARI;
    return `$argon2id$v=${String(ARGON2_SURUMU)}$m=${String(memory)},t=${String(passes)},p=${String(parallelism)}$${dolgusuz(tuz)}$${dolgusuz(ozet)}`;
  }

  async dogrula(parola: string, saklanan: string): Promise<boolean> {
    const parcalar = PHC_BICIMI.exec(saklanan);
    if (parcalar === null) {
      throw new Error('Saklanan parola özeti çözümlenemedi');
    }
    // Biçim beş grubun hepsini zorunlu tutar.
    const [memory, passes, parallelism, tuz, ozet] = parcalar.slice(1) as [
      string,
      string,
      string,
      string,
      string,
    ];
    const beklenen = Buffer.from(ozet, 'base64');
    const hesaplanan = await argon2Calistir('argon2id', {
      message: parola,
      nonce: Buffer.from(tuz, 'base64'),
      tagLength: beklenen.length,
      memory: Number(memory),
      passes: Number(passes),
      parallelism: Number(parallelism),
    });
    return timingSafeEqual(hesaplanan, beklenen);
  }
}
