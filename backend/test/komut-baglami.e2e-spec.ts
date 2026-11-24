// Komut bağlamı (GV-042; TS-002 AK-25). Koşturma:
//   pnpm -C backend test:e2e test/komut-baglami.e2e-spec.ts --reporter=verbose
// Uygulama göçleri ve kuyruk göçü uygulanmış asıl ve iz geçici veritabanlarıyla açılır. Asıl
// veritabanında bekleyen birer outbox_iz ve outbox_olay notu, aktarımının üzerinden saklama süresi
// geçmiş birer not ve sınama tüketicisinin kuyruğunda bir iş vardır. Tohum komutu (kuru ve gerçek)
// ve parola kurulum komutu açılıp kapatıldıktan sonra notlar aktarılmamış ve silinmemiş, iz
// veritabanı boş, kuyruktaki iş işlenmemiştir; aynı düzenek HTTP uygulamasıyla açılınca notlar
// aktarılır, eski notlar silinir ve iş işlenir. Doğrulama sorguları uygulamanın dışındaki pg
// bağlantılarıyla (gözlemci) atılır.
import { execFile } from 'node:child_process';
import { randomUUIDv7 } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as uyu } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Inject, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { DatabaseModule } from '../src/shared/database/database.module.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { BullmqIsKuyrugu } from '../src/shared/messaging/kuyruk/bullmq-is-kuyrugu.js';
import {
  IS_KUYRUGU,
  type IsKuyrugu,
} from '../src/shared/messaging/kuyruk/is-kuyrugu.js';
import { kuyrukGocunuKos } from '../src/shared/messaging/kuyruk/kuyruk-gocu.js';
import { OlayModule } from '../src/shared/messaging/olay/olay.module.js';
import { tuketiciBaslat } from '../src/shared/messaging/tuketici/tuketici-tabani.js';
import { tohumKomutu } from '../src/shared/tohum/tohum-komutu.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type Derleme, derle } from './derleme.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const kos = promisify(execFile);

const TUKETICI = 'komut-baglami-tuketici';
// Sınama tüketicisinin işlediği işlerin kimlikleri.
const islenen: string[] = [];

// Uygulamaya, açılınca kuyruğu dinleyen bir sınama tüketicisi ekleyen kök modül.
@Module({ imports: [AppModule, DatabaseModule, OlayModule] })
class DinleyenKokModul implements OnApplicationBootstrap {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(IS_KUYRUGU) private readonly kuyruk: IsKuyrugu,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await tuketiciBaslat(this.uow, this.kuyruk, TUKETICI, (zarf) => {
      islenen.push(zarf.id);
      return Promise.resolve();
    });
  }
}

interface NotDurumu {
  id: string;
  aktarildi: boolean;
}

let derleme: Derleme;
let databases: AppDatabases;
let asilSql: pg.Client;
let izSql: pg.Client;
let gozlemciPidleri: number[];
const iz = { bekleyen: randomUUIDv7(), eski: randomUUIDv7() };
const olay = { bekleyen: randomUUIDv7(), eski: randomUUIDv7() };
const isKimligi = randomUUIDv7();

async function bekle(
  ne: string,
  sinirMs: number,
  kosul: () => Promise<boolean> | boolean,
): Promise<void> {
  const son = Date.now() + sinirMs;
  while (!(await kosul())) {
    if (Date.now() > son) {
      throw new Error(`${ne}: ${String(sinirMs)} ms içinde gerçekleşmedi`);
    }
    await uyu(25);
  }
}

async function pid(istemci: pg.Client): Promise<number> {
  const { rows } = await istemci.query<{ pid: number }>(
    'select pg_backend_pid() as pid',
  );
  return rows[0]?.pid ?? -1;
}

// Sınamanın bıraktığı notlar, önce aktarılmamışlar; silinen not listede yoktur.
async function notlar(
  tablo: string,
  kimlikler: { bekleyen: string; eski: string },
): Promise<NotDurumu[]> {
  const { rows } = await asilSql.query<NotDurumu>(
    `select id, aktarim_zamani is not null as aktarildi from ${tablo}
      where id = any($1::uuid[]) order by aktarim_zamani nulls first`,
    [[kimlikler.bekleyen, kimlikler.eski]],
  );
  return rows;
}

