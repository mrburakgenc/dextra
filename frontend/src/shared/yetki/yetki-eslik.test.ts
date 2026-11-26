// @vitest-environment node
// DOM istemez; node ortamında import.meta.url dosya adresidir (jsdom'da değildir).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kaydiEtiketle, type YetkiKurali, yetkiKur } from './yetki';

// Sunucu ile ekranın eşlik testi (TS-008 "Doğrulama"): arka yüzün testinin kullandığı veri yerinden
// okunur (backend/test/veri/yetki-eslik.json). Her durumda dosyadaki "yetkilerim" kuralları ekrana
// verilir; ekranın her kayıt ve kolon için kararı, sunucunun aynı kurallarla verdiği karardır.

interface EslikDurumu {
  readonly ad: string;
  readonly kurallar: readonly YetkiKurali[];
  readonly beklenen: Readonly<
    Record<string, Readonly<Record<string, boolean>>>
  >;
}

interface EslikVerisi {
  readonly kaynak: string;
  readonly eylem: string;
  readonly kolonlar: readonly string[];
  readonly kayitlar: readonly Readonly<Record<string, unknown>>[];
  readonly durumlar: readonly EslikDurumu[];
}

const ESLIK = JSON.parse(
  readFileSync(
    new URL('../../../../backend/test/veri/yetki-eslik.json', import.meta.url),
    'utf8',
  ),
) as EslikVerisi;

describe('eşlik verisi (backend/test/veri/yetki-eslik.json): ekran her durumda sunucunun kararını verir', () => {
  it('veri 14 durum ve 210 kayıt-kolon kararı taşır', () => {
    expect(ESLIK.durumlar).toHaveLength(14);
    expect(
      ESLIK.durumlar.flatMap((d) =>
        Object.values(d.beklenen).flatMap((k) => Object.keys(k)),
      ),
    ).toHaveLength(210);
  });

  it.each(ESLIK.durumlar.map((durum) => [durum.ad, durum] as const))(
    '%s',
    (_ad, durum) => {
      const yetki = yetkiKur(durum.kurallar);

      const kararlar = Object.fromEntries(
        ESLIK.kayitlar.map((kayit) => [
          String(kayit['id']),
          Object.fromEntries(
            ESLIK.kolonlar.map((kolon) => [
              kolon,
              yetki.can(ESLIK.eylem, kaydiEtiketle(ESLIK.kaynak, kayit), kolon),
            ]),
          ),
        ]),
      );

      expect(kararlar).toEqual(durum.beklenen);
    },
  );
});
