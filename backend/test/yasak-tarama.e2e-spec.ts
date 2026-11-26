// Göçten önce yasak taraması (GV-159; TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-36; KU-017).
// Koşturma:
//   pnpm -C backend test:e2e test/yasak-tarama.e2e-spec.ts --reporter=verbose
// Tarama komutu derlenmiş hâliyle, alt süreç olarak, göçleri uygulanmış ve tohumlanmış asıl ve iz geçici
// veritabanlarında koşar. Yasak satırları veritabanına doğrudan yazılır; yasak yazımını kapatan geçici
// kısıt test yardımcısıyla düşürülür. Testler sırayla koşar ve satırlar birikir: a) yasak yok, b) sağlam
// yasaklar, c–e) iki bozuk yasak ve aynı bozukluğu taşıyan bir izin. f) iki kolonu getiren göçten
// önceki göçlerle kurulmuş ayrı bir veritabanında, f') hiç göç uygulanmamış boş bir veritabanında
// koşar (TS-008 AU-38). g) çekirdek sınırının yeni parçayı kapsadığını
// lint'le gösterir.
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type Derleme, derle } from './derleme.js';
import {
  type AppDatabases,
  createAppDatabases,
  createTestDatabase,
  type TestDatabase,
} from './test-database.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
// Etki ve öncelik kolonlarını getiren göç (TS-008 birinci aşama); f) ondan önceki göçlerle kurulur.
const IKI_KOLON_GOCU = '20261126000000_yetenek_giremez_oncelik';

const ROL = '92000000-0000-4000-8000-000000000001';
const YETENEK = {
  saglamKolon: '94000000-0000-4000-8000-000000000001',
  saglamYerTutucu: '94000000-0000-4000-8000-000000000002',
  kolonuDusen: '94000000-0000-4000-8000-000000000003',
  sartiBozuk: '94000000-0000-4000-8000-000000000004',
  bozukIzin: '94000000-0000-4000-8000-000000000005',
} as const;

let derleme: Derleme;
let databases: AppDatabases;
let asilSql: pg.Client;
let izSql: pg.Client;
let gozlemciPidleri: number[];
let kokGrup: string;

interface KomutSonucu {
  readonly kod: number;
  readonly cikti: string;
}

// Derlenmiş bir komutu alt süreç olarak koşturur; ortam, geçici veritabanlarını gösteren ortamdır
// (createAppDatabases) ve verilenle ezilir.
function komut(
  dosya: string,
  ortam: Record<string, string> = {},
): Promise<KomutSonucu> {
  return new Promise((coz) => {
    execFile(
      process.execPath,
      [join(derleme.klasor, dosya)],
      { cwd: backendDir, env: { ...process.env, ...ortam } },
      (hata, stdout, stderr) => {
        coz({
          kod: hata === null ? 0 : Number(hata.code),
          cikti: `${stdout}${stderr}`,
        });
      },
    );
  });
}

// Taramanın çıktısı, uygulamanın açılış günlüğü ([Nest] satırları; öbür komutlardaki gibi standart
// çıktıya düşer) atılarak.
async function tara(ortam?: Record<string, string>): Promise<KomutSonucu> {
  const { kod, cikti } = await komut('yasak-tarama.js', ortam);
  return {
    kod,
    cikti: cikti
      .split('\n')
      .filter((satir) => !satir.includes('[Nest]'))
      .join('\n'),
  };
}

async function tekKimlik(sql: string): Promise<string> {
  const [satir] = (await asilSql.query<{ id: string }>(sql)).rows;
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
  }
  return satir.id;
}

interface YetenekSecenekleri {
  readonly kaynak: string;
  readonly eylem: string;
  readonly giremez: boolean;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
  // Verilmezse bütün kolonlar.
  readonly kolonlar?: readonly string[];
}

async function yetenekEkle(
  id: string,
  { kaynak, eylem, giremez, sart, kolonlar }: YetenekSecenekleri,
): Promise<void> {
  const izin = await tekKimlik(
    `select id from izin where kaynak = '${kaynak}' and eylem = '${eylem}'`,
  );
  await asilSql.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, giremez, oncelik, koken)
     values ($1, $2, $3, $4, $5::jsonb, $5::jsonb is null, $6, $6::text[] is null, $7, 10, 'yonetici')`,
    [
      id,
      kokGrup,
      ROL,
      izin,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      giremez,
    ],
  );
}

// Verilen bağlantının veritabanında, şemalardaki bütün tabloların satır sayıları.
async function satirSayilari(
  istemci: pg.Client,
): Promise<Record<string, number>> {
  const { rows: tablolar } = await istemci.query<{ ad: string }>(
    `select format('%I.%I', table_schema, table_name) as ad from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
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

