// Ortak kodun sertleştirmesi (GV-053); TS-002 AK-27, AK-28, AK-33, AK-36, AK-37 (3). Koşturma:
//   pnpm -C backend test:e2e test/ortak-sertlestirme.e2e-spec.ts --reporter=verbose
// Anahtar ve liste bölümleri uygulamayı AppModule ile, göçleri uygulanmış asıl ve iz geçici
// veritabanlarıyla açmayı dener. Yetki guard'ı bölümü veritabanı olmadan, yalnız HTTP temeli ve yetki
// guard'ıyla kurulan küçük bir uygulamayla sınanır. Lint bölümleri diske dosya koymaz: içerik var
// olan bir dosyanın adıyla lint'e stdin'den verilir.
import { execFile } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { OturumController } from '../src/features/kimlik/oturum/presentation/oturum.controller.js';
import {
  ACIK_ANAHTAR_DEGISKENI,
  OZEL_ANAHTAR_DEGISKENI,
} from '../src/shared/guvenlik/belirtec.js';
import {
  HerkeseAcik,
  Izin,
  isaretleriOku,
  YalnizKendisi,
} from '../src/shared/guvenlik/isaretler.js';
import { YALNIZ_KENDISI_UCLARI } from '../src/shared/guvenlik/yalniz-kendisi-listesi.js';
import { HttpTemeliModule } from '../src/shared/http/http-temeli.module.js';
import { YetkiBellegi } from '../src/shared/yetki/yetki-bellegi.js';
import { YetkiGuard } from '../src/shared/yetki/yetki.guard.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const BACKEND = fileURLToPath(new URL('..', import.meta.url));

let databases: AppDatabases;
let gozlemci: pg.Client;
let gozlemciPid: number;

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
}, 60_000);

afterAll(async () => {
  // Açılan uygulamalar kapandıktan sonra asıl veritabanında gözlemciden başka bağlantı kalmaz.
  const acikKalan = await kalanBaglantiSayisi(gozlemci, databases.asil.name, [
    gozlemciPid,
  ]);
  await gozlemci.end();
  await databases.drop();
  expect(acikKalan).toBe(0);
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

describe('a) belirteç anahtarlarının açılış denetimi', () => {
  function rsaCifti(bit: number): { ozel: string; acik: string } {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: bit,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { ozel: privateKey, acik: publicKey };
  }

  // Ortama verilen anahtarlarla AppModule'ü kurmayı dener; kurulursa kapatır, hatayı döner.
  async function acilisHatasi(ozel: string, acik: string): Promise<unknown> {
    const onceki = {
      ozel: process.env[OZEL_ANAHTAR_DEGISKENI],
      acik: process.env[ACIK_ANAHTAR_DEGISKENI],
    };
    process.env[OZEL_ANAHTAR_DEGISKENI] = ozel;
    process.env[ACIK_ANAHTAR_DEGISKENI] = acik;
    try {
      const modul = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      await modul.close();
      return undefined;
    } catch (hata) {
      return hata;
    } finally {
      process.env[OZEL_ANAHTAR_DEGISKENI] = onceki.ozel;
      process.env[ACIK_ANAHTAR_DEGISKENI] = onceki.acik;
    }
  }

  // Hata iletisinde ve yığınında PEM başlığı ya da anahtarların gövde satırlarından biri var mı.
  function anahtarSatirlari(hata: Error, pemler: readonly string[]): string[] {
    const metin = `${hata.message}\n${hata.stack ?? ''}`;
    const satirlar = pemler.flatMap((pem) =>
      pem.split('\n').filter((s) => s !== '' && !s.startsWith('-----')),
    );
    return [
      ...(metin.includes('-----BEGIN') ? ['-----BEGIN'] : []),
      ...satirlar.filter((s) => metin.includes(s)),
    ];
  }

  it('1024 bitlik anahtarla uygulama açılmaz; hata boyu söyler, anahtarı taşımaz', async () => {
    const { ozel, acik } = rsaCifti(1024);

    const hata = await acilisHatasi(ozel, acik);

    expect(hata).toBeInstanceOf(Error);
    const { message } = hata as Error;
    expect(message).toBe(
      `${OZEL_ANAHTAR_DEGISKENI} en az 2048 bit olmalı; 1024 bit`,
    );
    expect(anahtarSatirlari(hata as Error, [ozel, acik])).toEqual([]);
  }, 30_000);

  it('birbirinin çifti olmayan iki anahtarla uygulama açılmaz; hata çifti söyler, anahtarı taşımaz', async () => {
    const birinci = rsaCifti(2048);
    const ikinci = rsaCifti(2048);

    const hata = await acilisHatasi(birinci.ozel, ikinci.acik);

    expect(hata).toBeInstanceOf(Error);
    const { message } = hata as Error;
    expect(message).toBe(
      `${OZEL_ANAHTAR_DEGISKENI} ile ${ACIK_ANAHTAR_DEGISKENI} bir anahtar çifti değil`,
    );
    expect(
      anahtarSatirlari(hata as Error, [birinci.ozel, ikinci.acik]),
    ).toEqual([]);
  }, 30_000);
});

describe('b) yalnız kendisi listesi', () => {
  @Controller('liste-disi')
  class ListeDisiUclar {
    @Get()
    @YalnizKendisi()
    kendisi(): void {
      return undefined;
    }
  }

  it('listede olmayan uç yalnız kendisi işareti taşıyınca uygulama açılmaz; hata ucu söyler', async () => {
    const modul = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ListeDisiUclar],
    }).compile();
    const deneme = modul.createNestApplication();
    try {
      await expect(deneme.init()).rejects.toThrow(
        'ListeDisiUclar.kendisi ucu YalnizKendisi işareti taşıyor ama yalnız kendisi listesinde yok',
      );
    } finally {
      await deneme.close();
    }
  });

  it('listedeki uçlar (çıkış, yetkilerim) yalnız kendisi işaretlidir ve uygulama onlarla açılır', async () => {
    expect(YALNIZ_KENDISI_UCLARI).toEqual([
      'OturumController.cikis',
      'OturumController.yetkilerim',
      'ParolaController.degistir',
    ]);
    for (const ad of ['cikis', 'yetkilerim']) {
      expect(
        isaretleriOku(
          Reflect.get(OturumController.prototype as object, ad) as object,
        ),
      ).toEqual([{ tur: 'yalniz_kendisi' }]);
    }

    const modul = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = modul.createNestApplication();
    try {
      await expect(app.init()).resolves.toBe(app);
    } finally {
      await app.close();
    }
  });
});

