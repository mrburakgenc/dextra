// Unit of Work'ün yazma işareti (GV-061; TS-002 AK-40). Koşturma:
//   pnpm -C backend test:e2e test/yazma-isareti.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ve herkese açık sınama uçlarıyla, göçleri uygulanmış asıl ve iz geçici
// veritabanlarıyla açılır. Her uç işi bittikten sonra kendi isteğinin işaretini döndürür.
import { Controller, Get, Inject, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseModule } from '../src/shared/database/database.module.js';
import { RepoBelirteci } from '../src/shared/database/domain/repo-belirteci.js';
import { Registrar } from '../src/shared/database/infrastructure/registrar.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
import { HerkeseAcik } from '../src/shared/guvenlik/application/isaretler.js';
import {
  istekBaglami,
  varsaIstekBaglami,
} from '../src/shared/observability/istek-baglami/istek-baglami.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

interface IsaretRepo {
  bir(): Promise<number>;
}

const ISARET_REPO = new RepoBelirteci<IsaretRepo, IsaretRepo>('IsaretRepo');

interface IsaretCevabi {
  yazmaAcildi: boolean;
}

function isaret(): IsaretCevabi {
  return { yazmaAcildi: istekBaglami().yazmaAcildi };
}

@Controller('isaret')
class IsaretUclari {
  constructor(@Inject(UnitOfWork) private readonly uow: UnitOfWork) {}

  @Get('run')
  @HerkeseAcik()
  async run(): Promise<IsaretCevabi> {
    await this.uow.run((islem) => islem.repo(ISARET_REPO).bir());
    return isaret();
  }

  @Get('read')
  @HerkeseAcik()
  async read(): Promise<IsaretCevabi> {
    await this.uow.read(ISARET_REPO).bir();
    return isaret();
  }

  @Get('hicbiri')
  @HerkeseAcik()
  hicbiri(): IsaretCevabi {
    return isaret();
  }

  // run'ın işi hata atar, işlem geri alınır; uç hatayı yakalayıp işareti döndürür.
  @Get('geri-alinan')
  @HerkeseAcik()
  async geriAlinan(): Promise<IsaretCevabi & { hata: string }> {
    const hata = await this.uow
      .run(() => Promise.reject(new Error('geri al')))
      .then(
        () => 'yok',
        (error: unknown) => String(error),
      );
    return { ...isaret(), hata };
  }
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPidi: number;

function uygulama(): INestApplication<App> {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app;
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

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  gozlemci = new pg.Client({ connectionString: databases.asil.url });
  try {
    await gozlemci.connect();
    gozlemciPidi =
      (await gozlemci.query<{ pid: number }>('select pg_backend_pid() as pid'))
        .rows[0]?.pid ?? -1;
    const modul = await Test.createTestingModule({
      imports: [AppModule, DatabaseModule],
      controllers: [IsaretUclari],
    }).compile();
    modul.get(Registrar).register(ISARET_REPO, (istemci) => ({
      bir: async () =>
        (await istemci.$queryRaw<{ bir: number }[]>`select 1::int as bir`)[0]
          ?.bir ?? -1,
    }));
    app = modul.createNestApplication();
    await app.init();
  } catch (error) {
    await app?.close();
    await gozlemci.end();
    await databases.drop();
    throw error;
  }
}, 60_000);

afterAll(async () => {
  await app?.close();
  const acikKalan = [
    await kalanBaglantiSayisi(gozlemci, databases.asil.name, [gozlemciPidi]),
    await kalanBaglantiSayisi(gozlemci, databases.iz.name, [gozlemciPidi]),
  ];
  await gozlemci.end();
  await databases.drop();
  expect(acikKalan).toEqual([0, 0]);
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

describe('istekte yazma işareti', () => {
  it('run açan uçta işaret doğrudur', async () => {
    const cevap = await request(uygulama().getHttpServer()).get('/isaret/run');

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({ yazmaAcildi: true });
  });

  it('yalnız read kullanan uçta işaret yanlıştır', async () => {
    const cevap = await request(uygulama().getHttpServer()).get('/isaret/read');

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({ yazmaAcildi: false });
  });

  it('ne run ne read kullanan uçta işaret yanlıştır', async () => {
    const cevap = await request(uygulama().getHttpServer()).get(
      '/isaret/hicbiri',
    );

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({ yazmaAcildi: false });
  });

  it('run hata ile geri alınsa da işaret doğrudur: işlem açılmıştır', async () => {
    const cevap = await request(uygulama().getHttpServer()).get(
      '/isaret/geri-alinan',
    );

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({
      yazmaAcildi: true,
      hata: 'Error: geri al',
    });
  });

  it('işaret isteğe aittir: run açan istekten sonra gelen salt okuma isteğinde yanlıştır', async () => {
    const sunucu = uygulama().getHttpServer();
    const once = await request(sunucu).get('/isaret/run');
    const sonra = await request(sunucu).get('/isaret/read');

    expect(once.body).toEqual({ yazmaAcildi: true });
    expect(sonra.body).toEqual({ yazmaAcildi: false });
  });
});

describe('istek dışında', () => {
  it('bağlam okuyucusu hata vermez, tanımsız döner', () => {
    expect(varsaIstekBaglami()).toBeUndefined();
  });

  it('run açmak hata vermez ve işin sonucunu döndürür', async () => {
    const uow = uygulama().get(UnitOfWork);

    await expect(
      uow.run((islem) => islem.repo(ISARET_REPO).bir()),
    ).resolves.toBe(1);
    expect(varsaIstekBaglami()).toBeUndefined();
  });
});
