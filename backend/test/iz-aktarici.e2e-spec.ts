// İz aktarıcısının tek geçişi iki geçici veritabanında sınanır: biri asıl şemanın, öbürü iz
// şemasının göçleri uygulanmış olarak. Notlar outbox_iz'e doğrudan SQL ile eklenir.
import { execFile } from 'node:child_process';
import { randomUUID, randomUUIDv7 } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { PrismaClient as IzPrismaClient } from '../src/shared/database/iz/generated/client.js';
import { RepoKayitlari } from '../src/shared/database/infrastructure/registrar.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
import {
  IzAktarici,
  PartiHatasi,
} from '../src/shared/observability/iz/iz-aktarici.js';
import { OUTBOX_IZ_REPO } from '../src/shared/observability/iz/i-outbox-iz.repository.js';
import { outboxIzRepoKaydet } from '../src/shared/observability/iz/outbox-iz.prisma-repository.js';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

// Hedefteki kolon listesi, sırayla: "ad | tür | boş olabilir mi | varsayılan" ("-": varsayılan yok).
const degisiklikKaydiKolonlari = [
  'id | uuid | NO | -',
  'istek_id | uuid | YES | -',
  'kullanici_id | uuid | NO | -',
  'uyelik_id | uuid | YES | -',
  'yetenek_id | uuid | YES | -',
  'is_adi | text | NO | -',
  'baslatan_kullanici_id | uuid | YES | -',
  'veri_sahibi_kullanici_id | uuid | YES | -',
  'kaynak | text | NO | -',
  'kayit_id | uuid | NO | -',
  'eylem | text | NO | -',
  'degisen | jsonb | NO | -',
  'olusma_zamani | timestamp with time zone | NO | -',
  'yazilma_zamani | timestamp with time zone | NO | clock_timestamp()',
];

// Gövdenin anahtarları; boş olabilenler ayrıca listelenir.
const govdeAnahtarlari = [
  'istek_id',
  'kullanici_id',
  'uyelik_id',
  'yetenek_id',
  'is_adi',
  'baslatan_kullanici_id',
  'veri_sahibi_kullanici_id',
  'kaynak',
  'kayit_id',
  'eylem',
  'degisen',
] as const;
const bosOlabilenler = [
  'istek_id',
  'uyelik_id',
  'yetenek_id',
  'baslatan_kullanici_id',
  'veri_sahibi_kullanici_id',
] as const;

type Govde = Record<string, unknown>;

// Boş olabilir alanlar "dolu", "yok" (anahtar hiç yok) ya da "null" olarak yazılır.
function govdeUret(bosAlanlar: 'dolu' | 'yok' | 'null' = 'dolu'): Govde {
  const govde: Govde = {
    istek_id: randomUUID(),
    kullanici_id: randomUUID(),
    uyelik_id: randomUUID(),
    yetenek_id: randomUUID(),
    is_adi: 'ornek.guncelle',
    baslatan_kullanici_id: randomUUID(),
    veri_sahibi_kullanici_id: randomUUID(),
    kaynak: 'ornek',
    kayit_id: randomUUID(),
    eylem: 'guncelleme',
    degisen: { ad: { eski: 'a', yeni: 'b' } },
  };
  const bos = new Set<string>(bosOlabilenler);
  return Object.fromEntries(
    Object.entries(govde).flatMap(([anahtar, deger]) => {
      if (bosAlanlar === 'dolu' || !bos.has(anahtar)) return [[anahtar, deger]];
      return bosAlanlar === 'null' ? [[anahtar, null]] : [];
    }),
  );
}

interface NotGirdisi {
  id?: string;
  surum?: number;
  govde?: Govde;
  // SQL ifadesi; örnek: "clock_timestamp() + interval '1 hour'".
  sonrakiDeneme?: string;
}

let asil: TestDatabase;
let iz: TestDatabase;
let asilSql: pg.Client;
let izSql: pg.Client;
let prisma: PrismaClient;
let izPrisma: IzPrismaClient;
let uow: UnitOfWork;
let aktarici: IzAktarici;

async function notEkle(notlar: readonly NotGirdisi[]): Promise<string[]> {
  const kimlikler: string[] = [];
  for (const not of notlar) {
    const id = not.id ?? randomUUIDv7();
    await asilSql.query(
      `insert into outbox_iz (id, surum, govde, sonraki_deneme_zamani)
       values ($1, $2, $3, ${not.sonrakiDeneme ?? 'null'})`,
      [id, not.surum ?? 1, JSON.stringify(not.govde ?? govdeUret())],
    );
    kimlikler.push(id);
  }
  return kimlikler;
}

