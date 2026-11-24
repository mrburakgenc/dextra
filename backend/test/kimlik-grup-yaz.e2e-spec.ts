// Grup: oluştur ve adını değiştir (GV-066; TS-002 AK-39, "İşlem sınırları"; izin Grup:olustur ve
// Grup:guncelle). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-grup-yaz.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Şartlı yetenek, rol, üyelik ve hazırlık
// grupları SQL ile yazılır. Her başarılı işte genel sayaç bir artar ve kapı bir değişiklik kaydı notu
// bırakır; reddedilen işte grup satırları, notlar ve genel sayaç değişmez (işlem geri alınır).
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/grup';

// d) bölümünün ağacı: kökün altında A ve B; A'nın altında A1.
const G_A = '93000000-0000-4000-8000-00000000000a';
const G_A1 = '93000000-0000-4000-8000-0000000000a1';
const G_B = '93000000-0000-4000-8000-00000000000b';
const SILINMIS = '93000000-0000-4000-8000-0000000000dd';
const YOK = '93000000-0000-4000-8000-0000000000ff';
const ROL_SARTLI = '94000000-0000-4000-8000-000000000001';

// Grup satırının bütün kolonları (TS-002 "Veri modeli").
const GRUP_KOLONLARI = [
  'ad',
  'id',
  'olusturma_zamani',
  'silinme_zamani',
  'ust_grup_id',
];

type Not = Record<string, unknown>;

interface GrupSatiri {
  id: string;
  ust_grup_id: string | null;
  ad: string;
  silinme_zamani: Date | null;
}

interface Durum {
  sayac: number;
  notlar: number;
  gruplar: unknown;
}

let ortam: KimlikOrtami;
let kok: string;

function gonder(
  yontem: 'post' | 'patch',
  yol: string,
  govde: unknown,
  erisimBelirteci?: string,
): request.Test {
  const istek = request(ortam.app.getHttpServer())[yontem](yol);
  return (
    erisimBelirteci === undefined
      ? istek
      : istek.set(ortam.basliklar(erisimBelirteci))
  ).send(govde as object);
}

const olustur = (govde: unknown, belirtec?: string): request.Test =>
  gonder('post', YOL, govde, belirtec ?? ortam.superadmin.erisimBelirteci);

const guncelle = (
  id: string,
  govde: unknown,
  belirtec?: string,
): request.Test =>
  gonder(
    'patch',
    `${YOL}/${id}`,
    govde,
    belirtec ?? ortam.superadmin.erisimBelirteci,
  );

async function sayac(): Promise<number> {
  const { rows } = await ortam.db.query<{ sayac: number }>(
    'select sayac from yetki_surumu',
  );
  return rows[0]?.sayac ?? -1;
}

