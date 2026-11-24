// Unit of Work'ün run ve read kapıları geçici bir test veritabanında sınanır (KR-011).
// Asıl şemada model olmadığı için tablo ham SQL ile açılır, repository ham sorguyla yazılır.
import { setTimeout as bekle } from 'node:timers/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import {
  RepoBelirteci,
  RepoKayitlari,
} from '../src/shared/database/registrar.js';
import { type Islem, UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

interface AdOkuma {
  adlar(): Promise<string[]>;
}
interface AdRepo extends AdOkuma {
  ekle(ad: string): Promise<void>;
}

const AD_REPO = new RepoBelirteci<AdOkuma, AdRepo>('AdRepo');

let db: TestDatabase;
let havuz: pg.Pool;
let prisma: PrismaClient;
let gozlemci: pg.Client;
let uow: UnitOfWork;
// Bağlantıya giden her deyim, gönderildiği sırayla (test/deneme'deki düzenek).
const deyimler: string[] = [];

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

// Ayrı bağlantıdan okur; run'ın istemcisini kullanmaz.
async function tablodakiAdlar(): Promise<string[]> {
  const sonuc = await gozlemci.query<{ ad: string }>(
    'select ad from ad_kaydi order by ad',
  );
  return sonuc.rows.map((r) => r.ad);
}

beforeAll(async () => {
  db = await createTestDatabase([
    `create table ad_kaydi (
       id uuid primary key default gen_random_uuid(),
       ad text not null unique
     )`,
  ]);
  havuz = kaydedenHavuz(db.url);
  prisma = new PrismaClient({ adapter: new PrismaPg(havuz) });
  gozlemci = new pg.Client({ connectionString: db.url });
  await gozlemci.connect();

  const registrar = new RepoKayitlari();
  registrar.register(AD_REPO, (istemci) => ({
    adlar: async () =>
      (
        await istemci.$queryRaw<
          { ad: string }[]
        >`select ad from ad_kaydi order by ad`
      ).map((r) => r.ad),
    ekle: async (ad) => {
      await istemci.$executeRaw`insert into ad_kaydi (ad) values (${ad})`;
    },
  }));
  uow = new UnitOfWork(prisma, registrar);
});

afterAll(async () => {
  await gozlemci.end();
  await prisma.$disconnect();
  await havuz.end();
  await db.drop();
});

beforeEach(async () => {
  await gozlemci.query('truncate ad_kaydi');
  deyimler.length = 0;
});

describe('run', () => {
  it('a) run içinde yazılan satır, run bitince ayrı bağlantıdan okunur', async () => {
    await uow.run(async (islem) => {
      await islem.repo(AD_REPO).ekle('ayse');
    });

    expect(await tablodakiAdlar()).toEqual(['ayse']);
  });

  it('b) is hata atarsa iki yazma da geri alınır ve hata aynen ulaşır', async () => {
    const hata = new Error('iş bozuldu');

    const sonuc = uow.run(async (islem) => {
      const repo = islem.repo(AD_REPO);
      await repo.ekle('bir');
      await repo.ekle('iki');
      throw hata;
    });

    await expect(sonuc).rejects.toBe(hata);
    expect(await tablodakiAdlar()).toEqual([]);
  });

  it('h) aynı anda koşan iki run birbirini iç içe saymaz ve ikisi de onaylanır', async () => {
    // İki iş de başlayana kadar ikisi de bekler; böylece gerçekten üst üste koşarlar.
    let baslayan = 0;
    let ikisiBasladi: () => void = () => undefined;
    const engel = new Promise<void>((coz) => (ikisiBasladi = coz));
    const is = (ad: string) => async (islem: Islem) => {
      await islem.repo(AD_REPO).ekle(ad);
      baslayan += 1;
      if (baslayan === 2) {
        ikisiBasladi();
      }
      await engel;
    };

    await Promise.all([uow.run(is('e1')), uow.run(is('e2'))]);

    expect(await tablodakiAdlar()).toEqual(['e1', 'e2']);
  });
});

describe('read', () => {
  it('c) read ile okuma işlem açmaz: bağlantıya BEGIN gitmez', async () => {
    await gozlemci.query(`insert into ad_kaydi (ad) values ('okunan')`);

    expect(await uow.read(AD_REPO).adlar()).toEqual(['okunan']);
    expect(deyimler.some((d) => /^\s*select\b/i.test(d))).toBe(true);
    expect(deyimler).not.toContain('BEGIN');
  });

  it('c) karşı test: aynı düzenek run çağrısında BEGIN ve COMMIT yakalar', async () => {
    await uow.run(async (islem) => {
      await islem.repo(AD_REPO).adlar();
    });

    expect(deyimler[0]).toBe('BEGIN');
    expect(deyimler.at(-1)).toBe('COMMIT');
  });
});

describe('iç içe çağrı', () => {
  it('f) run içinde run hata verir ve dıştaki iş geri alınır', async () => {
    const sonuc = uow.run(async (islem) => {
      await islem.repo(AD_REPO).ekle('dis');
      await uow.run(() => Promise.resolve());
    });

    await expect(sonuc).rejects.toThrow('İşlem içindeyken run çağrılamaz');
    expect(await tablodakiAdlar()).toEqual([]);
  });

  it('f) run içinde read hata verir', async () => {
    const sonuc = uow.run(async () => {
      await uow.read(AD_REPO).adlar();
    });

    await expect(sonuc).rejects.toThrow('İşlem içindeyken read çağrılamaz');
  });

  it('karşı test: run içinde başlatılıp beklenmeyen iş, run bitince read çağırabilir', async () => {
    let sonraki: Promise<string[]> | undefined;
    let basla: () => void = () => undefined;
    const engel = new Promise<void>((coz) => (basla = coz));
    await uow.run(() => {
      // İşaret bağlamını miras alan, ama run bittikten sonra koşan iş.
      sonraki = engel.then(() => uow.read(AD_REPO).adlar());
      return Promise.resolve();
    });
    basla();

    await expect(sonraki).resolves.toEqual([]);
  });
});

describe('kapanmış örnek', () => {
  it('g) is fonksiyonunun dışına taşınan Islem örneğinden repo istenince hata verir', async () => {
    let disari: Islem | undefined;
    await uow.run((islem) => {
      disari = islem;
      return Promise.resolve();
    });

    expect(() => disari?.repo(AD_REPO)).toThrow('İşlem kapandı');
  });
});

describe('süre sınırı', () => {
  // Ölçülen Prisma 7.10.1 davranışı: süre dolunca bağlantıya ROLLBACK gider, ama run'ın sözü
  // is fonksiyonu bitince P2028 ("expired transaction") ile reddedilir; COMMIT gönderilmez.
  it('i) 5 saniyeyi aşan iş hatayla biter ve yazması kalmaz', async () => {
    const sonuc = uow.run(async (islem) => {
      await islem.repo(AD_REPO).ekle('gec');
      await bekle(5500);
    });

    await expect(sonuc).rejects.toMatchObject({
      code: 'P2028',
      message: expect.stringContaining('expired transaction') as unknown,
    });
    expect(deyimler).toContain('ROLLBACK');
    expect(deyimler).not.toContain('COMMIT');
    expect(await tablodakiAdlar()).toEqual([]);
  }, 15_000);
});