// Notlar sınamanın kurduğu hâlde mi: bekleyenler aktarılmamış, eskiler silinmemiş.
async function notlarDokunulmamis(): Promise<void> {
  expect(await notlar('outbox_iz', iz)).toEqual([
    { id: iz.bekleyen, aktarildi: false },
    { id: iz.eski, aktarildi: true },
  ]);
  expect(await notlar('outbox_olay', olay)).toEqual([
    { id: olay.bekleyen, aktarildi: false },
    { id: olay.eski, aktarildi: true },
  ]);
}

// Verilen bağlantının veritabanında, şemalardaki bütün tabloların satır sayıları (göç defteri hariç).
async function satirSayilari(
  istemci: pg.Client,
): Promise<Record<string, number>> {
  const { rows: tablolar } = await istemci.query<{ ad: string }>(
    `select format('%I.%I', table_schema, table_name) as ad from information_schema.tables
      where table_schema in ('public', 'kuyruk') and table_type = 'BASE TABLE'
        and table_name <> '_prisma_migrations'
      order by 1`,
  );
  const sayilar: Record<string, number> = {};
  for (const { ad } of tablolar) {
    const { rows } = await istemci.query<{ sayi: number }>(
      `select count(*)::int as sayi from ${ad}`,
    );
    sayilar[ad] = rows[0]?.sayi ?? -1;
  }
  return sayilar;
}

async function izdeSatirYok(): Promise<void> {
  const sayilar = await satirSayilari(izSql);
  expect(Object.keys(sayilar)).toContain('public.degisiklik_kaydi');
  expect(Object.values(sayilar).every((sayi) => sayi === 0)).toBe(true);
}

async function kalanVeritabanlari(adlar: readonly string[]): Promise<string[]> {
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const { rows } = await sunucu.query<{ datname: string }>(
      'select datname from pg_database where datname = any($1)',
      [adlar],
    );
    return rows.map((satir) => satir.datname);
  } finally {
    await sunucu.end();
  }
}

function izGovdesi(): string {
  return JSON.stringify({
    istek_id: randomUUIDv7(),
    kullanici_id: randomUUIDv7(),
    uyelik_id: null,
    yetenek_id: randomUUIDv7(),
    is_adi: 'komut-baglami.sinama',
    baslatan_kullanici_id: null,
    veri_sahibi_kullanici_id: null,
    kaynak: 'sinama_kaydi',
    kayit_id: randomUUIDv7(),
    eylem: 'guncelleme',
    degisen: { ad: { eski: 'Eski', yeni: 'Yeni' } },
  });
}

beforeAll(async () => {
  // Kurulum komutu derlenmiş hâliyle, alt süreç olarak koşar.
  derleme = await derle();
  // Kurulum yarıda kalırsa geçici derleme klasörü ve veritabanları geride kalmaz.
  try {
    databases = await createAppDatabases({ migrations: true });
  } catch (error) {
    await derleme.sil();
    throw error;
  }
  try {
    await kuyrukGocunuKos(databases.asil.url);
    asilSql = new pg.Client({ connectionString: databases.asil.url });
    izSql = new pg.Client({ connectionString: databases.iz.url });
    await asilSql.connect();
    await izSql.connect();
    gozlemciPidleri = [await pid(asilSql), await pid(izSql)];

    // Saklama süresi (3 gün) geçmiş eski notlar ve bekleyen notlar.
    await asilSql.query(
      `insert into outbox_iz (id, surum, govde, aktarim_zamani) values
         ($1, 1, $3::jsonb, null),
         ($2, 1, $4::jsonb, clock_timestamp() - interval '30 days')`,
      [iz.bekleyen, iz.eski, izGovdesi(), izGovdesi()],
    );
    await asilSql.query(
      `insert into outbox_olay (id, ad, surum, govde, aktarim_zamani) values
         ($1, 'komut-baglami.oldu', 1, '{}'::jsonb, null),
         ($2, 'komut-baglami.oldu', 1, '{}'::jsonb, clock_timestamp() - interval '30 days')`,
      [olay.bekleyen, olay.eski],
    );
    // Sınama tüketicisinin kuyruğuna bir iş; komut bağlamında dinleyici açılmadığı için işlenmez.
    const kuyruk = new BullmqIsKuyrugu(databases.asil.url);
    try {
      await kuyruk.koy(TUKETICI, {
        kimlik: isKimligi,
        ad: 'komut-baglami.oldu',
        veri: { surum: 1, govde: {} },
      });
    } finally {
      await kuyruk.onApplicationShutdown();
    }
  } catch (error) {
    await databases.drop();
    await derleme.sil();
    throw error;
  }
}, 120_000);

