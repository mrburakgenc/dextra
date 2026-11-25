// Tohum göçü koşucusu ve defteri (GV-025; TS-002 AK-1). Koşturma:
//   pnpm -C backend test:e2e test/tohum-kosucu.e2e-spec.ts --reporter=verbose
// Testler göçleri uygulanmış geçici veritabanında koşar. Gerçek tohum göçü yoktur; sınama göçleri
// burada bildirilir ve yalnız sınama için açılan sinama_tohum tablosuna yazar. Doğrulama sorguları
// koşucunun dışındaki bir pg bağlantısıyla (gözlemci) atılır.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as uyu } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Inject, Module } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { RepoBelirteci } from '../src/shared/database/domain/repo-belirteci.js';
import { RepoKayitlari } from '../src/shared/database/infrastructure/registrar.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
import {
  TohumDefteri,
  type TohumGocu,
} from '../src/shared/tohum/application/tohum-defteri.js';
import { tohumGocuRepoKaydet } from '../src/shared/tohum/infrastructure/tohum-gocu.prisma-repository.js';
import { tohumKomutu } from '../src/shared/tohum/infrastructure/tohum-komutu.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import { TohumModule } from '../src/shared/tohum/tohum.module.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { derle } from './derleme.js';
import { localInfrastructure } from './local-infrastructure.js';
import {
  type AppDatabases,
  createAppDatabases,
  createTestDatabase,
  type TestDatabase,
} from './test-database.js';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const gocKlasoru = `${backendDir}prisma/migrations`;
const tohumGocuGocu = '20261124233000_tohum_gocu';

// Bu görevden önceki göç dosyalarının SHA-256 özetleri (HEAD a55f128).
const oncekiGocOzetleri: Record<string, string> = {
  '20261124163457_outbox':
    'a32d08e15b19ddc59eb92d90620aff9af00083d3a85aa7c85f134f9f7c8706e8',
  '20261124200000_islenen_olay':
    '801b7652b3af1c89d23113aa37b51cf09edadb8f261954571725630b12000e81',
  '20261124210000_outbox_olay_deneme':
    '4bdf4ea2d6e1344e317110536b281abd52e323424614c99a29225885fd1a8644',
  '20261124220000_islenen_olay_sahip_id':
    '088d120132194db5ac0e31b6793fa577e4747cdacb3950d4b94d4bb3441be849',
  '20261124230000_kimlik':
    'dbca07e47217c52a85db009a1f418189fe1ca73fa36a471ffc4a03ea926a84e1',
};

const BIR = '202611240001-sinama-bir';
const IKI = '202611240002-sinama-iki';
const UC = '202611240003-sinama-uc';

interface SinamaRepo {
  ekle(ad: string): Promise<void>;
}
const SINAMA_REPO = new RepoBelirteci<unknown, SinamaRepo>('SinamaRepo');

let db: TestDatabase;
let gozlemci: pg.Client;
let gozlemciPid: number;
const istemciler: PrismaClient[] = [];
// Sınama göçlerinin çağrıldığı sıra (geri alınan çağrılar da sayılır).
const cagrilar: string[] = [];

// Ayrı bir süreç gibi: kendi istemcisi, kendi kayıtları ve kendi Unit of Work'ü.
function yeniUow(): UnitOfWork {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });
  istemciler.push(prisma);
  const kayitlar = new RepoKayitlari();
  tohumGocuRepoKaydet(kayitlar);
  kayitlar.register(SINAMA_REPO, (istemci) => ({
    ekle: async (ad) => {
      await istemci.$executeRaw`insert into sinama_tohum (ad) values (${ad})`;
    },
  }));
  return new UnitOfWork(prisma, kayitlar);
}

// Adını çağrılara ve sinama_tohum tablosuna yazar; istenirse işlemi açık tutarak bekler.
function sinamaGocu(beklemeMs = 0): TohumGocu {
  return async (ad, islem) => {
    cagrilar.push(ad);
    await islem.repo(SINAMA_REPO).ekle(ad);
    await uyu(beklemeMs);
  };
}