// İki veritabanının satır sayıları, değişiklik notları (outbox_iz) ve yetenek satırları.
async function veritabaniHali(): Promise<unknown> {
  return {
    asil: await satirSayilari(asilSql),
    iz: await satirSayilari(izSql),
    notlar: (await asilSql.query('select * from outbox_iz order by id')).rows,
    yetenekler: (await asilSql.query('select * from yetenek order by id')).rows,
  };
}

function lintStdin(dosya: string, kod: string): Promise<KomutSonucu> {
  return new Promise((coz) => {
    const surec = execFile(
      `${backendDir}node_modules/.bin/eslint`,
      ['--stdin', '--stdin-filename', dosya],
      { cwd: backendDir },
      (hata, cikti) => {
        coz({ kod: hata === null ? 0 : Number(hata.code), cikti });
      },
    );
    surec.stdin?.end(kod);
  });
}

beforeAll(async () => {
  derleme = await derle();
  try {
    databases = await createAppDatabases({ migrations: true });
  } catch (error) {
    await derleme.sil();
    throw error;
  }
  try {
    asilSql = new pg.Client({ connectionString: databases.asil.url });
    izSql = new pg.Client({ connectionString: databases.iz.url });
    await asilSql.connect();
    await izSql.connect();
    gozlemciPidleri = await Promise.all(
      [asilSql, izSql].map(
        async (istemci) =>
          (
            await istemci.query<{ pid: number }>(
              'select pg_backend_pid() as pid',
            )
          ).rows[0]?.pid ?? -1,
      ),
    );
    const tohum = await komut('tohum.js');
    expect(tohum).toMatchObject({ kod: 0 });
    await yasakKisitiniDusur(databases.asil);
    kokGrup = await tekKimlik('select id from grup where ust_grup_id is null');
    await asilSql.query("insert into rol (id, ad) values ($1, 'Rol')", [ROL]);
  } catch (error) {
    await asilSql.end();
    await izSql.end();
    await databases.drop();
    await derleme.sil();
    throw error;
  }
}, 180_000);

afterAll(async () => {
  const [asilKalan, izKalan] = await Promise.all([
    kalanBaglantiSayisi(asilSql, databases.asil.name, gozlemciPidleri),
    kalanBaglantiSayisi(asilSql, databases.iz.name, gozlemciPidleri),
  ]);
  await asilSql.end();
  await izSql.end();
  await databases.drop();
  await derleme.sil();
  expect({ asil: asilKalan, iz: izKalan }).toEqual({ asil: 0, iz: 0 });
});

