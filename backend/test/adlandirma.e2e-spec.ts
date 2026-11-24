// Adlandırma denetimi (KR-011 Seçim 7 eki): göçleri uygulanmış iki geçici veritabanında (asıl ve iz)
// public şemasındaki bütün kısıt ve dizin adları Türkçe ekle biter. Şemada elle yazılması unutulan
// bir ad, aracın İngilizce ekiyle sessizce geri gelir; bu test onu yakalar.
import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const ingilizceEkler = ['_pkey', '_idx', '_key', '_fkey', '_check'];
const turkceEkler = ['_ba', '_dizin', '_tekil', '_ya', '_denetim'];

// Kısıtlar ve dizinler, bağlı oldukları tabloyla. Prisma'nın göç defteri tablosu (_prisma_migrations)
// ve onun birincil anahtarı dışarıda bırakılır: o tabloyu şemamız değil, göç aracı kendisi kurar;
// adını şemada vermenin yolu yoktur. NOT NULL kısıtları (contype 'n') da dışarıdadır: PostgreSQL 18'den
// beri katalogda <tablo>_<kolon>_not_null adıyla durur, adı Prisma değil PostgreSQL verir ve şemada
// verilemez; kararın ad biçimleri arasında NOT NULL türü yoktur.
const adlarSql = `
  select distinct ad from (
    select con.conname as ad, tablo.relname as tablo
      from pg_constraint con
      join pg_class tablo on tablo.oid = con.conrelid
     where con.connamespace = 'public'::regnamespace and con.contype <> 'n'
    union all
    select dizin.relname, tablo.relname
      from pg_index i
      join pg_class dizin on dizin.oid = i.indexrelid
      join pg_class tablo on tablo.oid = i.indrelid
     where dizin.relnamespace = 'public'::regnamespace
  ) adlar
  where tablo <> '_prisma_migrations'
  order by ad`;

async function adlar(database: TestDatabase): Promise<string[]> {
  const client = new pg.Client({ connectionString: database.url });
  await client.connect();
  try {
    return (await client.query<{ ad: string }>(adlarSql)).rows.map(
      (satir) => satir.ad,
    );
  } finally {
    await client.end();
  }
}

let asil: TestDatabase;
let iz: TestDatabase;

beforeAll(async () => {
  asil = await createTestDatabase([], { migrations: true });
  iz = await createTestDatabase([], { izMigrations: true });
});

afterAll(async () => {
  // Açılış yarıda kaldıysa açılamayan veritabanı yoktur; yalnız açılanlar silinir.
  const acilanlar = ([asil, iz] as (TestDatabase | undefined)[]).filter(
    (database) => database !== undefined,
  );
  for (const database of acilanlar) {
    await database.drop();
  }
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const kalan = await sunucu.query(
      'select 1 from pg_database where datname = any($1)',
      [acilanlar.map((database) => database.name)],
    );
    expect(kalan.rows).toHaveLength(0);
  } finally {
    await sunucu.end();
  }
});

describe.each([
  { hangisi: 'asil', veritabani: () => asil },
  { hangisi: 'iz', veritabani: () => iz },
])('$hangisi veritabanında kısıt ve dizin adları', ({ veritabani }) => {
  it('hiçbiri aracın İngilizce ekiyle bitmez', async () => {
    const bulunan = await adlar(veritabani());
    expect(bulunan).not.toHaveLength(0);
    expect(
      bulunan.filter((ad) => ingilizceEkler.some((ek) => ad.endsWith(ek))),
    ).toEqual([]);
  });

  it('her biri Türkçe eklerden biriyle biter', async () => {
    const bulunan = await adlar(veritabani());
    expect(bulunan).not.toHaveLength(0);
    expect(
      bulunan.filter((ad) => !turkceEkler.some((ek) => ad.endsWith(ek))),
    ).toEqual([]);
  });
});