function ikiGocluDefter(ikinci: TohumGocu = sinamaGocu()): TohumDefteri {
  const defter = new TohumDefteri();
  defter.bildir(BIR, sinamaGocu());
  defter.bildir(IKI, ikinci);
  return defter;
}

async function sinamaVerisi(): Promise<string[]> {
  const { rows } = await gozlemci.query<{ ad: string }>(
    'select ad from sinama_tohum order by ad',
  );
  return rows.map((r) => r.ad);
}

// Defter satırları, yazıldıkları sırayla.
async function defterSatirlari(): Promise<string[]> {
  const { rows } = await gozlemci.query<{ ad: string }>(
    'select ad from tohum_gocu order by uygulanma_zamani, ad',
  );
  return rows.map((r) => r.ad);
}

async function sunucudaVarMi(veritabani: string): Promise<boolean> {
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const { rows } = await sunucu.query(
      'select 1 from pg_database where datname = $1',
      [veritabani],
    );
    return rows.length > 0;
  } finally {
    await sunucu.end();
  }
}

beforeAll(async () => {
  // Sınama tablosunun birincil anahtarı yoktur: bir göç iki kez uygulanırsa iki satır görünür.
  db = await createTestDatabase(['create table sinama_tohum (ad text not null)'], {
    migrations: true,
  });
  gozlemci = new pg.Client({ connectionString: db.url });
  await gozlemci.connect();
  const { rows } = await gozlemci.query<{ pid: number }>(
    'select pg_backend_pid() as pid',
  );
  gozlemciPid = rows[0]?.pid ?? -1;
});

afterAll(async () => {
  await Promise.all(istemciler.map((istemci) => istemci.$disconnect()));
  const acikKalan = await kalanBaglantiSayisi(gozlemci, db.name, [gozlemciPid]);
  await gozlemci.end();
  await db.drop();
  expect(acikKalan).toBe(0);
  expect(await sunucudaVarMi(db.name)).toBe(false);
});

beforeEach(async () => {
  await gozlemci.query('truncate sinama_tohum, tohum_gocu');
  cagrilar.length = 0;
});

describe('a) göç', () => {
  it('a) tohum_gocu kolonları hedefteki gibidir; birincil anahtar ad ve adı tohum_gocu_ba, başka kısıt ve dizin yoktur', async () => {
    const { rows: kolonlar } = await gozlemci.query<{ satir: string }>(
      `select column_name || ' | ' || data_type || ' | ' || is_nullable || ' | ' ||
              coalesce(column_default, '-') as satir
         from information_schema.columns
        where table_schema = 'public' and table_name = 'tohum_gocu'
        order by ordinal_position`,
    );
    const { rows: kisitlar } = await gozlemci.query<{
      conname: string;
      tanim: string;
    }>(
      `select conname, pg_get_constraintdef(oid) as tanim from pg_constraint
        where conrelid = 'tohum_gocu'::regclass and contype <> 'n'`,
    );
    const { rows: dizinler } = await gozlemci.query<{ ad: string }>(
      `select indexrelid::regclass::text as ad from pg_index
        where indrelid = 'tohum_gocu'::regclass`,
    );
    expect(kolonlar.map((k) => k.satir)).toEqual([
      'ad | text | NO | -',
      'uygulanma_zamani | timestamp with time zone | NO | clock_timestamp()',
    ]);
    expect(kisitlar).toEqual([
      { conname: 'tohum_gocu_ba', tanim: 'PRIMARY KEY (ad)' },
    ]);
    expect(dizinler.map((d) => d.ad)).toEqual(['tohum_gocu_ba']);
  });

  it('a) önceki göç dosyaları değişmemiştir; tohum_gocu göçü ayrı klasördedir ve göç klasörlerinin hepsi uygulanmıştır', async ({
    annotate,
  }) => {
    const klasorler = (await readdir(gocKlasoru, { withFileTypes: true }))
      .filter((g) => g.isDirectory())
      .map((g) => g.name)
      .sort();
    const ozetler: Record<string, string> = {};
    for (const goc of Object.keys(oncekiGocOzetleri)) {
      ozetler[goc] = createHash('sha256')
        .update(await readFile(`${gocKlasoru}/${goc}/migration.sql`))
        .digest('hex');
    }
    const { rows: uygulanan } = await gozlemci.query<{
      migration_name: string;
    }>(
      'select migration_name from _prisma_migrations where finished_at is not null order by migration_name',
    );
    await annotate(`göç klasörleri: ${JSON.stringify(klasorler)}`);
    expect(ozetler).toEqual(oncekiGocOzetleri);
    expect(klasorler).toContain(tohumGocuGocu);
    expect(uygulanan.map((g) => g.migration_name)).toEqual(klasorler);
  });

  it("a) Prisma'nın migrate diff komutu şema ile göçleri uygulanmış veritabanı arasında fark görmez", async () => {
    // Fark denetimi sınama tablosunu görmesin diye göçleri uygulanmış ayrı bir veritabanında koşar.
    const temiz = await createTestDatabase([], { migrations: true });
    try {
      // --exit-code: fark yoksa 0, fark varsa 2 ile biter; 0 dışı çıkış execFile'ı reddettirir.
      const { stdout } = await promisify(execFile)(
        `${backendDir}node_modules/.bin/prisma`,
        [
          'migrate',
          'diff',
          '--from-config-datasource',
          '--to-schema',
          'prisma/schema.prisma',
          '--script',
          '--exit-code',
        ],
        { cwd: backendDir, env: { ...process.env, DATABASE_URL: temiz.url } },
      );
      expect(stdout).toContain('-- This is an empty migration.');
    } finally {
      await temiz.drop();
    }
  }, 30_000);
});