describe('yasak taraması', () => {
  it('a) yasak yokken taranacak yasak yok der ve 0 ile çıkar', async () => {
    expect(await tara()).toEqual({ kod: 0, cikti: 'Taranacak yasak yok\n' });
  }, 30_000);

  it('b) sağlam yasaklar (kolon listeli; kişiye bağlı yer tutuculu) varken 0 ile çıkar', async () => {
    await yetenekEkle(YETENEK.saglamKolon, {
      kaynak: 'Kullanici',
      eylem: 'oku',
      giremez: true,
      kolonlar: ['telefon'],
    });
    await yetenekEkle(YETENEK.saglamYerTutucu, {
      kaynak: 'Grup',
      eylem: 'oku',
      giremez: true,
      sart: [
        {
          alan: 'id',
          islec: 'listede',
          deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
        },
      ],
    });

    expect(await tara()).toEqual({
      kod: 0,
      cikti: 'Bozulacak yasak yok (2 yasak tarandı)\n',
    });
  }, 30_000);

  it('c, d, e) şemada olmayan kolonu listeleyen ve şartı şemada olmayan kolona bakan iki yasak adlarıyla listelenir, çıkış kodu 0 değildir; aynı bozukluktaki izin listelenmez; veritabanında hiçbir satır değişmez', async () => {
    await yetenekEkle(YETENEK.kolonuDusen, {
      kaynak: 'Kullanici',
      eylem: 'oku',
      giremez: true,
      kolonlar: ['telefon', 'eskiKolon'],
    });
    await yetenekEkle(YETENEK.sartiBozuk, {
      kaynak: 'Kullanici',
      eylem: 'oku',
      giremez: true,
      sart: [{ alan: 'eskiAlan', islec: 'esit', deger: 'x' }],
    });
    await yetenekEkle(YETENEK.bozukIzin, {
      kaynak: 'Kullanici',
      eylem: 'oku',
      giremez: false,
      kolonlar: ['telefon', 'eskiKolon'],
    });
    const once = await veritabaniHali();

    const sonuc = await tara();

    expect(sonuc).toEqual({
      kod: 2,
      cikti: [
        'Bozulacak yasak: 2 (4 yasak tarandı)',
        `  yetenek=${YETENEK.kolonuDusen} kaynak=Kullanici eylem=oku neden=şemada olmayan kolon: eskiKolon`,
        `  yetenek=${YETENEK.sartiBozuk} kaynak=Kullanici eylem=oku neden=bilinmeyen alan: eskiAlan`,
        '',
      ].join('\n'),
    });
    expect(sonuc.cikti).not.toContain(YETENEK.bozukIzin);
    expect(await veritabaniHali()).toEqual(once);
  }, 30_000);

  it('f) iki kolonu olmayan veritabanında (birinci aşamanın göçünden önce) taranacak yasak yok der ve 0 ile çıkar', async () => {
    const goclerKlasoru = join(backendDir, 'prisma', 'migrations');
    const oncekiGocler = readdirSync(goclerKlasoru, { withFileTypes: true })
      .filter((g) => g.isDirectory() && g.name < IKI_KOLON_GOCU)
      .map((g) => g.name)
      .sort();
    expect(oncekiGocler.length).toBeGreaterThan(0);
    const eski: TestDatabase = await createTestDatabase(
      oncekiGocler.map((g) =>
        readFileSync(join(goclerKlasoru, g, 'migration.sql'), 'utf8'),
      ),
    );
    try {
      const sql = new pg.Client({ connectionString: eski.url });
      await sql.connect();
      try {
        const { rows } = await sql.query(
          `select column_name from information_schema.columns
            where table_name = 'yetenek' and column_name in ('giremez', 'oncelik')`,
        );
        expect(rows).toEqual([]);
      } finally {
        await sql.end();
      }

      expect(await tara({ DATABASE_URL: eski.url })).toEqual({
        kod: 0,
        cikti:
          'Taranacak yasak yok: yetenek tablosu ya da tablonun giremez ve oncelik kolonları henüz yok\n',
      });
    } finally {
      await eski.drop();
    }
  }, 60_000);

  it("f') hiç göç uygulanmamış boş veritabanında (yetenek tablosu yok) taranacak yasak yok der ve 0 ile çıkar", async () => {
    const bos: TestDatabase = await createTestDatabase();
    try {
      expect(await tara({ DATABASE_URL: bos.url })).toEqual({
        kod: 0,
        cikti:
          'Taranacak yasak yok: yetenek tablosu ya da tablonun giremez ve oncelik kolonları henüz yok\n',
      });
    } finally {
      await bos.drop();
    }
  }, 60_000);

  it('g) çekirdek sınırı yeni parçayı kapsar: yönetim alt özelliğinden içe aktarılamaz, _shared modülünden aktarılabilir', async () => {
    const kod = [
      "import { YASAK_TARAMA_CEKIRDEK_REPO } from '../_shared/domain/repositories/i-yasak-tarama-cekirdek.repository.js';",
      "import { yasakTaramaCekirdekRepo } from '../_shared/infrastructure/repositories/yasak-tarama-cekirdek.prisma-repository.js';",
      'export const parca = [YASAK_TARAMA_CEKIRDEK_REPO, yasakTaramaCekirdekRepo];',
      '',
    ].join('\n');
    const [yonetim, ortak] = await Promise.all([
      lintStdin('src/features/kimlik/yetenek/yetenek.module.ts', kod),
      lintStdin(
        'src/features/kimlik/_shared/kimlik-cekirdek.module.ts',
        kod.replaceAll("'../_shared/", "'./"),
      ),
    ]);
    expect(yonetim.kod).toBe(1);
    expect(yonetim.cikti).toContain('"cekirdek-repo"');
    expect(yonetim.cikti).toContain(
      'are not allowed in file of category "yonetim"',
    );
    expect(ortak).toEqual({ kod: 0, cikti: '' });
  }, 180_000);
});