async function izKimlikleri(): Promise<string[]> {
  const sonuc = await izSql.query<{ id: string }>(
    'select id from degisiklik_kaydi order by id',
  );
  return sonuc.rows.map((satir) => satir.id);
}

async function aktarilmislar(): Promise<string[]> {
  const sonuc = await asilSql.query<{ id: string }>(
    'select id from outbox_iz where aktarim_zamani is not null order by id',
  );
  return sonuc.rows.map((satir) => satir.id);
}

beforeAll(async () => {
  asil = await createTestDatabase([], { migrations: true });
  iz = await createTestDatabase([], { izMigrations: true });
  asilSql = new pg.Client({ connectionString: asil.url });
  izSql = new pg.Client({ connectionString: iz.url });
  await asilSql.connect();
  await izSql.connect();
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: asil.url }),
  });
  izPrisma = new IzPrismaClient({
    adapter: new PrismaPg({ connectionString: iz.url }),
  });
  const kayitlar = new RepoKayitlari();
  outboxIzRepoKaydet(kayitlar);
  uow = new UnitOfWork(prisma, kayitlar);
  aktarici = new IzAktarici(uow, izPrisma);
});

afterAll(async () => {
  // Açılış yarıda kaldıysa yalnız açılanlar kapatılır; asıl hatanın yanına ikinci hata eklenmez.
  const acik = [
    asilSql as pg.Client | undefined,
    izSql as pg.Client | undefined,
  ];
  for (const client of acik) {
    await client?.end();
  }
  await (prisma as PrismaClient | undefined)?.$disconnect();
  await (izPrisma as IzPrismaClient | undefined)?.$disconnect();
  const veritabanlari = [
    asil as TestDatabase | undefined,
    iz as TestDatabase | undefined,
  ];
  for (const veritabani of veritabanlari) {
    await veritabani?.drop();
  }
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const kalan = await sunucu.query(
      'select 1 from pg_database where datname = any($1)',
      [veritabanlari.map((veritabani) => veritabani?.name)],
    );
    expect(kalan.rows).toHaveLength(0);
  } finally {
    await sunucu.end();
  }
});

beforeEach(async () => {
  await asilSql.query('truncate outbox_iz');
  await izSql.query('truncate degisiklik_kaydi');
});

describe('a) iz şemasının ilk göçü', () => {
  it('degisiklik_kaydi kolonları ad, tür, boş olabilirlik ve varsayılan olarak hedefle birebir aynıdır', async () => {
    const sonuc = await izSql.query<{ kolon: string }>(
      `select concat_ws(' | ', column_name, data_type, is_nullable,
                        coalesce(column_default, '-')) as kolon
         from information_schema.columns
        where table_schema = 'public' and table_name = 'degisiklik_kaydi'
        order by ordinal_position`,
    );
    expect(sonuc.rows.map((satir) => satir.kolon)).toEqual(
      degisiklikKaydiKolonlari,
    );
  });

  it('degisiklik_kaydi tablosunda birincil anahtardan başka dizin ve hiçbir yabancı anahtar yoktur; değişiklik kaydı ve göç defteri vardır', async () => {
    const dizinler = await izSql.query(
      `select indexname, indexdef from pg_indexes
        where schemaname = 'public' and tablename = 'degisiklik_kaydi'`,
    );
    expect(dizinler.rows).toEqual([
      {
        indexname: 'degisiklik_kaydi_ba',
        indexdef:
          'CREATE UNIQUE INDEX degisiklik_kaydi_ba ON public.degisiklik_kaydi USING btree (id)',
      },
    ]);
    const yabanciAnahtarlar = await izSql.query(
      "select 1 from pg_constraint where contype = 'f' and conrelid = 'public.degisiklik_kaydi'::regclass",
    );
    expect(yabanciAnahtarlar.rows).toHaveLength(0);
    const tablolar = await izSql.query<{ ad: string }>(
      "select table_name as ad from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(tablolar.rows.map((satir) => satir.ad)).toEqual(
      expect.arrayContaining(['_prisma_migrations', 'degisiklik_kaydi']),
    );
  });

  it('göçleri uygulanmış iz veritabanı ile iz şeması arasında Prisma fark görmez', async ({
    annotate,
  }) => {
    const backendDir = fileURLToPath(new URL('..', import.meta.url));
    // --exit-code: fark yoksa 0, fark varsa 2 ile biter; 2 execFile'ı reddettirir.
    const { stdout } = await promisify(execFile)(
      `${backendDir}node_modules/.bin/prisma`,
      [
        'migrate',
        'diff',
        '--config',
        'prisma.iz.config.ts',
        '--from-config-datasource',
        '--to-schema',
        'prisma/iz/schema.prisma',
        '--exit-code',
      ],
      { cwd: backendDir, env: { ...process.env, IZ_DATABASE_URL: iz.url } },
    );
    await annotate(`prisma migrate diff çıktısı: ${stdout.trim()}`);
  });
});

