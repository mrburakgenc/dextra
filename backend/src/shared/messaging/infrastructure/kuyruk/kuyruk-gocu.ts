import { runMigrations } from 'bullmq';
import pg from 'pg';
import { KUYRUK_SEMASI } from './bullmq-is-kuyrugu.js';

// Kuyruk tablolarını verilen veritabanının kuyruk şemasına kurar ya da günceller. Uygulama
// açılırken kendiliğinden koşmaz; yayın adımında ayrıca çağrılır. Göç tek oturum ister.
export async function kuyrukGocunuKos(connectionString: string): Promise<void> {
  const istemci = new pg.Client({ connectionString });
  await istemci.connect();
  try {
    await runMigrations(istemci, KUYRUK_SEMASI);
  } finally {
    await istemci.end();
  }
}
