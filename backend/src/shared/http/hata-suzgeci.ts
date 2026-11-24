import type { ServerResponse } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../database/generated/client.js';
import { yeniKimlik } from '../database/kimlik.js';
import { ISTEK_KIMLIGI_BASLIGI } from './istek-baglami.js';
import { HATA_DURUMLARI, type HataKodu, KodluHata } from './kodlu-hata.js';

export interface HataCevabi {
  readonly kod: HataKodu;
  readonly ileti: string;
  readonly ayrinti: unknown;
}

// Veritabanı hatalarının dışarıya dönüşü (KR-011 "Hataların dışarıya dönüşü"): P2002 tekil kısıt;
// P2034 kilitlenme döngüsü ya da yazma çakışması; P2028 işlem yöneticisi hatası (süre aşımıyla
// kapanmış işlemde sorgu ya da onay bunu verir).
const PRISMA_KODLARI: Readonly<Record<string, 'cakisma' | 'yeniden_dene'>> = {
  P2002: 'cakisma',
  P2034: 'yeniden_dene',
  P2028: 'yeniden_dene',
};

const SABIT_ILETILER = {
  cakisma: 'Kayıt başka bir kayıtla çakışıyor',
  yeniden_dene: 'İşlem tamamlanamadı; yeniden deneyin',
  beklenmeyen_hata: 'Beklenmeyen bir hata oluştu',
} as const satisfies Partial<Record<HataKodu, string>>;

// Durumu AK-11 tablosunda olan çatı hatası (ör. eşleşmeyen yol 404) o koda çevrilir.
const DURUM_KODLARI = new Map<number, HataKodu>(
  Object.entries(HATA_DURUMLARI).map(([kod, durum]) => [
    durum,
    kod as HataKodu,
  ]),
);

// Bütün uçların tek hata süzgeci (TS-002 AK-11). Kodlu olmayan hata beklenmeyen_hata olur;
// cevap iç ayrıntı taşımaz, hata günlüğe yazılır.
@Catch()
export class HataSuzgeci implements ExceptionFilter {
  private readonly gunluk = new Logger(HataSuzgeci.name);

  constructor(private readonly adaptor: HttpAdapterHost) {}

  catch(hata: unknown, host: ArgumentsHost): void {
    const cevap = this.cevir(hata);
    const yanit = host.switchToHttp().getResponse<ServerResponse>();
    // Gövde ayrıştırıcısı istek bağlamı ara katmanından önce koşar; bozuk gövdede kimlik henüz
    // verilmemiştir ve burada verilir.
    if (!yanit.hasHeader(ISTEK_KIMLIGI_BASLIGI)) {
      yanit.setHeader(ISTEK_KIMLIGI_BASLIGI, yeniKimlik());
    }
    this.adaptor.httpAdapter.reply(yanit, cevap, HATA_DURUMLARI[cevap.kod]);
  }

  private cevir(hata: unknown): HataCevabi {
    if (hata instanceof KodluHata) {
      return {
        kod: hata.kod,
        ileti: hata.message,
        ayrinti: hata.ayrinti ?? null,
      };
    }
    if (hata instanceof Prisma.PrismaClientKnownRequestError) {
      const kod = PRISMA_KODLARI[hata.code];
      if (kod !== undefined) {
        return { kod, ileti: SABIT_ILETILER[kod], ayrinti: null };
      }
    }
    if (hata instanceof HttpException) {
      const kod = DURUM_KODLARI.get(hata.getStatus());
      if (kod !== undefined && kod !== 'beklenmeyen_hata') {
        return { kod, ileti: hata.message, ayrinti: null };
      }
    }
    this.gunluk.error(hata instanceof Error ? hata.stack : String(hata));
    return {
      kod: 'beklenmeyen_hata',
      ileti: SABIT_ILETILER.beklenmeyen_hata,
      ayrinti: null,
    };
  }
}