describe('tek geçiş', () => {
  it('b) 3 not aktarılır: alanlar gövdeyle aynı, olusma_zamani notun zamanı; ikinci geçiş 0 döner', async () => {
    const govdeler = [govdeUret('dolu'), govdeUret('yok'), govdeUret('null')];
    const kimlikler = await notEkle(govdeler.map((govde) => ({ govde })));
    // Altı anlamlı haneli açık zaman: mikrosaniyenin korunduğu, sondaki sıfıra bağlı kalmadan görünür.
    const mikrosaniyeli = '2026-11-24 10:00:00.123456+00';
    await asilSql.query(
      'update outbox_iz set olusturma_zamani = $1::timestamptz where id = $2',
      [mikrosaniyeli, kimlikler[0]],
    );

    expect(await aktarici.gecis()).toBe(3);

    const izSatirlari = await izSql.query<{ id: string; alanlar: Govde }>(
      `select id, to_jsonb(d) - 'id' - 'olusma_zamani' - 'yazilma_zamani' as alanlar
         from degisiklik_kaydi d`,
    );
    const beklenen = kimlikler.map((id, sira) => ({
      id,
      alanlar: Object.fromEntries(
        govdeAnahtarlari.map((anahtar) => [
          anahtar,
          govdeler[sira]?.[anahtar] ?? null,
        ]),
      ),
    }));
    expect(izSatirlari.rows).toEqual(expect.arrayContaining(beklenen));
    expect(izSatirlari.rows).toHaveLength(3);

    // Zamanlar metin olarak karşılaştırılır; JavaScript tarihi mikrosaniyeyi kaybeder.
    // İki veritabanı aynı sunucudadır, metin biçimi aynıdır.
    const notZamanlari = await asilSql.query<{ id: string; zaman: string }>(
      'select id, olusturma_zamani::text as zaman from outbox_iz order by id',
    );
    const izZamanlari = await izSql.query<{ id: string; zaman: string }>(
      'select id, olusma_zamani::text as zaman from degisiklik_kaydi order by id',
    );
    expect(izZamanlari.rows).toEqual(notZamanlari.rows);
    const mikrosaniyeKorundu = await izSql.query<{ esit: boolean }>(
      'select olusma_zamani = $1::timestamptz as esit from degisiklik_kaydi where id = $2',
      [mikrosaniyeli, kimlikler[0]],
    );
    expect(mikrosaniyeKorundu.rows).toEqual([{ esit: true }]);

    expect(await aktarilmislar()).toEqual([...kimlikler].sort());
    expect(await aktarici.gecis()).toBe(0);
  });

  it('c) 300 not varken aynı anda iki geçiş, not kalmayana kadar yinelenir; ilk ikisinin kümeleri ayrıktır', async ({
    annotate,
  }) => {
    const kimlikler = await notEkle(Array.from({ length: 300 }, () => ({})));

    // Gerçek repository'yi saran kayıt: her geçişin kilitlediği kimlikleri yazar. İlk iki geçiş,
    // ikisi de kilitleyene kadar bekler; böylece kilitleri aynı anda tutarlar.
    const kaynak = new RepoKayitlari();
    outboxIzRepoKaydet(kaynak);
    const alinanlar: string[][] = [];
    let ikisiKilitledi: () => void = () => undefined;
    const engel = new Promise<void>((coz) => (ikisiKilitledi = coz));
    const kaydeden = new RepoKayitlari();
    kaydeden.register(OUTBOX_IZ_REPO, (istemci) => {
      const repo = kaynak.kur(OUTBOX_IZ_REPO, istemci);
      return {
        ...repo,
        aktarilacaklariKilitle: async (enCok, surum) => {
          const notlar = await repo.aktarilacaklariKilitle(enCok, surum);
          alinanlar.push(notlar.map((not) => not.id));
          if (alinanlar.length === 2) ikisiKilitledi();
          if (alinanlar.length <= 2) await engel;
          return notlar;
        },
      };
    });
    const yanYana = new IzAktarici(new UnitOfWork(prisma, kaydeden), izPrisma);

    const baslangic = performance.now();
    const donenler: number[] = [];
    for (let tur = 0; tur < 10; tur += 1) {
      const sonuc = await Promise.all([yanYana.gecis(), yanYana.gecis()]);
      donenler.push(...sonuc);
      if (sonuc[0] === 0 && sonuc[1] === 0) break;
    }
    const sure = performance.now() - baslangic;

    const [ilk = [], ikinci = []] = alinanlar;
    expect(ilk.length).toBeGreaterThan(0);
    expect(ikinci.length).toBeGreaterThan(0);
    expect(ilk.filter((id) => ikinci.includes(id))).toEqual([]);
    expect(donenler.reduce((a, b) => a + b, 0)).toBe(300);
    expect(await izKimlikleri()).toEqual([...kimlikler].sort());
    expect(await aktarilmislar()).toEqual([...kimlikler].sort());

    await annotate(
      `300 not: ${sure.toFixed(0)} ms; geçişlerin döndüğü sayılar: ${donenler.join(', ')}`,
    );
  });

  it('d) iz veritabanında önceden yazılmış kimlik tek kalır (önce yazılan), not işaretlenir, hata yok', async () => {
    const [onceden = '', oteki = ''] = await notEkle([{}, {}]);
    await izSql.query(
      `insert into degisiklik_kaydi (id, kullanici_id, is_adi, kaynak, kayit_id, eylem, degisen, olusma_zamani)
       values ($1, $2, 'onceden.yazildi', 'ornek', $3, 'olusturma', '{}', clock_timestamp())`,
      [onceden, randomUUID(), randomUUID()],
    );

    expect(await aktarici.gecis()).toBe(2);

    const satirlar = await izSql.query<{ id: string; is_adi: string }>(
      'select id, is_adi from degisiklik_kaydi where id = $1',
      [onceden],
    );
    expect(satirlar.rows).toEqual([{ id: onceden, is_adi: 'onceden.yazildi' }]);
    expect(await izKimlikleri()).toEqual([onceden, oteki].sort());
    expect(await aktarilmislar()).toEqual([onceden, oteki].sort());
  });

  it('e) surum 2 olan not alınmaz; aynı geçişte surum 1 olanlar aktarılır', async () => {
    const [yeniSurum = ''] = await notEkle([{ surum: 2 }]);
    const bilinenler = await notEkle([{ surum: 1 }, { surum: 1 }]);

    expect(await aktarici.gecis()).toBe(2);

    expect(await izKimlikleri()).toEqual([...bilinenler].sort());
    expect(await aktarilmislar()).toEqual([...bilinenler].sort());
    expect(await izKimlikleri()).not.toContain(yeniSurum);
  });

  it('f) sonraki_deneme_zamani gelecekte olan not alınmaz; geçmişte olan alınır', async () => {
    const [gelecek = '', gecmis = ''] = await notEkle([
      { sonrakiDeneme: "clock_timestamp() + interval '1 hour'" },
      { sonrakiDeneme: "clock_timestamp() - interval '1 hour'" },
    ]);

    expect(await aktarici.gecis()).toBe(1);

    expect(await izKimlikleri()).toEqual([gecmis]);
    expect(await aktarilmislar()).toEqual([gecmis]);
    expect(await izKimlikleri()).not.toContain(gelecek);
  });

  it('g) iz yazımı hata verince geçiş parti hatası atar, notlara dokunulmaz; engel kalkınca aktarılır', async () => {
    const kimlikler = await notEkle([{}, {}, {}]);
    // Engel: iz tablosunun adı değiştirilir, ekleme "tablo yok" (42P01) hatası alır.
    await izSql.query(
      'alter table degisiklik_kaydi rename to degisiklik_kaydi_gizli',
    );
    try {
      const hata: unknown = await aktarici.gecis().catch((e: unknown) => e);
      expect(hata).toBeInstanceOf(PartiHatasi);
      expect((hata as PartiHatasi).cause).toEqual(
        expect.objectContaining({
          message: expect.stringMatching(/degisiklik_kaydi/) as unknown,
        }),
      );
    } finally {
      await izSql.query(
        'alter table degisiklik_kaydi_gizli rename to degisiklik_kaydi',
      );
    }

    const notlar = await asilSql.query(
      'select aktarim_zamani, deneme_sayisi from outbox_iz',
    );
    expect(notlar.rows).toEqual(
      Array.from({ length: 3 }, () => ({
        aktarim_zamani: null,
        deneme_sayisi: 0,
      })),
    );
    expect(await izKimlikleri()).toEqual([]);

    expect(await aktarici.gecis()).toBe(3);
    expect(await izKimlikleri()).toEqual([...kimlikler].sort());
    expect(await aktarilmislar()).toEqual([...kimlikler].sort());
  });
});
