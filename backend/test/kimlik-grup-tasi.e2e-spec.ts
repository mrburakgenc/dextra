// Grup: taşı ve sil (GV-067; TS-002 AK-39, "İşlem sınırları"; KR-008 Seçim 22 ve 27; izin Grup:tasi
// ve Grup:sil). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-grup-tasi.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Her test kendi gruplarını SQL ile kökün
// altına yazar. Her başarılı işte genel sayaç bir artar ve kapı bir değişiklik kaydı notu bırakır;
// reddedilen işte grup satırları, notlar ve genel sayaç değişmez (işlem geri alınır).
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/grup';
const YOK = '95000000-0000-4000-8000-0000000000ff';

type Not = Record<string, unknown>;

interface GrupSatiri {
  id: string;
  ust_grup_id: string | null;
  silinme_zamani: Date | null;
}

interface Durum {
  sayac: number;
  notlar: number;
  gruplar: unknown;
}

let ortam: KimlikOrtami;
let kok: string;
let temelRol: string;

const tasi = (
  id: string,
  govde: unknown,
  belirtec: string | null = ortam.superadmin.erisimBelirteci,
): request.Test => {
  const istek = request(ortam.app.getHttpServer()).post(`${YOL}/${id}/tasi`);
  return (
    belirtec === null ? istek : istek.set(ortam.basliklar(belirtec))
  ).send(govde as object);
};

const sil = (
  id: string,
  belirtec: string | null = ortam.superadmin.erisimBelirteci,
): request.Test => {
  const istek = request(ortam.app.getHttpServer()).delete(`${YOL}/${id}`);
  return belirtec === null ? istek : istek.set(ortam.basliklar(belirtec));
};

// Verilen üst grubun altına grup yazar, kimliğini döner.
async function grupYaz(ustGrupId: string, silinmis = false): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    `insert into grup (id, ust_grup_id, ad, silinme_zamani)
     values ($1, $2, 'Grup', case when $3::boolean then now() end)`,
    [id, ustGrupId, silinmis],
  );
  return id;
}

async function sayac(): Promise<number> {
  const { rows } = await ortam.db.query<{ sayac: number }>(
    'select sayac from yetki_surumu',
  );
  return rows[0]?.sayac ?? -1;
}

async function grup(id: string): Promise<GrupSatiri | undefined> {
  const { rows } = await ortam.db.query<GrupSatiri>(
    'select id, ust_grup_id, silinme_zamani from grup where id = $1',
    [id],
  );
  return rows[0];
}

// Bir kaydın değişiklik kaydı notları, yazılma sırasıyla.
async function notlar(kayitId: string): Promise<Not[]> {
  const { rows } = await ortam.db.query<{ govde: Not }>(
    `select govde from outbox_iz
      where govde->>'kaynak' = 'Grup' and govde->>'kayit_id' = $1
      order by olusturma_zamani, id`,
    [kayitId],
  );
  return rows.map((satir) => satir.govde);
}

// Reddedilen işin dokunmaması gereken her şey: genel sayaç, bütün notların sayısı, bütün grup satırları.
async function durum(): Promise<Durum> {
  const { rows } = await ortam.db.query<Durum>(
    `select (select sayac from yetki_surumu) as sayac,
            (select count(*)::int from outbox_iz) as notlar,
            (select coalesce(json_agg(g order by g.id), '[]'::json) from grup g) as gruplar`,
  );
  const sonuc = rows[0];
  if (sonuc === undefined) {
    throw new Error('durum okunamadı');
  }
  return sonuc;
}

// İstek reddedilir ve hiçbir şey değişmez.
async function reddedilir(
  istek: () => request.Test,
  durumKodu: number,
  kod: string,
): Promise<void> {
  const once = await durum();
  const cevap = await istek();
  expect(cevap.status).toBe(durumKodu);
  expect(cevap.body).toMatchObject({ kod });
  expect(await durum()).toEqual(once);
}

