// Düzenli kapanışın gerçek süreçle sınaması (TS-003 Onarım). Koşturma:
//   pnpm -C backend test:e2e test/kapanis.e2e-spec.ts --reporter=verbose
// Uygulama sınamanın başında derlenir (bayat dist sınanmasın diye) ve derlenmiş hâli, göçleri
// uygulanmış asıl ve iz geçici veritabanlarını gösteren ortam değişkenleriyle alt süreç olarak
// başlatılır. Sağlık ucu cevap verince SIGTERM gönderilir. Kapanış kancaları açık değilse Node
// süreci sinyalle öldürür ve çıkış kodu 0 olmaz.
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { setTimeout as uyu } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const KAPANIS_SINIRI_MS = 10_000;

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
    await uyu(50);
  }
}

// Bu makinede o an boş olan bir kapı numarası.
async function bosPort(): Promise<number> {
  const sunucu = createServer();
  sunucu.listen(0, '127.0.0.1');
  await once(sunucu, 'listening');
  const { port } = sunucu.address() as AddressInfo;
  sunucu.close();
  await once(sunucu, 'close');
  return port;
}

// Verilen veritabanına gözlemcinin dışında açık istemci bağlantısı sayısı.
async function baglantiSayisi(
  gozlemci: pg.Client,
  veritabani: string,
  gozlemciPid: number,
): Promise<number> {
  const { rows } = await gozlemci.query<{ sayi: number }>(
    `select count(*)::int as sayi from pg_stat_activity
      where datname = $1 and backend_type = 'client backend' and pid <> $2`,
    [veritabani, gozlemciPid],
  );
  return rows[0]?.sayi ?? -1;
}

async function saglikCevapVerir(adres: string): Promise<boolean> {
  try {
    return (await fetch(`${adres}/health`)).status === 200;
  } catch {
    return false;
  }
}

// Silinen veritabanlarından sunucuda kalanlar.
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

describe('derlenmiş uygulamanın düzenli kapanışı', () => {
  let databases: AppDatabases;
  let gozlemci: pg.Client;
  let gozlemciPid: number;
  let surec: ChildProcess | undefined;
  let cikti = '';

  beforeAll(async () => {
    await promisify(execFile)(
      `${backendDir}node_modules/.bin/nest`,
      ['build'],
      {
        cwd: backendDir,
      },
    );
    databases = await createAppDatabases({ migrations: true });
    // Kurulum yarıda kalırsa geçici veritabanları sunucuda kalmaz.
    try {
      gozlemci = new pg.Client({ connectionString: databases.asil.url });
      await gozlemci.connect();
      const { rows } = await gozlemci.query<{ pid: number }>(
        'select pg_backend_pid() as pid',
      );
      gozlemciPid = rows[0]?.pid ?? -1;
    } catch (error) {
      await databases.drop();
      throw error;
    }
  }, 120_000);

  afterAll(async () => {
    // Sınama yarıda kaldıysa alt süreç geride kalmaz.
    if (surec?.exitCode === null && surec.signalCode === null) {
      surec.kill('SIGKILL');
      await once(surec, 'exit');
    }
    await gozlemci.end();
    await databases.drop();
    expect(
      await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
    ).toEqual([]);
  });

  it(`SIGTERM'den sonra ${String(KAPANIS_SINIRI_MS)} ms içinde 0 ile çıkar; geçici veritabanlarında uygulamanın bağlantısı kalmaz`, async () => {
    const port = await bosPort();
    const adres = `http://127.0.0.1:${String(port)}`;
    const calisan = spawn(process.execPath, ['dist/main.js'], {
      cwd: backendDir,
      env: {
        ...process.env,
        DATABASE_URL: databases.asil.url,
        IZ_DATABASE_URL: databases.iz.url,
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    surec = calisan;
    calisan.stdout.on('data', (parca: Buffer) => (cikti += parca.toString()));
    calisan.stderr.on('data', (parca: Buffer) => (cikti += parca.toString()));

    await bekle('sağlık ucu cevap verir', 15_000, () => {
      if (calisan.exitCode !== null || calisan.signalCode !== null) {
        throw new Error(`uygulama açılmadan çıktı:\n${cikti}`);
      }
      return saglikCevapVerir(adres);
    });
    // Ölçüm boş değildir: açıkken aktarıcı döngüleri asıl veritabanına bağlantı açmıştır.
    await bekle(
      'uygulama asıl veritabanına bağlanır',
      5_000,
      async () =>
        (await baglantiSayisi(gozlemci, databases.asil.name, gozlemciPid)) > 0,
    );

    const cikis = once(calisan, 'exit', {
      signal: AbortSignal.timeout(KAPANIS_SINIRI_MS),
    });
    const baslangic = performance.now();
    calisan.kill('SIGTERM');
    const [kod, sinyal] = (await cikis) as [number | null, string | null];
    const sure = performance.now() - baslangic;
    process.stdout.write(
      `[ölçü] SIGTERM'den çıkışa: ${sure.toFixed(0)} ms (kod ${String(kod)}, sinyal ${String(sinyal)})\n`,
    );

    expect({ kod, sinyal }, cikti).toEqual({ kod: 0, sinyal: null });
    expect(sure).toBeLessThan(KAPANIS_SINIRI_MS);
    for (const { name } of [databases.asil, databases.iz]) {
      await bekle(
        `${name} veritabanında uygulama bağlantısı kalmaz`,
        5_000,
        async () => (await baglantiSayisi(gozlemci, name, gozlemciPid)) === 0,
      );
    }
  }, 40_000);
});
