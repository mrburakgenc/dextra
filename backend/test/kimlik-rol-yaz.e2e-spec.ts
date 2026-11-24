// Rol oluşturma, adını değiştirme ve silme uçları (GV-065; TS-002 AK-39, "İşlem sınırları": rol yaz,
// sil; KR-008 Seçim 15 ve 22). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-rol-yaz.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) açılır: tohum, giriş yapmış ilk yönetici
// ve SQL ile açılan kişiler. Satırlar, genel sayaç ve değişiklik kaydı notları (outbox_iz) asıl
// geçici veritabanından doğrudan okunur. Bir kişiye yetenek, ona özel bir rolle (Kök, rol) üyeliği ve
// o kümeye bağlı yetenek satırı SQL ile yazılarak verilir; kişinin sayısı artırılır ki yetki belleği
// yenilensin.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const OLUSTUR = 'kimlik:rol-olustur';
const AD_DEGISTIR = 'kimlik:rol-adini-degistir';
const SIL = 'kimlik:rol-sil';

interface ListeCevabi {
  kayitlar: Record<string, unknown>[];
}

interface RolSatiri {
  kod: string | null;
  ad: string;
  silinme_zamani: Date | null;
}

type Not = Record<string, unknown> & { degisen: Record<string, unknown> };

let ortam: KimlikOrtami;
let kokGrup: string;
let temelRol: string;
let superadminRol: string;
let adSayaci = 0;

function yeniAd(): string {
  adSayaci += 1;
  return `rolyazsinama${String(adSayaci)}`;
}

type Yontem = 'get' | 'post' | 'patch' | 'delete';

function istek(
  yontem: Yontem,
  yol: string,
  belirtec?: string,
  govde?: object,
): request.Test {
  let ist = request(ortam.app.getHttpServer())[yontem](yol);
  if (belirtec !== undefined) {
    ist = ist.set(ortam.basliklar(belirtec));
  }
  return govde === undefined ? ist : ist.send(govde);
}

function yonetici(): string {
  return ortam.superadmin.erisimBelirteci;
}

async function olustur(ad: string): Promise<string> {
  const cevap = await istek('post', '/kimlik/rol', yonetici(), { ad });
  expect(cevap.status).toBe(201);
  return (cevap.body as { id: string }).id;
}

async function sayac(): Promise<number> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ sayac: number }>(
    'select sayac from yetki_surumu',
  );
  if (satir === undefined) {
    throw new Error('genel sayaç satırı yok');
  }
  return satir.sayac;
}

async function rolSatiri(id: string): Promise<RolSatiri | undefined> {
  return (
    await ortam.db.query<RolSatiri>(
      'select kod, ad, silinme_zamani from rol where id = $1',
      [id],
    )
  ).rows[0];
}

// Kaydın notları, yazılma sırasıyla.
async function notlar(kayitId: string): Promise<Not[]> {
  return (
    await ortam.db.query<{ govde: Not }>(
      `select govde from outbox_iz where govde->>'kayit_id' = $1
        order by olusturma_zamani, id`,
      [kayitId],
    )
  ).rows.map((s) => s.govde);
}

async function notSayisi(): Promise<number> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ sayi: number }>(
    'select count(*)::int as sayi from outbox_iz',
  );
  return satir?.sayi ?? 0;
}

// Reddedilmesi beklenen işten önce ve sonra: rol satırı, genel sayaç ve notların sayısı aynı kalır.
async function degismezlik(
  rolId: string,
  is: () => Promise<void>,
): Promise<void> {
  const once = [await rolSatiri(rolId), await sayac(), await notSayisi()];
  await is();
  expect([await rolSatiri(rolId), await sayac(), await notSayisi()]).toEqual(
    once,
  );
}

async function uyelikEkle(rolId: string): Promise<string> {
  const kisi = await ortam.kullaniciAc(yeniAd());
  const id = randomUUID();
  await ortam.db.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
    [id, kisi.id, kokGrup, rolId],
  );
  return id;
}

