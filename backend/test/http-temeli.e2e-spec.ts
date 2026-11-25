// HTTP temelinin sınaması (GV-023; TS-002 AK-11). Koşturma:
//   pnpm -C backend test:e2e test/http-temeli.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; temel,
// burada tanımlanan sınama uçlarıyla denenir. Tekil kısıt ve süre aşımı gerçek Prisma hatasıdır.
// Sınama uçları herkese açıktır: kimlik guard'ı onlardan bir şey istemez (TS-002 AK-12).
import { setTimeout as uyu } from 'node:timers/promises';
import {
  Body,
  Controller,
  Get,
  Inject,
  type INestApplication,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { DatabaseModule } from '../src/shared/database/database.module.js';
import {
  Prisma,
  type PrismaClient,
} from '../src/shared/database/generated/client.js';
import { PRISMA_CLIENT } from '../src/shared/database/istemci-belirtecleri.js';
import { yeniKimlik } from '../src/shared/database/kimlik.js';
import { HerkeseAcik } from '../src/shared/guvenlik/isaretler.js';
import {
  ISTEK_KIMLIGI_BASLIGI,
  istekBaglami,
} from '../src/shared/http/istek-baglami.js';
import {
  HATA_DURUMLARI,
  type HataKodu,
  KodluHata,
} from '../src/shared/http/kodlu-hata.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const govdeSemasi = z.object({ ad: z.string().min(1) });
const sorguSemasi = z.object({ sayi: z.coerce.number().int() });
const hataKoduSemasi = z.enum(
  Object.keys(HATA_DURUMLARI) as [HataKodu, ...HataKodu[]],
);

// TS-002 AK-11 tablosu, testte sabit yazılmıştır (AK-26): beklenen durumlar uygulamanın tablosundan
// okunmaz; uygulamada bir kodun durumu değişirse test kırmızıya döner.
const AK_11_TABLOSU = [
  ['dogrulama_hatasi', 400],
  ['kimlik_gerekli', 401],
  ['yetki_yok', 403],
  ['bulunamadi', 404],
  ['cakisma', 409],
  ['beklenmeyen_hata', 500],
  ['yeniden_dene', 503],
] as const;

// Süzgecin günlüğü Nest Logger'ının örnek yöntemiyle yazılır; hata düzeyi Logger.prototype.error'dır.
function hataGunluguGozle() {
  return vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
}

// Uyarı düzeyi Logger.prototype.warn'dır; "kayıt yok" dalı bu düzeyde yazar (AK-48 eki).
function uyariGunluguGozle() {
  return vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
}

@Controller('sinama')
class SinamaController {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  @Post('dogrulama/:id')
  @HerkeseAcik()
  dogrulama(
    @Param('id', { schema: z.uuid() }) id: string,
    @Query({ schema: sorguSemasi }) sorgu: z.infer<typeof sorguSemasi>,
    @Body({ schema: govdeSemasi }) govde: z.infer<typeof govdeSemasi>,
  ): object {
    return {
      id,
      sayi: sorgu.sayi,
      sayiTipi: typeof sorgu.sayi,
      ad: govde.ad,
    };
  }

  @Get('kodlu/:kod')
  @HerkeseAcik()
  kodlu(@Param('kod', { schema: hataKoduSemasi }) kod: HataKodu): never {
    throw new KodluHata(kod, `sınama iletisi: ${kod}`, { ornek: kod });
  }

  @Get('ayrintisiz')
  @HerkeseAcik()
  ayrintisiz(): never {
    throw new KodluHata('bulunamadi', 'Kayıt yok');
  }

  @Get('beklenmeyen')
  @HerkeseAcik()
  beklenmeyen(): never {
    throw new Error(
      'gizli ileti: select * from kullanici; /Users/biri/proje/src/gizli.ts',
    );
  }

  @Post('tekil')
  @HerkeseAcik()
  async tekil(): Promise<void> {
    const id = yeniKimlik();
    for (let i = 0; i < 2; i++) {
      await this.prisma.outboxIz.create({
        data: { id, surum: 1, govde: {} },
      });
    }
  }

  @Post('yabanci-anahtar')
  @HerkeseAcik()
  async yabanciAnahtar(): Promise<void> {
    // Var olmayan kişiye bağ veren gerçek ekleme; veritabanı yabancı anahtar kısıtına takılır.
    await this.prisma.kullaniciSirri.create({
      data: { kullaniciId: yeniKimlik(), parolaOzeti: 'ozet' },
    });
  }

  @Post('kayit-yok')
  @HerkeseAcik()
  async kayitYok(): Promise<void> {
    // Var olmayan satırı güncelleyen gerçek yazma; istemci "kayıt bulunamadı" hatası verir.
    await this.prisma.outboxIz.update({
      where: { id: yeniKimlik() },
      data: { surum: 2 },
    });
  }

  @Get('sure-asimi')
  @HerkeseAcik()
  async sureAsimi(): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await uyu(300);
        await tx.outboxIz.count();
      },
      { timeout: 50 },
    );
  }

  @Get('kilitlenme')
  @HerkeseAcik()
  kilitlenme(): never {
    // Kilitlenme döngüsü kararlı üretilemediği için adaptörün verdiği kodla kurulur (40P01 → P2034).
    throw new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict or a deadlock',
      { code: 'P2034', clientVersion: Prisma.prismaVersion.client },
    );
  }

  @Get('kimlik')
  @HerkeseAcik()
  async kimlik(): Promise<{ istekKimligi: string }> {
    // Bekleme, eşzamanlı isteklerin kendi bağlamlarını iç içe geçmiş sırayla okumasını sağlar.
    await uyu(Math.floor(Math.random() * 30));
    return { istekKimligi: istekBaglami().istekKimligi };
  }
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