describe('b-g) koşucu ve defter', () => {
  it('b) bildirilen iki göç sırayla uygulanır ve deftere yazılır', async () => {
    const kosucu = new TohumKosucusu(yeniUow(), ikiGocluDefter());

    expect(await kosucu.kos()).toEqual([BIR, IKI]);
    expect(cagrilar).toEqual([BIR, IKI]);
    expect(await sinamaVerisi()).toEqual([BIR, IKI]);
    expect(await defterSatirlari()).toEqual([BIR, IKI]);
  });

  it('c) ikinci koşuda hiçbir göç yeniden uygulanmaz', async () => {
    const kosucu = new TohumKosucusu(yeniUow(), ikiGocluDefter());
    await kosucu.kos();
    cagrilar.length = 0;

    expect(await kosucu.kos()).toEqual([]);
    expect(cagrilar).toEqual([]);
    expect(await sinamaVerisi()).toEqual([BIR, IKI]);
    expect(await defterSatirlari()).toEqual([BIR, IKI]);
  });

  it('d) ikinci göç hata verirse birincinin verisi ve defter satırı kalır, ikincininki kalmaz; hata bildirilir; düzelince yalnız ikinci uygulanır', async () => {
    const hata = new Error('sınama hatası');
    let bozuk = true;
    // Önce veri yazar, sonra (bozukken) hata atar: geri alınmazsa verisi görünür.
    const ikinci: TohumGocu = async (ad, islem) => {
      cagrilar.push(ad);
      await islem.repo(SINAMA_REPO).ekle(ad);
      if (bozuk) {
        throw hata;
      }
    };
    const kosucu = new TohumKosucusu(yeniUow(), ikiGocluDefter(ikinci));

    const sonuc = kosucu.kos();
    await expect(sonuc).rejects.toThrow(IKI);
    await expect(sonuc).rejects.toHaveProperty('cause', hata);
    expect(await sinamaVerisi()).toEqual([BIR]);
    expect(await defterSatirlari()).toEqual([BIR]);

    bozuk = false;
    cagrilar.length = 0;
    expect(await kosucu.kos()).toEqual([IKI]);
    expect(cagrilar).toEqual([IKI]);
    expect(await sinamaVerisi()).toEqual([BIR, IKI]);
    expect(await defterSatirlari()).toEqual([BIR, IKI]);
  });

  it('d) hata veren göçten sonraki göçler koşmaz', async () => {
    const defter = new TohumDefteri();
    defter.bildir(BIR, () => Promise.reject(new Error('sınama hatası')));
    defter.bildir(IKI, sinamaGocu());

    await expect(new TohumKosucusu(yeniUow(), defter).kos()).rejects.toThrow(
      BIR,
    );
    expect(cagrilar).toEqual([]);
    expect(await sinamaVerisi()).toEqual([]);
    expect(await defterSatirlari()).toEqual([]);
  });

  it('e) aynı anda başlatılan iki koşucuda her göç bir kez uygulanır ve ikisi de hatasız biter', async () => {
    // Göçler işlemi açık tutarak bekler; böylece ikinci koşucu aynı göçe birincinin işlemi açıkken gelir.
    const defter = (): TohumDefteri => {
      const d = new TohumDefteri();
      d.bildir(BIR, sinamaGocu(300));
      d.bildir(IKI, sinamaGocu(300));
      return d;
    };
    const birinci = new TohumKosucusu(yeniUow(), defter());
    const ikinci = new TohumKosucusu(yeniUow(), defter());

    const [a, b] = await Promise.all([birinci.kos(), ikinci.kos()]);

    expect([...a, ...b].sort()).toEqual([BIR, IKI]);
    expect([...cagrilar].sort()).toEqual([BIR, IKI]);
    expect(await sinamaVerisi()).toEqual([BIR, IKI]);
    expect(await defterSatirlari()).toEqual([BIR, IKI]);
  });

  it('f) kuru koşu bekleyen göçleri çalıştırır ve adlarını bildirir; ardından veritabanında ne veri ne defter satırı vardır', async () => {
    const kosucu = new TohumKosucusu(yeniUow(), ikiGocluDefter());

    expect(await kosucu.kuruKos()).toEqual([BIR, IKI]);
    expect(cagrilar).toEqual([BIR, IKI]);
    expect(await sinamaVerisi()).toEqual([]);
    expect(await defterSatirlari()).toEqual([]);
  });

  it('f) kuru koşu uygulanmış göçü bildirmez ve ona dokunmaz', async () => {
    const tekGoclu = new TohumDefteri();
    tekGoclu.bildir(BIR, sinamaGocu());
    await new TohumKosucusu(yeniUow(), tekGoclu).kos();
    cagrilar.length = 0;

    expect(
      await new TohumKosucusu(yeniUow(), ikiGocluDefter()).kuruKos(),
    ).toEqual([IKI]);
    expect(cagrilar).toEqual([IKI]);
    expect(await sinamaVerisi()).toEqual([BIR]);
    expect(await defterSatirlari()).toEqual([BIR]);
  });

  it('g) aynı ad iki kez bildirilince hata verir', () => {
    const defter = new TohumDefteri();
    defter.bildir(BIR, sinamaGocu());

    expect(() => {
      defter.bildir(BIR, sinamaGocu());
    }).toThrow(BIR);
    expect(defter.sirayla().map(([ad]) => ad)).toEqual([BIR]);
  });

  it('i) sırasız bildirilen üç göç ada göre sırayla uygulanır ve deftere yazılır (GV-042; TS-002 AK-24)', async () => {
    const defter = new TohumDefteri();
    defter.bildir(UC, sinamaGocu());
    defter.bildir(BIR, sinamaGocu());
    defter.bildir(IKI, sinamaGocu());

    expect(await new TohumKosucusu(yeniUow(), defter).kos()).toEqual([
      BIR,
      IKI,
      UC,
    ]);
    expect(cagrilar).toEqual([BIR, IKI, UC]);
    expect(await defterSatirlari()).toEqual([BIR, IKI, UC]);
  });

  it('i) adı YYYYAAGGSSDD-<feature>-<konu> biçimine uymayan göç bildirimde hata verir ve deftere girmez', () => {
    const defter = new TohumDefteri();
    for (const ad of [
      '0001-sinama-bir',
      '20261124000-sinama-bir',
      '202611240000-sinama',
      '202611240000-Sinama-bir',
      '202611240000-sinama-bir2',
      '202611240000-sinama--bir',
      '202611240000-sinama-bir-',
    ]) {
      expect(() => {
        defter.bildir(ad, sinamaGocu());
      }).toThrow(
        `${ad} tohum göçünün adı YYYYAAGGSSDD-<feature>-<konu> biçiminde değil`,
      );
    }
    expect(defter.sirayla()).toEqual([]);
  });
});