afterAll(async () => {
  const acikKalan = {
    asil: await kalanBaglantiSayisi(
      asilSql,
      databases.asil.name,
      gozlemciPidleri,
    ),
    iz: await kalanBaglantiSayisi(asilSql, databases.iz.name, gozlemciPidleri),
  };
  await asilSql.end();
  await izSql.end();
  await databases.drop();
  await derleme.sil();
  expect(acikKalan).toEqual({ asil: 0, iz: 0 });
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

describe('komut bağlamı', () => {
  it('a) tohum komutunun kuru koşusu açılıp kapanınca notlar aktarılmamış ve silinmemiştir, iş işlenmemiştir, iki veritabanında da satır sayıları değişmemiştir', async () => {
    const once = await satirSayilari(asilSql);

    expect(await tohumKomutu(DinleyenKokModul, true)).toEqual([
      '202611240000-kimlik-kurulum',
    ]);

    await notlarDokunulmamis();
    await izdeSatirYok();
    expect(islenen).toEqual([]);
    expect(await satirSayilari(asilSql)).toEqual(once);
  });

  it('b) tohum komutunun gerçek koşusu açılıp kapanınca notlar aktarılmamış ve silinmemiştir, iz veritabanında satır yoktur, iş işlenmemiştir', async () => {
    expect(await tohumKomutu(DinleyenKokModul, false)).toEqual([
      '202611240000-kimlik-kurulum',
    ]);

    await notlarDokunulmamis();
    await izdeSatirYok();
    expect(islenen).toEqual([]);
  });

  it('c) parola kurulum komutu (derlenmiş, alt süreç) başarıyla biter; ardından notlar aktarılmamış ve silinmemiştir, iz veritabanında satır yoktur', async () => {
    // Alt süreç, geçici veritabanlarını gösteren ortamı (createAppDatabases) devralır.
    const { stdout } = await kos(
      process.execPath,
      [join(derleme.klasor, 'kurulum.js')],
      { cwd: backendDir },
    );

    expect(stdout).toContain('İlk SuperAdmin için parola bağlantısı kodu');
    await notlarDokunulmamis();
    await izdeSatirYok();
  }, 30_000);

  it('d) aynı düzenek HTTP uygulamasıyla açılınca bekleyen notlar aktarılır, eski notlar silinir ve kuyruktaki iş işlenir', async () => {
    const app = await NestFactory.create(DinleyenKokModul);
    try {
      await app.init();
      await bekle('notlar aktarılır ve eskiler silinir', 15_000, async () => {
        const [izNotlari, olayNotlari] = [
          await notlar('outbox_iz', iz),
          await notlar('outbox_olay', olay),
        ];
        return (
          JSON.stringify(izNotlari) ===
            JSON.stringify([{ id: iz.bekleyen, aktarildi: true }]) &&
          JSON.stringify(olayNotlari) ===
            JSON.stringify([{ id: olay.bekleyen, aktarildi: true }])
        );
      });
      await bekle('iş işlenir', 15_000, () => islenen.includes(isKimligi));
      const { rows } = await izSql.query<{ id: string }>(
        'select id from degisiklik_kaydi where id = $1',
        [iz.bekleyen],
      );
      expect(rows).toEqual([{ id: iz.bekleyen }]);
    } finally {
      await app.close();
    }
  }, 40_000);
});