describe('HTTP temeli', () => {
  let databases: AppDatabases;
  let app: INestApplication<App> | undefined;

  // Açılmış uygulamanın HTTP sunucusu; testler yalnız beforeAll başarılıysa koşar.
  function sunucu(): App {
    if (app === undefined) {
      throw new Error('uygulama açılmadı');
    }
    return app.getHttpServer();
  }

  beforeAll(async () => {
    databases = await createAppDatabases({ migrations: true });
    try {
      const modul = await Test.createTestingModule({
        // Sınama ucu ham istemciyi alır; belirteci DatabaseModule dışa verir.
        imports: [AppModule, DatabaseModule],
        controllers: [SinamaController],
      }).compile();
      app = modul.createNestApplication();
      await app.init();
    } catch (error) {
      await databases.drop();
      throw error;
    }
  });

  afterAll(async () => {
    // Kurulum yarıda kaldıysa uygulama açılmamıştır.
    await app?.close();
    await databases.drop();
    expect(
      await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
    ).toEqual([]);
  });

  describe('a) doğrulama', () => {
    const gecerliId = yeniKimlik();

    it('geçerli gövde, sorgu ve yol parametresi şemanın ürettiği tiple uca ulaşır', async () => {
      const cevap = await request(sunucu())
        .post(`/sinama/dogrulama/${gecerliId}?sayi=42`)
        .send({ ad: 'Ada', fazla: 'atılır' });

      expect(cevap.status).toBe(201);
      expect(cevap.body).toEqual({
        id: gecerliId,
        sayi: 42,
        sayiTipi: 'number',
        ad: 'Ada',
      });
    });

    it.each([
      ['gövde', `/sinama/dogrulama/${gecerliId}?sayi=1`, { ad: '' }, 'ad'],
      [
        'sorgu',
        `/sinama/dogrulama/${gecerliId}?sayi=bir`,
        { ad: 'Ada' },
        'sayi',
      ],
      [
        'yol parametresi',
        '/sinama/dogrulama/kimlik-degil?sayi=1',
        { ad: 'Ada' },
        'id',
      ],
    ])(
      'geçersiz %s 400 dogrulama_hatasi döner; ayrıntıda alanın yolu ve nedeni vardır',
      async (_ad, yol, govde, alan) => {
        const cevap = await request(sunucu()).post(yol).send(govde);

        expect(cevap.status).toBe(400);
        expect(cevap.body).toEqual({
          kod: 'dogrulama_hatasi',
          ileti: 'İstek doğrulanamadı',
          ayrinti: [{ alan, neden: expect.any(String) as string }],
        });
      },
    );
  });

  describe('b) kodlu hata', () => {
    it.each(AK_11_TABLOSU)(
      '%s kodu %i durumunu ve { kod, ileti, ayrinti } gövdesini üretir',
      async (kod, durum) => {
        const cevap = await request(sunucu()).get(`/sinama/kodlu/${kod}`);

        expect(cevap.status).toBe(durum);
        expect(cevap.body).toEqual({
          kod,
          ileti: `sınama iletisi: ${kod}`,
          ayrinti: { ornek: kod },
        });
      },
    );

    it('ayrıntısız kodlu hatada ayrinti null olur', async () => {
      const cevap = await request(sunucu()).get('/sinama/ayrintisiz');

      expect(cevap.status).toBe(404);
      expect(cevap.body).toEqual({
        kod: 'bulunamadi',
        ileti: 'Kayıt yok',
        ayrinti: null,
      });
    });

    it('eşleşmeyen yol 404 bulunamadi döner', async () => {
      const cevap = await request(sunucu()).get('/yok');

      expect(cevap.status).toBe(404);
      expect(cevap.body).toMatchObject({ kod: 'bulunamadi', ayrinti: null });
    });
  });

  it('c) kodlu olmayan hata 500 beklenmeyen_hata döner; gövde iç ayrıntı taşımaz, hata günlüğe yazılır', async () => {
    const gunluk = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      const cevap = await request(sunucu()).get('/sinama/beklenmeyen');

      expect(cevap.status).toBe(500);
      expect(cevap.body).toEqual({
        kod: 'beklenmeyen_hata',
        ileti: 'Beklenmeyen bir hata oluştu',
        ayrinti: null,
      });
      expect(cevap.text).not.toContain('gizli');
      expect(cevap.text).not.toContain('select');
      expect(cevap.text).not.toContain('.ts');
      expect(cevap.text).not.toContain('/');
      expect(cevap.text).not.toMatch(/\bat /);
      expect(gunluk).toHaveBeenCalledWith(
        expect.stringContaining('gizli ileti'),
      );
    } finally {
      gunluk.mockRestore();
    }
  });

  describe('d) veritabanı hataları', () => {
    it('tekil kısıt hatası 409 cakisma olur', async () => {
      const cevap = await request(sunucu()).post('/sinama/tekil');

      expect(cevap.status).toBe(409);
      expect(cevap.body).toEqual({
        kod: 'cakisma',
        ileti: 'Kayıt başka bir kayıtla çakışıyor',
        ayrinti: null,
      });
    });

    it('yabancı anahtar ihlali 409 cakisma olur; gövde kısıt ya da tablo adı taşımaz, hata günlüğüne yazılmaz (AK-45)', async () => {
      const gunluk = hataGunluguGozle();
      try {
        const cevap = await request(sunucu()).post('/sinama/yabanci-anahtar');

        expect(cevap.status).toBe(409);
        expect(cevap.body).toEqual({
          kod: 'cakisma',
          ileti: 'İlişkili kayıt nedeniyle işlem yapılamadı',
          ayrinti: null,
        });
        expect(cevap.text).not.toMatch(
          /kullanici|sirri|_ya\b|foreign|constraint/i,
        );
        expect(gunluk).not.toHaveBeenCalled();
      } finally {
        gunluk.mockRestore();
      }
    });

    it('kayıt yok hatası 404 bulunamadi olur; gövde tablo ya da model adı taşımaz, hata günlüğüne yazılmaz (AK-48)', async () => {
      const gunluk = hataGunluguGozle();
      try {
        const cevap = await request(sunucu()).post('/sinama/kayit-yok');

        expect(cevap.status).toBe(404);
        expect(cevap.body).toEqual({
          kod: 'bulunamadi',
          ileti: 'Kayıt bulunamadı',
          ayrinti: null,
        });
        expect(cevap.text).not.toMatch(/outbox|_iz\b|OutboxIz|record|P2025/i);
        expect(gunluk).not.toHaveBeenCalled();
      } finally {
        gunluk.mockRestore();
      }
    });

    it('kayıt yok hatası uyarı düzeyinde tek satır yazar: istek kimliği, hatanın türü ve model adı; değer taşımaz (AK-48 eki)', async () => {
      const hataGunlugu = hataGunluguGozle();
      const uyariGunlugu = uyariGunluguGozle();
      try {
        const cevap = await request(sunucu()).post('/sinama/kayit-yok');

        expect(cevap.status).toBe(404);
        const istekKimligi = String(cevap.headers[ISTEK_KIMLIGI_BASLIGI]);
        expect(istekKimligi).toMatch(UUID_V7);
        expect(uyariGunlugu).toHaveBeenCalledTimes(1);
        expect(uyariGunlugu).toHaveBeenCalledWith(
          `istek ${istekKimligi}: kayıt yok (P2025), model OutboxIz`,
        );
        expect(hataGunlugu).not.toHaveBeenCalled();
      } finally {
        hataGunlugu.mockRestore();
        uyariGunlugu.mockRestore();
      }
    });

    it.each([
      ['tekil kısıt', '/sinama/tekil'],
      ['yabancı anahtar ihlali', '/sinama/yabanci-anahtar'],
    ])(
      '%s (%s) 409 döner ve ne uyarı ne hata düzeyinde günlüğe yazılır',
      async (_dal, yol) => {
        const hataGunlugu = hataGunluguGozle();
        const uyariGunlugu = uyariGunluguGozle();
        try {
          const cevap = await request(sunucu()).post(yol);

          expect(cevap.status).toBe(409);
          expect(uyariGunlugu).not.toHaveBeenCalled();
          expect(hataGunlugu).not.toHaveBeenCalled();
        } finally {
          hataGunlugu.mockRestore();
          uyariGunlugu.mockRestore();
        }
      },
    );

    it('işlem süre aşımı 503 yeniden_dene olur', async () => {
      const cevap = await request(sunucu()).get('/sinama/sure-asimi');

      expect(cevap.status).toBe(503);
      expect(cevap.body).toEqual({
        kod: 'yeniden_dene',
        ileti: 'İşlem tamamlanamadı; yeniden deneyin',
        ayrinti: null,
      });
    });

    it('kilitlenme döngüsü (P2034) 503 yeniden_dene olur', async () => {
      const cevap = await request(sunucu()).get('/sinama/kilitlenme');

      expect(cevap.status).toBe(503);
      expect(cevap.body).toMatchObject({ kod: 'yeniden_dene' });
    });
  });

  describe('e) istek kimliği ve bağlam', () => {
    it('başarılı ve hatalı cevap x-istek-kimligi başlığını taşır; değer UUID v7 dir ve iki istekte farklıdır', async () => {
      const birinci = await request(sunucu()).get('/health');
      const ikinci = await request(sunucu()).get('/yok');

      const a = birinci.headers[ISTEK_KIMLIGI_BASLIGI];
      const b = ikinci.headers[ISTEK_KIMLIGI_BASLIGI];
      expect(a).toMatch(UUID_V7);
      expect(b).toMatch(UUID_V7);
      expect(a).not.toBe(b);
    });

    it('ucun içinden okunan istek kimliği başlıktakiyle aynıdır', async () => {
      const cevap = await request(sunucu()).get('/sinama/kimlik');

      expect(cevap.status).toBe(200);
      expect(cevap.body).toEqual({
        istekKimligi: cevap.headers[ISTEK_KIMLIGI_BASLIGI],
      });
    });

    it('eşzamanlı yirmi istekte her uç kendi kimliğini okur; kimlikler karışmaz', async () => {
      const cevaplar = await Promise.all(
        Array.from({ length: 20 }, () =>
          request(sunucu()).get('/sinama/kimlik'),
        ),
      );

      const kimlikler = cevaplar.map((cevap) => {
        const baslik = cevap.headers[ISTEK_KIMLIGI_BASLIGI];
        expect(baslik).toMatch(UUID_V7);
        expect(cevap.body).toEqual({ istekKimligi: baslik });
        return baslik;
      });
      expect(new Set(kimlikler).size).toBe(20);
    });

    it('bozuk JSON gövdesi 400 dogrulama_hatasi döner ve cevap kimlik başlığını taşır', async () => {
      // Gövde ayrıştırıcısı istek bağlamı ara katmanından önce koşar; kimliği süzgeç verir.
      const cevap = await request(sunucu())
        .post(`/sinama/dogrulama/${yeniKimlik()}?sayi=1`)
        .set('content-type', 'application/json')
        .send('{"ad":');

      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
      expect(cevap.headers[ISTEK_KIMLIGI_BASLIGI]).toMatch(UUID_V7);
    });

    it('istek dışında bağlam okunursa hata verir', () => {
      expect(() => istekBaglami()).toThrow('İstek bağlamı yok');
    });
  });

  describe('f) sertleştirme (AK-26)', () => {
    let hataGunlugu: ReturnType<typeof hataGunluguGozle>;

    beforeEach(() => {
      hataGunlugu = hataGunluguGozle();
    });

    afterEach(() => {
      hataGunlugu.mockRestore();
    });

    it("100 kB'tan büyük JSON gövdesi (413) 400 dogrulama_hatasi döner; ileti iç ayrıntı taşımaz, hata günlüğüne yazılmaz", async () => {
      const cevap = await request(sunucu())
        .post(`/sinama/dogrulama/${yeniKimlik()}?sayi=1`)
        .send({ ad: 'a'.repeat(101 * 1024) });

      expect(cevap.status).toBe(400);
      expect(cevap.body).toEqual({
        kod: 'dogrulama_hatasi',
        ileti: 'İstek doğrulanamadı',
        ayrinti: null,
      });
      expect(cevap.text).not.toMatch(/large|entity|limit/i);
      expect(hataGunlugu).not.toHaveBeenCalled();
    });

    it('desteklenmeyen içerik türüyle gönderilen gövde 400 dogrulama_hatasi döner; 500 dönmez', async () => {
      // Ölçülen: hiçbir ayrıştırıcı eşleşmez, gövde tanımsız kalır ve hatayı doğrulama borusu
      // verir (ayrıntıda alan ''); 415 üretilmez.
      const cevap = await request(sunucu())
        .post(`/sinama/dogrulama/${yeniKimlik()}?sayi=1`)
        .set('content-type', 'application/xml')
        .send('<ad>Ada</ad>');

      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
      expect(hataGunlugu).not.toHaveBeenCalled();
    });

    it.each([
      ['yeniden_dene', '/sinama/kilitlenme', 503],
      ['kodla atılan beklenmeyen_hata', '/sinama/kodlu/beklenmeyen_hata', 500],
      ['kodsuz hata', '/sinama/beklenmeyen', 500],
    ])(
      '%s (%s) %i döner ve günlüğe istek kimliğini taşıyan bir kayıt düşer',
      async (_dal, yol, durum) => {
        const cevap = await request(sunucu()).get(yol);

        expect(cevap.status).toBe(durum);
        const istekKimligi = cevap.headers[ISTEK_KIMLIGI_BASLIGI];
        expect(istekKimligi).toMatch(UUID_V7);
        expect(hataGunlugu).toHaveBeenCalledTimes(1);
        expect(hataGunlugu).toHaveBeenCalledWith(
          expect.stringContaining(String(istekKimligi)),
        );
      },
    );

    it.each([
      ['kodlu dogrulama_hatasi', 'get', '/sinama/kodlu/dogrulama_hatasi', 400],
      ['kodlu kimlik_gerekli', 'get', '/sinama/kodlu/kimlik_gerekli', 401],
      ['kodlu yetki_yok', 'get', '/sinama/kodlu/yetki_yok', 403],
      ['kodlu bulunamadi', 'get', '/sinama/kodlu/bulunamadi', 404],
      ['kodlu cakisma', 'get', '/sinama/kodlu/cakisma', 409],
      ['eşleşmeyen yol', 'get', '/yok', 404],
      ['tekil kısıt', 'post', '/sinama/tekil', 409],
    ] as const)(
      '%s (%s %s) %i döner ve hata düzeyinde günlüğe yazılmaz',
      async (_dal, yontem, yol, durum) => {
        const cevap = await request(sunucu())[yontem](yol);

        expect(cevap.status).toBe(durum);
        expect(hataGunlugu).not.toHaveBeenCalled();
      },
    );

    it('bozuk JSON gövdesi 400 döner ve hata düzeyinde günlüğe yazılmaz', async () => {
      const cevap = await request(sunucu())
        .post(`/sinama/dogrulama/${yeniKimlik()}?sayi=1`)
        .set('content-type', 'application/json')
        .send('{"ad":');

      expect(cevap.status).toBe(400);
      expect(hataGunlugu).not.toHaveBeenCalled();
    });
  });
});