// Okuma ucunun verdiği, verilen grubun doğrudan altındaki grupların kimlikleri.
async function listedekiAltGruplar(ustGrupId: string): Promise<string[]> {
  const cevap = await request(ortam.app.getHttpServer())
    .get(YOL)
    .query({ ustGrupId, boyut: 100 })
    .set(ortam.basliklar(ortam.superadmin.erisimBelirteci));
  expect(cevap.status).toBe(200);
  return (cevap.body as { kayitlar: { id: string }[] }).kayitlar
    .map((kayit) => kayit.id)
    .sort();
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
  const { rows } = await ortam.db.query<{ kok: string; rol: string }>(
    `select (select id from grup where ust_grup_id is null and silinme_zamani is null) as kok,
            (select id from rol where kod = 'temel') as rol`,
  );
  kok = rows[0]?.kok ?? '';
  temelRol = rows[0]?.rol ?? '';
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) taşı', () => {
  it('grup kardeşinin altına taşınır; genel sayaç artar; not eski ve yeni üst grubu taşır', async () => {
    const ust = await grupYaz(kok);
    const tasinan = await grupYaz(ust);
    const kardes = await grupYaz(ust);
    const sayac0 = await sayac();

    const cevap = await tasi(tasinan, { ustGrupId: kardes });
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');
    expect(await grup(tasinan)).toMatchObject({
      ust_grup_id: kardes,
      silinme_zamani: null,
    });
    expect(await sayac()).toBe(sayac0 + 1);

    const [not, ...fazla] = await notlar(tasinan);
    expect(fazla).toEqual([]);
    expect(not).toMatchObject({
      is_adi: 'kimlik:grup-tasi',
      kullanici_id: ortam.superadmin.id,
      eylem: 'guncelleme',
      kaynak: 'Grup',
      kayit_id: tasinan,
    });
    expect(not?.['degisen']).toEqual({
      ust_grup_id: { eski: ust, yeni: kardes },
    });
  });

  it('zaten hedefin altındaki grup için 204 döner ve satır değişmez', async () => {
    const ust = await grupYaz(kok);
    const tasinan = await grupYaz(ust);
    const gruplar0 = (await durum()).gruplar;

    const cevap = await tasi(tasinan, { ustGrupId: ust });
    expect(cevap.status).toBe(204);
    expect((await durum()).gruplar).toEqual(gruplar0);
    // Kapı değer değişmeyince yazmaz; not boş değişiklikle yazılır.
    const [not] = await notlar(tasinan);
    expect(not).toMatchObject({ is_adi: 'kimlik:grup-tasi', degisen: {} });
  });
});

describe('b) taşımanın reddi', () => {
  it('grubu kendisinin, çocuğunun ve torununun altına taşımak 409 cakisma; satır değişmez', async () => {
    const tasinan = await grupYaz(kok);
    const cocuk = await grupYaz(tasinan);
    const torun = await grupYaz(cocuk);
    for (const ustGrupId of [tasinan, cocuk, torun]) {
      await reddedilir(() => tasi(tasinan, { ustGrupId }), 409, 'cakisma');
    }
    expect(await grup(tasinan)).toMatchObject({ ust_grup_id: kok });
  });

  it('kök grubu taşımak 409 cakisma', async () => {
    const hedef = await grupYaz(kok);
    await reddedilir(() => tasi(kok, { ustGrupId: hedef }), 409, 'cakisma');
  });

  it('silinmiş ya da var olmayan hedef 409 cakisma', async () => {
    const tasinan = await grupYaz(kok);
    const silinmis = await grupYaz(kok, true);
    for (const ustGrupId of [silinmis, YOK]) {
      await reddedilir(() => tasi(tasinan, { ustGrupId }), 409, 'cakisma');
    }
  });
});