async function yetenekEkle(
  rolId: string,
  kaynak: string,
  eylem: string,
): Promise<string> {
  const id = randomUUID();
  const { rowCount } = await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, koken)
     select $1, $2, $3, i.id, true, true, 'test'
       from izin i where i.kaynak = $4 and i.eylem = $5`,
    [id, kokGrup, rolId, kaynak, eylem],
  );
  expect(rowCount).toBe(1);
  return id;
}

// Kişiye (Kök, yeni rol) üyeliği ve o kümeye bütün kayıtlar ve kolonlarla verilen yetenekler.
async function yetenekVer(
  kisiId: string,
  izinler: readonly [string, string][],
): Promise<void> {
  const rolId = randomUUID();
  await ortam.db.query('insert into rol (id, ad) values ($1, $2)', [
    rolId,
    'Sınama',
  ]);
  await ortam.db.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
    [randomUUID(), kisiId, kokGrup, rolId],
  );
  for (const [kaynak, eylem] of izinler) {
    await yetenekEkle(rolId, kaynak, eylem);
  }
  await ortam.db.query(
    'update kullanici set yetki_surumu = yetki_surumu + 1 where id = $1',
    [kisiId],
  );
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
  ortam = await kimlikOrtamiKur();
  const {
    rows: [satir],
  } = await ortam.db.query<{ kok: string; temel: string; superadmin: string }>(
    `select (select id from grup where ust_grup_id is null and silinme_zamani is null) as kok,
            (select id from rol where kod = 'temel') as temel,
            (select id from rol where kod = 'superadmin') as superadmin`,
  );
  if (satir === undefined) {
    throw new Error('tohum kök grubu ya da sistem rollerini yazmadı');
  }
  kokGrup = satir.kok;
  temelRol = satir.temel;
  superadminRol = satir.superadmin;
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) oluştur, adını değiştir, sil', () => {
  it('rol kodu boş oluşturulur, adı değişir, silinir; her işte genel sayaç bir artar ve not bırakılır', async () => {
    const ilk = await sayac();
    const cevap = await istek('post', '/kimlik/rol', yonetici(), {
      ad: '  Muhasebe  ',
    });
    expect(cevap.status).toBe(201);
    const { id } = cevap.body as { id: string };
    expect(Object.keys(cevap.body as object)).toEqual(['id']);
    expect(await rolSatiri(id)).toEqual({
      kod: null,
      ad: 'Muhasebe',
      silinme_zamani: null,
    });
    expect(await sayac()).toBe(ilk + 1);

    const guncelle = await istek('patch', `/kimlik/rol/${id}`, yonetici(), {
      ad: 'Finans',
    });
    expect(guncelle.status).toBe(204);
    expect(guncelle.text).toBe('');
    expect(await rolSatiri(id)).toMatchObject({ kod: null, ad: 'Finans' });
    expect(await sayac()).toBe(ilk + 2);

    const liste = await istek('get', '/kimlik/rol?boyut=100', yonetici());
    expect((liste.body as ListeCevabi).kayitlar.map((k) => k['id'])).toContain(
      id,
    );

    const sil = await istek('delete', `/kimlik/rol/${id}`, yonetici());
    expect(sil.status).toBe(204);
    expect(sil.text).toBe('');
    const silinmis = await rolSatiri(id);
    expect(silinmis).toMatchObject({ kod: null, ad: 'Finans' });
    expect(silinmis?.silinme_zamani).toBeInstanceOf(Date);
    expect(await sayac()).toBe(ilk + 3);

    const sonra = await istek('get', '/kimlik/rol?boyut=100', yonetici());
    expect(sonra.status).toBe(200);
    expect(
      (sonra.body as ListeCevabi).kayitlar.map((k) => k['id']),
    ).not.toContain(id);

    const ortak = {
      kullanici_id: ortam.superadmin.id,
      kaynak: 'Rol',
      kayit_id: id,
    };
    const [olusturma, guncelleme, silme, ...fazla] = await notlar(id);
    expect(fazla).toEqual([]);
    expect(olusturma).toMatchObject({
      ...ortak,
      is_adi: OLUSTUR,
      eylem: 'olusturma',
    });
    expect(olusturma?.degisen).toEqual({
      id: { yeni: id },
      kod: { yeni: null },
      ad: { yeni: 'Muhasebe' },
      silinme_zamani: { yeni: null },
    });
    expect(guncelleme).toMatchObject({
      ...ortak,
      is_adi: AD_DEGISTIR,
      eylem: 'guncelleme',
      degisen: { ad: { eski: 'Muhasebe', yeni: 'Finans' } },
    });
    expect(Object.keys(guncelleme?.degisen ?? {})).toEqual(['ad']);
    expect(silme).toMatchObject({ ...ortak, is_adi: SIL, eylem: 'silme' });
    expect(silme?.degisen).toEqual({
      id: { eski: id },
      kod: { eski: null },
      ad: { eski: 'Finans' },
      silinme_zamani: { eski: null },
    });
  });

  it('ad boşluk atıldıktan sonra 100 karakter olabilir', async () => {
    const ad = 'ç'.repeat(100);
    const id = await olustur(` ${ad} `);
    expect(await rolSatiri(id)).toMatchObject({ ad });
    const yeni = 'ğ'.repeat(100);
    const cevap = await istek('patch', `/kimlik/rol/${id}`, yonetici(), {
      ad: `${yeni}  `,
    });
    expect(cevap.status).toBe(204);
    expect(await rolSatiri(id)).toMatchObject({ ad: yeni });
  });
});

describe('b) dolu rol silinmez', () => {
  it('canlı üyeliği olan rol 409 cakisma döner ve hiçbir şey değişmez; üyelik silinince rol silinir', async () => {
    const rolId = await olustur('Üyeli');
    const uyelik = await uyelikEkle(rolId);
    await degismezlik(rolId, async () => {
      const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
      expect(cevap.status).toBe(409);
      expect(cevap.body).toMatchObject({ kod: 'cakisma' });
    });

    await ortam.db.query(
      'update uyelik set silinme_zamani = clock_timestamp() where id = $1',
      [uyelik],
    );
    const ilk = await sayac();
    const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
    expect(cevap.status).toBe(204);
    expect((await rolSatiri(rolId))?.silinme_zamani).toBeInstanceOf(Date);
    expect(await sayac()).toBe(ilk + 1);
  });

  it('canlı yeteneği olan rol 409 cakisma döner ve hiçbir şey değişmez; yetenek silinince rol silinir', async () => {
    const rolId = await olustur('Yetenekli');
    const yetenek = await yetenekEkle(rolId, 'Rol', 'oku');
    await degismezlik(rolId, async () => {
      const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
      expect(cevap.status).toBe(409);
      expect(cevap.body).toMatchObject({ kod: 'cakisma' });
    });

    await ortam.db.query(
      'update yetenek set silinme_zamani = clock_timestamp() where id = $1',
      [yetenek],
    );
    const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
    expect(cevap.status).toBe(204);
    expect((await rolSatiri(rolId))?.silinme_zamani).toBeInstanceOf(Date);
  });
});

describe('c) sistem rolü ve kod alanı', () => {
  it('sistem rolleri silinemez (409 cakisma) ve hiçbir şey değişmez', async () => {
    for (const rolId of [temelRol, superadminRol]) {
      await degismezlik(rolId, async () => {
        const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
        expect([rolId, cevap.status, cevap.body]).toMatchObject([
          rolId,
          409,
          { kod: 'cakisma' },
        ]);
      });
    }
  });

  // Sistem rolü denetimi rolün boşluğuna değil koduna dayanır (GV-083; TS-002 AK-43).
  it('kodu dolu ama hiç üyeliği ve yeteneği olmayan rol silinemez (409 cakisma); satır ve genel sayaç değişmez', async () => {
    const rolId = randomUUID();
    await ortam.db.query('insert into rol (id, kod, ad) values ($1, $2, $3)', [
      rolId,
      'bossistem',
      'Boş sistem',
    ]);
    await degismezlik(rolId, async () => {
      const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
      expect(cevap.status).toBe(409);
      expect(cevap.body).toMatchObject({ kod: 'cakisma' });
    });
    expect(await rolSatiri(rolId)).toEqual({
      kod: 'bossistem',
      ad: 'Boş sistem',
      silinme_zamani: null,
    });
  });

  it('kodu boş ve boş olan rol silinir (204); genel sayaç bir artar', async () => {
    const rolId = randomUUID();
    await ortam.db.query('insert into rol (id, ad) values ($1, $2)', [
      rolId,
      'Boş kodsuz',
    ]);
    const ilk = await sayac();
    const cevap = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
    expect(cevap.status).toBe(204);
    expect((await rolSatiri(rolId))?.silinme_zamani).toBeInstanceOf(Date);
    expect(await sayac()).toBe(ilk + 1);
  });

  it('sistem rolünün adı değiştirilebilir; kodu yerinde kalır', async () => {
    const ad = (await rolSatiri(temelRol))?.ad;
    const cevap = await istek('patch', `/kimlik/rol/${temelRol}`, yonetici(), {
      ad: 'Temel Kullanıcı',
    });
    expect(cevap.status).toBe(204);
    expect(await rolSatiri(temelRol)).toMatchObject({
      kod: 'temel',
      ad: 'Temel Kullanıcı',
      silinme_zamani: null,
    });
    const geri = await istek('patch', `/kimlik/rol/${temelRol}`, yonetici(), {
      ad,
    });
    expect(geri.status).toBe(204);
  });

  it('gövdede kod alanı 400 dogrulama_hatasi döner ve hiçbir şey değişmez', async () => {
    const rolId = await olustur('Kodsuz');
    const sayi = await notSayisi();
    const olusturma = await istek('post', '/kimlik/rol', yonetici(), {
      ad: 'Kodlu',
      kod: 'kodlu',
    });
    expect(olusturma.status).toBe(400);
    expect(olusturma.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    expect(await notSayisi()).toBe(sayi);
    await degismezlik(rolId, async () => {
      const cevap = await istek('patch', `/kimlik/rol/${rolId}`, yonetici(), {
        ad: 'Kodlu',
        kod: 'kodlu',
      });
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    });
    const { rows } = await ortam.db.query(
      "select id from rol where kod = 'kodlu' or ad = 'Kodlu'",
    );
    expect(rows).toEqual([]);
  });
});

describe('d) silinmiş rol', () => {
  it('silinmiş rol yeniden silinemez ve adı değiştirilemez (404 bulunamadi); hiçbir şey değişmez', async () => {
    const rolId = await olustur('Silinecek');
    expect(
      (await istek('delete', `/kimlik/rol/${rolId}`, yonetici())).status,
    ).toBe(204);
    await degismezlik(rolId, async () => {
      const sil = await istek('delete', `/kimlik/rol/${rolId}`, yonetici());
      expect(sil.status).toBe(404);
      expect(sil.body).toMatchObject({ kod: 'bulunamadi' });
      const guncelle = await istek('patch', `/kimlik/rol/${rolId}`, yonetici(), {
        ad: 'Dirilen',
      });
      expect(guncelle.status).toBe(404);
      expect(guncelle.body).toMatchObject({ kod: 'bulunamadi' });
    });
  });
});

describe('ortak', () => {
  const yazmalar = (rolId: string) =>
    [
      ['post', '/kimlik/rol', { ad: 'Yetkisiz' }],
      ['patch', `/kimlik/rol/${rolId}`, { ad: 'Yetkisiz' }],
      ['delete', `/kimlik/rol/${rolId}`, undefined],
    ] as const;

  it('belirteçsiz istek 401 kimlik_gerekli döner ve hiçbir şey değişmez', async () => {
    const rolId = await olustur('Belirteçsiz');
    await degismezlik(rolId, async () => {
      for (const [yontem, yol, govde] of yazmalar(rolId)) {
        const cevap = await istek(yontem, yol, undefined, govde);
        expect([yontem, cevap.status, cevap.body]).toMatchObject([
          yontem,
          401,
          { kod: 'kimlik_gerekli' },
        ]);
      }
    });
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok alır ve hiçbir şey değişmez', async () => {
    const rolId = await olustur('İzinsiz');
    const yalnizOkur = await ortam.kullaniciAc(yeniAd());
    await yetenekVer(yalnizOkur.id, [['Rol', 'oku']]);
    const temel = await ortam.kullaniciAc(yeniAd());
    await degismezlik(rolId, async () => {
      for (const kisi of [yalnizOkur, temel]) {
        for (const [yontem, yol, govde] of yazmalar(rolId)) {
          const cevap = await istek(yontem, yol, kisi.erisimBelirteci, govde);
          expect([yontem, cevap.status, cevap.body]).toMatchObject([
            yontem,
            403,
            { kod: 'yetki_yok' },
          ]);
        }
      }
    });
    const { rows } = await ortam.db.query(
      "select id from rol where ad = 'Yetkisiz'",
    );
    expect(rows).toEqual([]);
  });

  it('bir işin izni yalnız o işi açar: yalnız silebilen kişi oluşturamaz ve adı değiştiremez', async () => {
    const rolId = await olustur('Yalnız silinir');
    const silen = await ortam.kullaniciAc(yeniAd());
    await yetenekVer(silen.id, [['Rol', 'sil']]);
    await degismezlik(rolId, async () => {
      for (const [yontem, yol, govde] of yazmalar(rolId).slice(0, 2)) {
        const cevap = await istek(yontem, yol, silen.erisimBelirteci, govde);
        expect([yontem, cevap.status]).toEqual([yontem, 403]);
      }
    });
    const sil = await istek(
      'delete',
      `/kimlik/rol/${rolId}`,
      silen.erisimBelirteci,
    );
    expect(sil.status).toBe(204);
    const [, silme] = await notlar(rolId);
    expect(silme).toMatchObject({
      is_adi: SIL,
      eylem: 'silme',
      kullanici_id: silen.id,
    });
  });

  it('var olmayan rol kimliği 404 bulunamadi döner ve hiçbir şey değişmez', async () => {
    const yok = randomUUID();
    const once = [await sayac(), await notSayisi()];
    const guncelle = await istek('patch', `/kimlik/rol/${yok}`, yonetici(), {
      ad: 'Hayalet',
    });
    expect(guncelle.status).toBe(404);
    expect(guncelle.body).toMatchObject({ kod: 'bulunamadi' });
    const sil = await istek('delete', `/kimlik/rol/${yok}`, yonetici());
    expect(sil.status).toBe(404);
    expect(sil.body).toMatchObject({ kod: 'bulunamadi' });
    expect([await sayac(), await notSayisi()]).toEqual(once);
  });

  it('şemaya uymayan gövde, şemada olmayan alan ve bozuk kimlik 400 dogrulama_hatasi döner; hiçbir şey değişmez', async () => {
    const rolId = await olustur('Şemalı');
    const govdeler: object[] = [
      {},
      { ad: '' },
      { ad: '   ' },
      { ad: 'x'.repeat(101) },
      { ad: 5 },
      { ad: null },
      { ad: 'Fazla', fazla: true },
    ];
    await degismezlik(rolId, async () => {
      for (const govde of govdeler) {
        for (const [yontem, yol] of [
          ['post', '/kimlik/rol'],
          ['patch', `/kimlik/rol/${rolId}`],
        ] as const) {
          const cevap = await istek(yontem, yol, yonetici(), govde);
          expect([yontem, govde, cevap.status, cevap.body]).toMatchObject([
            yontem,
            govde,
            400,
            { kod: 'dogrulama_hatasi' },
          ]);
        }
      }
      for (const [yontem, govde] of [
        ['patch', { ad: 'Bozuk' }],
        ['delete', undefined],
      ] as const) {
        const cevap = await istek(
          yontem,
          '/kimlik/rol/kimlik-degil',
          yonetici(),
          govde,
        );
        expect([yontem, cevap.status, cevap.body]).toMatchObject([
          yontem,
          400,
          { kod: 'dogrulama_hatasi' },
        ]);
      }
    });
    const { rows } = await ortam.db.query(
      "select id from rol where ad in ('Fazla', 'Bozuk')",
    );
    expect(rows).toEqual([]);
  });
});
