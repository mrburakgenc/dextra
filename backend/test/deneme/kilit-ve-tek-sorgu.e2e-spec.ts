// GV-003 denemesi: satır kilidi ve üç tablonun tek sorguda okunması. Üretim kodu değildir.
// Koşmadan önce teste ait istemci üretilir:
//   pnpm -C backend exec prisma generate --config test/deneme/prisma.config.ts
// Koşturma:
//   pnpm -C backend test:e2e test/deneme/kilit-ve-tek-sorgu.e2e-spec.ts
// Testler gözlenen davranışı sabitler: davranış değişirse test kırılır, adı yanlış kalmaz.
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createTestDatabase, type TestDatabase } from '../test-database.js';
import { PrismaClient } from './generated/client.js';

const KULLANICI_ID = '11111111-1111-4111-8111-111111111111';
const OTURUM_ID = '22222222-2222-4222-8222-222222222222';

const TABLOLAR = [
  `create table kullanici (
     id uuid primary key,
     kullanici_adi text unique,
     yetki_surumu integer not null,
     pasif_zamani timestamptz
   )`,
  `create table oturum (
     id uuid primary key,
     kullanici_id uuid not null references kullanici (id),
     ip_adresi text not null,
     kapatilma_zamani timestamptz
   )`,
  `create table yetki_surumu (
     id integer primary key,
     sayac integer not null
   )`,
  `insert into kullanici (id, kullanici_adi, yetki_surumu) values ('${KULLANICI_ID}', 'ayse', 1)`,
  `insert into oturum (id, kullanici_id, ip_adresi) values ('${OTURUM_ID}', '${KULLANICI_ID}', '127.0.0.1')`,
  `insert into yetki_surumu (id, sayac) values (1, 1)`,
];

type Gozlem = 'kilitli' | 'serbest';
interface KilitGozlemi {
  forUpdate: Gozlem;
  forKeyShare: Gozlem;
}

let db: TestDatabase;
let havuz: pg.Pool;
let prisma: PrismaClient;
let gozlemci: pg.Client;
// Prisma'nın bağlantıya gönderdiği her deyim, gönderildiği sırayla.
const deyimler: string[] = [];

// Havuzun açtığı her bağlantının query yöntemi sarılır: kayıt, Prisma'nın kendi günlüğünden değil
// sürücüye giden metinden alınır.
function kaydedenHavuz(connectionString: string): pg.Pool {
  const yeni = new pg.Pool({ connectionString });
  yeni.on('connect', (client) => {
    const asil = client.query.bind(client) as (...args: unknown[]) => unknown;
    Object.assign(client, {
      query: (...args: unknown[]): unknown => {
        const ilk = args[0];
        deyimler.push(
          typeof ilk === 'string' ? ilk : (ilk as { text: string }).text,
        );
        return asil(...args);
      },
    });
  });
  return yeni;
}

function selectTablolari(): string[] {
  return deyimler
    .filter((d) => /^\s*select\b/i.test(d))
    .map((d) => /\bFROM "public"\."(\w+)"/.exec(d)?.[1] ?? d);
}

// İkinci bağlantıdan (B) satırı NOWAIT ile kilitlemeyi dener; kilit çakışırsa PostgreSQL 55P03 döner.
async function dene(
  tablo: string,
  id: string | number,
  kip: 'for update' | 'for key share',
): Promise<Gozlem> {
  await gozlemci.query('begin');
  try {
    await gozlemci.query(`select 1 from ${tablo} where id = $1 ${kip} nowait`, [
      id,
    ]);
    return 'serbest';
  } catch (error) {
    if ((error as { code?: string }).code === '55P03') {
      return 'kilitli';
    }
    throw error;
  } finally {
    await gozlemci.query('rollback');
  }
}

async function kilitGozlemi(
  tablo: string,
  id: string | number,
): Promise<KilitGozlemi> {
  return {
    forUpdate: await dene(tablo, id, 'for update'),
    forKeyShare: await dene(tablo, id, 'for key share'),
  };
}

// A işlemi güncellemeyi yapar ve açıkken B'den gözlem alınır.
async function islemAcikkenGozle(
  guncelle: (
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  ) => Promise<unknown>,
  tablo: string,
  id: string | number,
): Promise<KilitGozlemi> {
  return prisma.$transaction(async (tx) => {
    await guncelle(tx);
    return kilitGozlemi(tablo, id);
  });
}

beforeAll(async () => {
  db = await createTestDatabase(TABLOLAR);
  havuz = kaydedenHavuz(db.url);
  prisma = new PrismaClient({ adapter: new PrismaPg(havuz) });
  gozlemci = new pg.Client({ connectionString: db.url });
  await gozlemci.connect();
});

afterAll(async () => {
  await gozlemci.end();
  await prisma.$disconnect();
  await havuz.end();
  await db.drop();
});

beforeEach(() => {
  deyimler.length = 0;
});