async function grup(id: string): Promise<GrupSatiri | undefined> {
  const { rows } = await ortam.db.query<GrupSatiri>(
    'select id, ust_grup_id, ad, silinme_zamani from grup where id = $1',
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

// (grupId, rol) kümesine verilen eylem için şartlı, bütün kolonlu yetenek yazar.
async function sartliYetenek(
  eylem: string,
  grupId: string,
  rolId: string,
  sart: unknown,
): Promise<void> {
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kolonlar, koken)
     select gen_random_uuid(), $1, $2, i.id, $3::jsonb, true, 'yonetici'
       from izin i where i.kaynak = 'Grup' and i.eylem = $4`,
    [grupId, rolId, JSON.stringify(sart), eylem],
  );
}

beforeAll(async () => {
  ortam = await kimlikOrtamiKur();
  const {
    rows: [satir],
  } = await ortam.db.query<{ id: string }>(
    'select id from grup where ust_grup_id is null and silinme_zamani is null',
  );
  kok = satir?.id ?? '';
  for (const [id, ust, ad] of [
    [G_A, kok, 'A'],
    [G_B, kok, 'B'],
    [G_A1, G_A, 'A1'],
  ] as const) {
    await ortam.db.query(
      'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
      [id, ust, ad],
    );
  }
  await ortam.db.query(
    `insert into grup (id, ust_grup_id, ad, silinme_zamani)
     values ($1, $2, 'Silinmiş', now())`,
    [SILINMIS, kok],
  );
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) oluştur ve adını değiştir', () => {
  it('kökün altında grup, onun altında alt grup açılır; adları değişir; her işte genel sayaç bir artar', async () => {
    const sayac0 = await sayac();

    const ust = await olustur({ ad: '  Bölge  ', ustGrupId: kok });
    expect(ust.status).toBe(201);
    expect(Object.keys(ust.body as object)).toEqual(['id']);
    const ustId = (ust.body as { id: string }).id;
    expect(await grup(ustId)).toEqual({
      id: ustId,
      ust_grup_id: kok,
      ad: 'Bölge',
      silinme_zamani: null,
    });
    expect(await sayac()).toBe(sayac0 + 1);

    const alt = await olustur({ ad: 'Şube', ustGrupId: ustId });
    expect(alt.status).toBe(201);
    const altId = (alt.body as { id: string }).id;
    expect(await grup(altId)).toMatchObject({ ust_grup_id: ustId, ad: 'Şube' });
    expect(await sayac()).toBe(sayac0 + 2);

    const ustAdi = await guncelle(ustId, { ad: ' Bölge Müdürlüğü ' });
    expect(ustAdi.status).toBe(204);
    expect(ustAdi.text).toBe('');
    expect(await grup(ustId)).toMatchObject({
      ust_grup_id: kok,
      ad: 'Bölge Müdürlüğü',
    });
    expect(await sayac()).toBe(sayac0 + 3);

    const altAdi = await guncelle(altId, { ad: 'Merkez Şube' });
    expect(altAdi.status).toBe(204);
    expect(await grup(altId)).toMatchObject({
      ust_grup_id: ustId,
      ad: 'Merkez Şube',
    });
    expect(await sayac()).toBe(sayac0 + 4);

    // Notlar: işin adı, yazan ve değişen kolonlar.
    const [ustOlusturma, ustGuncelleme, ...ustFazla] = await notlar(ustId);
    expect(ustFazla).toEqual([]);
    expect(ustOlusturma).toMatchObject({
      is_adi: 'kimlik:grup-olustur',
      kullanici_id: ortam.superadmin.id,
      eylem: 'olusturma',
      kaynak: 'Grup',
      kayit_id: ustId,
    });
    expect(
      Object.keys(ustOlusturma?.['degisen'] as object).sort(),
    ).toEqual(GRUP_KOLONLARI);
    expect(ustOlusturma?.['degisen']).toMatchObject({
      ad: { yeni: 'Bölge' },
      ust_grup_id: { yeni: kok },
      silinme_zamani: { yeni: null },
    });
    expect(ustGuncelleme).toMatchObject({
      is_adi: 'kimlik:grup-guncelle',
      kullanici_id: ortam.superadmin.id,
      eylem: 'guncelleme',
      kaynak: 'Grup',
      kayit_id: ustId,
      degisen: { ad: { eski: 'Bölge', yeni: 'Bölge Müdürlüğü' } },
    });
    expect(Object.keys(ustGuncelleme?.['degisen'] as object)).toEqual(['ad']);

    const altNotlari = await notlar(altId);
    expect(altNotlari.map((n) => [n['is_adi'], n['kullanici_id']])).toEqual([
      ['kimlik:grup-olustur', ortam.superadmin.id],
      ['kimlik:grup-guncelle', ortam.superadmin.id],
    ]);
    expect(altNotlari[1]?.['degisen']).toEqual({
      ad: { eski: 'Şube', yeni: 'Merkez Şube' },
    });
  });

  it('boşlukları atıldıktan sonra 100 karakter olan ad kabul edilir', async () => {
    const ad = 'x'.repeat(100);
    const cevap = await olustur({ ad: `  ${ad}  `, ustGrupId: kok });
    expect(cevap.status).toBe(201);
    expect(await grup((cevap.body as { id: string }).id)).toMatchObject({
      ad,
    });
  });
});

describe('b) üst grup', () => {
  it('üst grupsuz ya da üst grubu boş gövde 400 dogrulama_hatasi', async () => {
    for (const govde of [{ ad: 'Kök 2' }, { ad: 'Kök 2', ustGrupId: null }]) {
      await reddedilir(() => olustur(govde), 400, 'dogrulama_hatasi');
    }
  });

  it('silinmiş ya da var olmayan üst grup 409 cakisma; satır oluşmaz', async () => {
    for (const ustGrupId of [SILINMIS, YOK]) {
      await reddedilir(
        () => olustur({ ad: 'Yetim', ustGrupId }),
        409,
        'cakisma',
      );
    }
  });
});

describe('c) güncelleme yalnız adı kabul eder', () => {
  it('gövdede ustGrupId ile güncelleme 400 dogrulama_hatasi', async () => {
    for (const govde of [
      { ad: 'Yeni ad', ustGrupId: G_B },
      { ustGrupId: G_B },
    ]) {
      await reddedilir(() => guncelle(G_A1, govde), 400, 'dogrulama_hatasi');
    }
    expect(await grup(G_A1)).toMatchObject({ ust_grup_id: G_A, ad: 'A1' });
  });
});

describe('d) şartlı yetenek', () => {
  it('yeteneği A grubu ve altıyla sınırlı kişi yalnız orada grup açar ve günceller', async () => {
    const kisi = await ortam.kullaniciAc('sartli-grup-yazici');
    await ortam.db.query('insert into rol (id, ad) values ($1, $2)', [
      ROL_SARTLI,
      'Grup yazıcı',
    ]);
    await ortam.db.query(
      `insert into uyelik (id, kullanici_id, grup_id, rol_id)
       values (gen_random_uuid(), $1, $2, $3)`,
      [kisi.id, G_A, ROL_SARTLI],
    );
    const grubuVeAlti = { yerTutucu: 'yetenek_grubu_ve_alti' };
    await sartliYetenek('olustur', G_A, ROL_SARTLI, [
      { alan: 'ustGrupId', islec: 'listede', deger: grubuVeAlti },
    ]);
    await sartliYetenek('guncelle', G_A, ROL_SARTLI, [
      { alan: 'id', islec: 'listede', deger: grubuVeAlti },
    ]);

    // Şartın tuttuğu yer.
    const acilan = await olustur(
      { ad: 'A1 altı', ustGrupId: G_A1 },
      kisi.erisimBelirteci,
    );
    expect(acilan.status).toBe(201);
    const acilanId = (acilan.body as { id: string }).id;
    expect(await grup(acilanId)).toMatchObject({ ust_grup_id: G_A1 });
    expect((await notlar(acilanId))[0]).toMatchObject({
      is_adi: 'kimlik:grup-olustur',
      kullanici_id: kisi.id,
    });
    const adi = await guncelle(G_A1, { ad: 'A1 yeni' }, kisi.erisimBelirteci);
    expect(adi.status).toBe(204);
    expect(await grup(G_A1)).toMatchObject({ ad: 'A1 yeni' });

    // Şartın tutmadığı yer.
    for (const ustGrupId of [G_B, kok]) {
      await reddedilir(
        () => olustur({ ad: 'Dışarıda', ustGrupId }, kisi.erisimBelirteci),
        403,
        'yetki_yok',
      );
    }
    for (const id of [G_B, kok]) {
      await reddedilir(
        () => guncelle(id, { ad: 'Dışarıda' }, kisi.erisimBelirteci),
        404,
        'bulunamadi',
      );
    }
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    await reddedilir(
      () => gonder('post', YOL, { ad: 'X', ustGrupId: kok }),
      401,
      'kimlik_gerekli',
    );
    await reddedilir(
      () => gonder('patch', `${YOL}/${G_A}`, { ad: 'X' }),
      401,
      'kimlik_gerekli',
    );
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok; hiçbir satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('grup-yetkisiz');
    await reddedilir(
      () => olustur({ ad: 'X', ustGrupId: kok }, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
    await reddedilir(
      () => guncelle(G_A, { ad: 'X' }, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    await reddedilir(() => guncelle(YOK, { ad: 'X' }), 404, 'bulunamadi');
  });

  it('şemaya uymayan gövde, şemada olmayan alan ve kimlik olmayan yol 400 dogrulama_hatasi', async () => {
    for (const govde of [
      {},
      { ad: '', ustGrupId: kok },
      { ad: '   ', ustGrupId: kok },
      { ad: 'x'.repeat(101), ustGrupId: kok },
      { ad: 5, ustGrupId: kok },
      { ad: 'X', ustGrupId: 'abc' },
      { ad: 'X', ustGrupId: kok, silinmeZamani: null },
      { ad: 'X', ustGrupId: kok, id: YOK },
    ]) {
      await reddedilir(() => olustur(govde), 400, 'dogrulama_hatasi');
    }
    for (const govde of [
      {},
      { ad: '' },
      { ad: '   ' },
      { ad: 'x'.repeat(101) },
      { ad: null },
      { ad: 'X', silinmeZamani: null },
    ]) {
      await reddedilir(() => guncelle(G_A, govde), 400, 'dogrulama_hatasi');
    }
    await reddedilir(
      () => guncelle('abc', { ad: 'X' }),
      400,
      'dogrulama_hatasi',
    );
  });
});
