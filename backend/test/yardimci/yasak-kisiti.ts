// Yasak satırı gerektiren testler için (TS-008 "Aşamalar", test veritabanı): geçici test veritabanında
// yasak ve sıfırdan farklı öncelik yazımını kapatan geçici kısıtı düşürür. Yalnız test kodundan çağrılır;
// öncelik aralığı kısıtı yerinde kalır.
import pg from 'pg';
import type { TestDatabase } from '../test-database.js';

export async function yasakKisitiniDusur(database: TestDatabase): Promise<void> {
  const client = new pg.Client({ connectionString: database.url });
  await client.connect();
  try {
    await client.query(
      'alter table yetenek drop constraint yetenek_yasak_yazimi_kapali_denetim',
    );
  } finally {
    await client.end();
  }
}