describe('gözlem düzeneği (karşı testler)', () => {
  it('açık işlem yokken B her iki kipte de satırı kilitleyebilir', async () => {
    expect(await kilitGozlemi('kullanici', KULLANICI_ID)).toEqual({
      forUpdate: 'serbest',
      forKeyShare: 'serbest',
    });
  });

  it('bilinen iki sorguluk okumada (iki ayrı findUnique) 2 SELECT sayar', async () => {
    await prisma.kullanici.findUnique({ where: { id: KULLANICI_ID } });
    await prisma.yetkiSurumu.findUnique({ where: { id: 1 } });

    expect(selectTablolari()).toEqual(['kullanici', 'yetki_surumu']);
  });
});

describe('satır kilidi (model API, ham SQL yok)', () => {
  it('S1+S2: değer değiştirmeyen kullanici güncellemesi UPDATE gönderir ve anahtar dışı güncelleme kilidi (FOR NO KEY UPDATE) alır', async () => {
    const gozlem = await islemAcikkenGozle(
      (tx) =>
        tx.kullanici.update({
          where: { id: KULLANICI_ID },
          data: { yetkiSurumu: 1 },
        }),
      'kullanici',
      KULLANICI_ID,
    );

    expect(deyimler).toHaveLength(3);
    expect(deyimler[0]).toBe('BEGIN');
    expect(deyimler[1]).toMatch(
      /^UPDATE "public"\."kullanici" SET "yetki_surumu" = \$1 WHERE/,
    );
    expect(deyimler[2]).toBe('COMMIT');
    // S1: FOR UPDATE NOWAIT hata verir → kilit alınmıştır.
    // S2: FOR KEY SHARE NOWAIT geçer → kip tam satır kilidi değil, anahtar dışı güncelleme kilididir.
    expect(gozlem).toEqual({ forUpdate: 'kilitli', forKeyShare: 'serbest' });
  });

  it('S3: tekil dizinli kullanici_adi değerini değiştiren güncelleme tam satır kilidi (FOR UPDATE) alır', async () => {
    const gozlem = await islemAcikkenGozle(
      (tx) =>
        tx.kullanici.update({
          where: { id: KULLANICI_ID },
          data: { kullaniciAdi: `ad-${randomUUID()}` },
        }),
      'kullanici',
      KULLANICI_ID,
    );

    expect(deyimler[1]).toMatch(
      /^UPDATE "public"\."kullanici" SET "kullanici_adi" = \$1 WHERE/,
    );
    expect(gozlem).toEqual({ forUpdate: 'kilitli', forKeyShare: 'kilitli' });
  });

  it('S4: tek satırlı yetki_surumu tablosunda değer değiştirmeyen güncelleme UPDATE gönderir ve anahtar dışı güncelleme kilidi (FOR NO KEY UPDATE) alır', async () => {
    const gozlem = await islemAcikkenGozle(
      (tx) => tx.yetkiSurumu.update({ where: { id: 1 }, data: { sayac: 1 } }),
      'yetki_surumu',
      1,
    );

    expect(deyimler).toHaveLength(3);
    expect(deyimler[1]).toMatch(
      /^UPDATE "public"\."yetki_surumu" SET "sayac" = \$1 WHERE/,
    );
    expect(gozlem).toEqual({ forUpdate: 'kilitli', forKeyShare: 'serbest' });
  });
});

describe('üç tablonun okunması', () => {
  it('S5: oturum, kullanicisi ve yetki_surumu model API ile tek sorguda okunamaz: 3 SELECT gider (include ilişkiyi ayrı SELECT ile çeker)', async () => {
    const [oturum, surum] = await prisma.$transaction([
      prisma.oturum.findUnique({
        where: { id: OTURUM_ID },
        include: { kullanici: true },
      }),
      prisma.yetkiSurumu.findUnique({ where: { id: 1 } }),
    ]);

    expect(oturum?.kullanici.id).toBe(KULLANICI_ID);
    expect(surum?.sayac).toBe(1);
    expect(selectTablolari()).toEqual(['oturum', 'kullanici', 'yetki_surumu']);
  });

  it('S6 (taban çizgisi): üçü tek bir ham SQL ifadesiyle, 1 SELECT ile okunur', async () => {
    const satirlar = await prisma.$queryRaw<
      { oturum_id: string; kullanici_id: string; sayac: number }[]
    >`select o.id as oturum_id, k.id as kullanici_id, y.sayac
        from oturum o
        join kullanici k on k.id = o.kullanici_id
        cross join yetki_surumu y
       where o.id = ${OTURUM_ID}::uuid and y.id = 1`;

    expect(satirlar).toEqual([
      { oturum_id: OTURUM_ID, kullanici_id: KULLANICI_ID, sayac: 1 },
    ]);
    expect(deyimler.filter((d) => /^\s*select\b/i.test(d))).toHaveLength(1);
  });
});