describe('c) sil', () => {
  it('boş grup yumuşak silinir ve okuma listesinde görünmez; genel sayaç artar; not yazılır', async () => {
    const ust = await grupYaz(kok);
    const silinen = await grupYaz(ust);
    const kalan = await grupYaz(ust);
    expect(await listedekiAltGruplar(ust)).toEqual([silinen, kalan].sort());
    const sayac0 = await sayac();

    const cevap = await sil(silinen);
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');
    expect((await grup(silinen))?.silinme_zamani).toBeInstanceOf(Date);
    expect(await sayac()).toBe(sayac0 + 1);
    expect(await listedekiAltGruplar(ust)).toEqual([kalan]);

    const [not, ...fazla] = await notlar(silinen);
    expect(fazla).toEqual([]);
    expect(not).toMatchObject({
      is_adi: 'kimlik:grup-sil',
      kullanici_id: ortam.superadmin.id,
      eylem: 'silme',
      kaynak: 'Grup',
      kayit_id: silinen,
    });
    expect(not?.['degisen']).toMatchObject({
      id: { eski: silinen },
      ust_grup_id: { eski: ust },
      silinme_zamani: { eski: null },
    });
  });

  it('canlı alt grubu olan grup 409 cakisma; alt grup silinmişse silinir', async () => {
    const dolu = await grupYaz(kok);
    const alt = await grupYaz(dolu);
    await reddedilir(() => sil(dolu), 409, 'cakisma');
    await ortam.db.query('update grup set silinme_zamani = now() where id = $1', [
      alt,
    ]);
    expect((await sil(dolu)).status).toBe(204);
    expect((await grup(dolu))?.silinme_zamani).toBeInstanceOf(Date);
  });

  it('canlı üyeliği olan grup 409 cakisma; üyelik silinmişse silinir', async () => {
    const dolu = await grupYaz(kok);
    const uyelik = randomUUID();
    await ortam.db.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [uyelik, ortam.superadmin.id, dolu, temelRol],
    );
    await reddedilir(() => sil(dolu), 409, 'cakisma');
    await ortam.db.query(
      'update uyelik set silinme_zamani = now() where id = $1',
      [uyelik],
    );
    expect((await sil(dolu)).status).toBe(204);
    expect((await grup(dolu))?.silinme_zamani).toBeInstanceOf(Date);
  });

  it('canlı yeteneği olan grup 409 cakisma; yetenek silinmişse silinir', async () => {
    const dolu = await grupYaz(kok);
    const yetenek = randomUUID();
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kolonlar, koken)
       select $1, $2, $3, i.id, true, 'yonetici'
         from izin i where i.kaynak = 'Grup' and i.eylem = 'oku'`,
      [yetenek, dolu, temelRol],
    );
    await reddedilir(() => sil(dolu), 409, 'cakisma');
    await ortam.db.query(
      'update yetenek set silinme_zamani = now() where id = $1',
      [yetenek],
    );
    expect((await sil(dolu)).status).toBe(204);
    expect((await grup(dolu))?.silinme_zamani).toBeInstanceOf(Date);
  });
});

describe('d) kök', () => {
  it('kök grup silinemez: 409 cakisma', async () => {
    await reddedilir(() => sil(kok), 409, 'cakisma');
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    const grupId = await grupYaz(kok);
    await reddedilir(
      () => tasi(grupId, { ustGrupId: kok }, null),
      401,
      'kimlik_gerekli',
    );
    await reddedilir(() => sil(grupId, null), 401, 'kimlik_gerekli');
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok; hiçbir satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('grup-tasi-yetkisiz');
    const grupId = await grupYaz(kok);
    const hedef = await grupYaz(kok);
    await reddedilir(
      () => tasi(grupId, { ustGrupId: hedef }, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
    await reddedilir(() => sil(grupId, kisi.erisimBelirteci), 403, 'yetki_yok');
  });

  it('var olmayan ya da silinmiş kimlik 404 bulunamadi', async () => {
    const silinmis = await grupYaz(kok, true);
    for (const id of [YOK, silinmis]) {
      await reddedilir(() => tasi(id, { ustGrupId: kok }), 404, 'bulunamadi');
      await reddedilir(() => sil(id), 404, 'bulunamadi');
    }
  });

  it('şemaya uymayan gövde, şemada olmayan alan ve kimlik olmayan yol 400 dogrulama_hatasi', async () => {
    const grupId = await grupYaz(kok);
    for (const govde of [
      {},
      { ustGrupId: null },
      { ustGrupId: 'abc' },
      { ustGrupId: 5 },
      { ustGrupId: kok, ad: 'X' },
      { ustGrupId: kok, silinmeZamani: null },
    ]) {
      await reddedilir(() => tasi(grupId, govde), 400, 'dogrulama_hatasi');
    }
    await reddedilir(
      () => tasi('abc', { ustGrupId: kok }),
      400,
      'dogrulama_hatasi',
    );
    await reddedilir(() => sil('abc'), 400, 'dogrulama_hatasi');
  });
});