describe("c) yetki guard'ı tek başına", () => {
  @Controller('yetki-tek')
  class YetkiTekUclari {
    @Get('izinli')
    @Izin('Kullanici', 'oku')
    izinli(): { durum: string } {
      return { durum: 'izinli' };
    }

    @Get('acik')
    @HerkeseAcik()
    acik(): { durum: string } {
      return { durum: 'acik' };
    }
  }

  it("kimlik guard'ı olmadan izin işaretli uç oturumsuz isteğe 403 yetki_yok döner; herkese açık uç geçer", async () => {
    const al = vi.fn();
    const modul = await Test.createTestingModule({
      imports: [HttpTemeliModule],
      controllers: [YetkiTekUclari],
      providers: [
        { provide: APP_GUARD, useClass: YetkiGuard },
        { provide: YetkiBellegi, useValue: { al } },
      ],
    }).compile();
    const app: INestApplication<App> = modul.createNestApplication();
    await app.init();
    try {
      const izinli = await request(app.getHttpServer()).get(
        '/yetki-tek/izinli',
      );
      expect(izinli.status).toBe(403);
      expect(izinli.body).toMatchObject({ kod: 'yetki_yok', ayrinti: null });

      const acik = await request(app.getHttpServer()).get('/yetki-tek/acik');
      expect(acik.status).toBe(200);
      expect(acik.body).toEqual({ durum: 'acik' });

      expect(al).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

function lintStdin(
  dosya: string,
  kod: string,
): Promise<{ cikis: number; cikti: string }> {
  return new Promise((coz) => {
    const surec = execFile(
      `${BACKEND}node_modules/.bin/eslint`,
      ['--stdin', '--stdin-filename', dosya],
      { cwd: BACKEND },
      (hata, cikti) => {
        coz({
          cikis: hata === null ? 0 : Number(hata.code),
          cikti,
        });
      },
    );
    surec.stdin?.end(kod);
  });
}

describe('d) lint: çekirdek sınırı (AK-27)', () => {
  // Alt özelliğin kökündeki dosyadan kimlik'in çekirdek repository belirtecini içe aktaran içerik.
  const CEKIRDEK = [
    "import { KULLANICI_CEKIRDEK_REPO } from '../_shared/cekirdek/kullanici.repository.js';",
    'export const belirtec = KULLANICI_CEKIRDEK_REPO;',
    '',
  ].join('\n');

  it('yönetim alt özelliklerinin yolundan çekirdek repository içe aktarılamaz', async () => {
    const sonuclar = await Promise.all(
      ['kullanici', 'grup', 'rol', 'uyelik', 'yetenek'].map((alt) =>
        lintStdin(`src/features/kimlik/${alt}/${alt}.module.ts`, CEKIRDEK),
      ),
    );
    for (const sonuc of sonuclar) {
      expect(sonuc.cikis).toBe(1);
      expect(sonuc.cikti).toContain(
        'Dependencies to file of category "cekirdek-repo" are not allowed in file of category "yonetim"',
      );
    }
  }, 180_000);

  it('_shared, oturum ve parola yollarından çekirdek repository içe aktarılabilir', async () => {
    const sonuclar = await Promise.all(
      [
        'src/features/kimlik/_shared/genel-sayac.ts',
        'src/features/kimlik/oturum/oturum.module.ts',
        'src/features/kimlik/parola/parola.module.ts',
      ].map((dosya) => lintStdin(dosya, CEKIRDEK)),
    );
    expect(sonuclar).toEqual([
      { cikis: 0, cikti: '' },
      { cikis: 0, cikti: '' },
      { cikis: 0, cikti: '' },
    ]);
  }, 180_000);
});

describe('d) lint: katman yönü (AK-36)', () => {
  it('uygulama katmanından sunum katmanı içe aktarılamaz; sunumdan uygulama aktarılabilir', async () => {
    const [uygulamadan, sunumdan] = await Promise.all([
      lintStdin(
        'src/features/kimlik/oturum/application/commands/cikis/cikis.handler.ts',
        [
          "import { OturumController } from '../../../presentation/oturum.controller.js';",
          'export const denetleyici = OturumController;',
          '',
        ].join('\n'),
      ),
      lintStdin(
        'src/features/kimlik/oturum/presentation/oturum.controller.ts',
        [
          "import { CikisHandler } from '../application/commands/cikis/cikis.handler.js';",
          'export const isleyici = CikisHandler;',
          '',
        ].join('\n'),
      ),
    ]);

    expect(uygulamadan.cikis).toBe(1);
    expect(uygulamadan.cikti).toContain(
      'Dependencies to file of category "sunum" are not allowed in file of category "uygulama"',
    );
    expect(sunumdan).toEqual({ cikis: 0, cikti: '' });
  }, 180_000);
});
