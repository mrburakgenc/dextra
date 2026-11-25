import { setTimeout as uyu } from 'node:timers/promises';
import type pg from 'pg';

const YOKLAMA_SINIRI_MS = 5_000;
const YOKLAMA_ARASI_MS = 20;

// Verilen veritabanına, gözlemcinin kendisi ve verilen pid'ler (öbür gözlemciler) dışında açık
// istemci bağlantısı sayısı; o anki sayıdır, beklemez.
export async function baglantiSayisi(
  gozlemci: pg.Client,
  veritabani: string,
  haricPidler: readonly number[],
): Promise<number> {
  const { rows } = await gozlemci.query<{ sayi: number }>(
    `select count(*)::int as sayi from pg_stat_activity
      where datname = $1 and backend_type = 'client backend'
        and pid <> pg_backend_pid() and pid <> all($2::int[])`,
    [veritabani, haricPidler],
  );
  return rows[0]?.sayi ?? -1;
}

// Kapanıştan hemen sonra sorulur: istemci bağlantısını kapatsa da sunucu süreci birkaç ms daha
// görünebilir. Bu yüzden sayı 0 olana dek kısa süre yoklanır; sınır dolarsa son sayı döner.
export async function kalanBaglantiSayisi(
  gozlemci: pg.Client,
  veritabani: string,
  haricPidler: readonly number[],
): Promise<number> {
  const son = Date.now() + YOKLAMA_SINIRI_MS;
  for (;;) {
    const sayi = await baglantiSayisi(gozlemci, veritabani, haricPidler);
    if (sayi === 0 || Date.now() > son) {
      return sayi;
    }
    await uyu(YOKLAMA_ARASI_MS);
  }
}