describe('h) komut', () => {
  const KOMUT_GOCU = '202611240004-sinama-komut';
  let databases: AppDatabases | undefined;

  // Uygulamaya bir sınama göçü bildiren kök modül.
  @Module({ imports: [AppModule, TohumModule] })
  class SinamaKokModulu {
    constructor(@Inject(TohumDefteri) defter: TohumDefteri) {
      defter.bildir(KOMUT_GOCU, (ad) => {
        cagrilar.push(ad);
        return Promise.resolve();
      });
    }
  }

  afterAll(async () => {
    if (databases !== undefined) {
      const adlar = [databases.asil.name, databases.iz.name];
      await databases.drop();
      for (const ad of adlar) {
        expect(await sunucudaVarMi(ad)).toBe(false);
      }
    }
  });

  it('h) derleme tohum.js dosyasını üretir; komutun işlevi geçici veritabanına karşı başarıyla döner ve bağlamı kapatır; derlenmiş komut başarıda 0, hatada 0 olmayan kodla çıkar', async ({
    annotate,
  }) => {
    // Derleme bu teste özgü geçici klasöre yapılır; test bitince klasör silinir.
    const derleme = await derle();
    onTestFinished(() => derleme.sil());
    const tohumJs = join(derleme.klasor, 'tohum.js');
    await access(tohumJs);

    databases = await createAppDatabases({ migrations: true });
    const asil = new pg.Client({ connectionString: databases.asil.url });
    await asil.connect();
    try {
      const { rows } = await asil.query<{ pid: number }>(
        'select pg_backend_pid() as pid',
      );
      const asilPid = rows[0]?.pid ?? -1;
      const defter = async (): Promise<string[]> =>
        (await asil.query<{ ad: string }>('select ad from tohum_gocu')).rows.map(
          (r) => r.ad,
        );

      expect(await tohumKomutu(SinamaKokModulu, true)).toContain(KOMUT_GOCU);
      expect(await defter()).toEqual([]);
      expect(await tohumKomutu(SinamaKokModulu, false)).toContain(KOMUT_GOCU);
      expect(await defter()).toContain(KOMUT_GOCU);
      expect(await tohumKomutu(SinamaKokModulu, false)).toEqual([]);
      expect(cagrilar).toEqual([KOMUT_GOCU, KOMUT_GOCU]);
      // Bağlam kapanınca asıl ve iz veritabanlarında açık bağlantı kalmaz.
      expect(
        await kalanBaglantiSayisi(asil, databases.asil.name, [asilPid]),
      ).toBe(0);
      expect(
        await kalanBaglantiSayisi(asil, databases.iz.name, [asilPid]),
      ).toBe(0);

      // Derlenmiş komut, ortamı geçici veritabanlarını gösteren alt süreç olarak.
      const kos = promisify(execFile);
      const kuru = await kos(process.execPath, [tohumJs, '--kuru'], {
        cwd: backendDir,
      });
      const gercek = await kos(process.execPath, [tohumJs], {
        cwd: backendDir,
      });
      // Standart çıktıda Nest'in açılış günlüğü de vardır; komutun kendi satırı sondadır.
      await annotate(
        `kuru: ${kuru.stdout.trim().split('\n').at(-1) ?? ''} · gerçek: ${gercek.stdout.trim().split('\n').at(-1) ?? ''}`,
      );
      expect(kuru.stdout).toContain('Uygulanacak tohum göçleri: (yok)');
      expect(gercek.stdout).toContain('Uygulanan tohum göçleri: (yok)');

      const adresiz = Object.fromEntries(
        Object.entries(process.env).filter(([ad]) => ad !== 'DATABASE_URL'),
      );
      const hatali = kos(process.execPath, [tohumJs], {
        cwd: backendDir,
        env: adresiz,
      });
      await expect(hatali).rejects.toMatchObject({ code: 1 });
    } finally {
      await asil.end();
    }
  }, 120_000);
});
