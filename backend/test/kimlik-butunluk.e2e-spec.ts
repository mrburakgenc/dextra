// Bütünlük soruları (GV-054; TS-002 "Yapı", "bütünlük sorusu"; değişmez 1-5, 9, 18) ve yönetim
// testlerinin ortak kurulumu. Koşturma:
//   pnpm -C backend test:e2e test/kimlik-butunluk.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) açılır; yardımcı böylece sınanmış olur.
// Satırlar SQL ile hazırlanır; sorular Unit of Work'ün işleminde sorulur. "İsteyenin yeteneğinden
// bağımsızdır" sınaması için herkese açık bir sınama ucu, testin verdiği soruları isteğin
// içinde, işlem açarak sorar ve isteğin derlenmiş kural sayısıyla birlikte döner (yetki yoksa -1).
import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import { ButunlukSorusu } from '../src/features/kimlik/_shared/butunluk-sorusu.js';
import { type Islem, UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { HerkeseAcik } from '../src/shared/guvenlik/isaretler.js';
import { istekBaglami } from '../src/shared/http/istek-baglami.js';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

type Sorulacak = (
  soru: ButunlukSorusu,
  islem: Islem,
) => Promise<Record<string, boolean>>;

let ortam: KimlikOrtami;
let istekteSorulacak: Sorulacak | undefined;
let kokGrup: string;
let temelRol: string;
let superadminRol: string;
let izin: string;
let sistemAktoru: string;
let adSayaci = 0;

// İsteğin içinde, istekteSorulacak'taki soruları sorar.
@Controller('butunluk-sinama')
class ButunlukSinamaUcu {
  @Get('sor')
  @HerkeseAcik()
  async sor(): Promise<{
    kuralSayisi: number;
    cevaplar: Record<string, boolean>;
  }> {
    const sorulacak = istekteSorulacak;
    if (sorulacak === undefined) {
      throw new Error('sorulacak soru verilmedi');
    }
    const kuralSayisi = istekBaglami().yetki?.kurallar.length ?? -1;
    const cevaplar = await ortam.app
      .get(UnitOfWork)
      .run((islem) => sorulacak(ortam.app.get(ButunlukSorusu), islem));
    return { kuralSayisi, cevaplar };
  }
}

function sor<T>(
  is: (soru: ButunlukSorusu, islem: Islem) => Promise<T>,
): Promise<T> {
  return ortam.app
    .get(UnitOfWork)
    .run((islem) => is(ortam.app.get(ButunlukSorusu), islem));
}

async function tekDeger(
  sql: string,
  degerler: unknown[] = [],
): Promise<string> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ deger: string }>(sql, degerler);
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
  }
  return satir.deger;
}

function yeniAd(): string {
  adSayaci += 1;
  return `butunluk${String(adSayaci)}`;
}

async function grupEkle(ustGrupId: string, silinmis = false): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    `insert into grup (id, ust_grup_id, ad, silinme_zamani)
     values ($1, $2, 'Sınama', case when $3 then clock_timestamp() end)`,
    [id, ustGrupId, silinmis],
  );
  return id;
}

async function rolEkle(silinmis = false): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    `insert into rol (id, ad, silinme_zamani)
     values ($1, 'Sınama', case when $2 then clock_timestamp() end)`,
    [id, silinmis],
  );
  return id;
}

async function uyelikEkle(
  kullaniciId: string,
  grupId: string,
  rolId: string,
  silinmis = false,
): Promise<void> {
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id, silinme_zamani)
     values ($1, $2, $3, $4, case when $5 then clock_timestamp() end)`,
    [randomUUID(), kullaniciId, grupId, rolId, silinmis],
  );
}

async function yetenekEkle(
  grupId: string,
  rolId: string,
  silinmis = false,
): Promise<void> {
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, koken, silinme_zamani)
     values ($1, $2, $3, $4, 'test', case when $5 then clock_timestamp() end)`,
    [randomUUID(), grupId, rolId, izin, silinmis],
  );
}

// Testin verdiği kişilerin canlı (Kök, SuperAdmin) üyeliklerini test bitince kapatır; böylece
// sonraki testlerde girebilen tek SuperAdmin yine superadmin'dir.
function superAdminlikleriTestSonundaKapat(kisiler: readonly string[]): void {
  onTestFinished(async () => {
    await ortam.db.query(
      `update uyelik set silinme_zamani = clock_timestamp()
        where kullanici_id = any($1) and rol_id = $2 and silinme_zamani is null`,
      [kisiler, superadminRol],
    );
  });
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
  ortam = await kimlikOrtamiKur({ controllers: [ButunlukSinamaUcu] });
  kokGrup = await tekDeger(
    'select id as deger from grup where ust_grup_id is null and silinme_zamani is null',
  );
  temelRol = await tekDeger("select id as deger from rol where kod = 'temel'");
  superadminRol = await tekDeger(
    "select id as deger from rol where kod = 'superadmin'",
  );
  izin = await tekDeger(
    "select id as deger from izin where kaynak = 'Grup' and eylem = 'oku'",
  );
  sistemAktoru = await tekDeger(
    'select id as deger from kullanici where sistem_aktoru',
  );
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('ortak kurulum yardımcısı', () => {
  it('superadmin oturumuyla yalnız kendisi işaretli uç (yetkilerim) 200 döner', async () => {
    const cevap = await request(ortam.app.getHttpServer())
      .get('/kimlik/oturum/yetkilerim')
      .set(ortam.basliklar(ortam.superadmin.erisimBelirteci));
    expect(cevap.status).toBe(200);
    expect(
      (cevap.body as { kurallar: unknown[] }).kurallar.length,
    ).toBeGreaterThan(0);
  });

  it('SQL ile açılan ikinci kullanıcının oturumuyla yetkilerim 200 döner', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    expect(kisi.id).not.toBe(ortam.superadmin.id);
    const cevap = await request(ortam.app.getHttpServer())
      .get('/kimlik/oturum/yetkilerim')
      .set(ortam.basliklar(kisi.erisimBelirteci));
    expect(cevap.status).toBe(200);
  });
});

describe('bu kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu', () => {
  it('evet: superadmin', async () => {
    expect(
      await sor((s, i) => s.kokSuperAdminUyesiMi(i, ortam.superadmin.id)),
    ).toBe(true);
  });

  it('hayır: yalnız (Kök, Temel) üyesi, silinmiş (Kök, SuperAdmin) üyeliği olan ve kök dışı grupta SuperAdmin olan', async () => {
    const temel = await ortam.kullaniciAc(yeniAd());
    const silinmis = await ortam.kullaniciAc(yeniAd());
    await uyelikEkle(silinmis.id, kokGrup, superadminRol, true);
    const altGrupta = await ortam.kullaniciAc(yeniAd());
    await uyelikEkle(altGrupta.id, await grupEkle(kokGrup), superadminRol);
    for (const kisi of [temel, silinmis, altGrupta]) {
      expect(await sor((s, i) => s.kokSuperAdminUyesiMi(i, kisi.id))).toBe(
        false,
      );
    }
  });
});

describe('bu kişi girebilen son (Kök, SuperAdmin) üyesi mi', () => {
  it('evet: girebilen tek SuperAdmin superadmin; hayır: SuperAdmin olmayan kişi', async () => {
    const temel = await ortam.kullaniciAc(yeniAd());
    expect(
      await sor((s, i) =>
        s.sonGirebilenKokSuperAdminMi(i, ortam.superadmin.id),
      ),
    ).toBe(true);
    expect(
      await sor((s, i) => s.sonGirebilenKokSuperAdminMi(i, temel.id)),
    ).toBe(false);
  });

  it('iki SuperAdmin varken ikisi için de hayır', async () => {
    const ikinci = await ortam.kullaniciAc(yeniAd());
    superAdminlikleriTestSonundaKapat([ikinci.id]);
    await uyelikEkle(ikinci.id, kokGrup, superadminRol);
    for (const kisi of [ortam.superadmin.id, ikinci.id]) {
      expect(await sor((s, i) => s.sonGirebilenKokSuperAdminMi(i, kisi))).toBe(
        false,
      );
    }
  });

  it('biri pasifken öbürü için evet, pasif olan için hayır', async () => {
    const pasif = await ortam.kullaniciAc(yeniAd());
    superAdminlikleriTestSonundaKapat([pasif.id]);
    await uyelikEkle(pasif.id, kokGrup, superadminRol);
    await ortam.db.query(
      'update kullanici set pasif_zamani = clock_timestamp() where id = $1',
      [pasif.id],
    );
    expect(
      await sor((s, i) =>
        s.sonGirebilenKokSuperAdminMi(i, ortam.superadmin.id),
      ),
    ).toBe(true);
    expect(
      await sor((s, i) => s.sonGirebilenKokSuperAdminMi(i, pasif.id)),
    ).toBe(false);
  });

  it('öbürünün parola sırrı yokken kalan tek kişi için evet, sırrı olmayan için hayır', async () => {
    const sirsiz = await ortam.kullaniciAc(yeniAd());
    superAdminlikleriTestSonundaKapat([sirsiz.id]);
    await uyelikEkle(sirsiz.id, kokGrup, superadminRol);
    await ortam.db.query(
      'delete from kullanici_sirri where kullanici_id = $1',
      [sirsiz.id],
    );
    expect(
      await sor((s, i) =>
        s.sonGirebilenKokSuperAdminMi(i, ortam.superadmin.id),
      ),
    ).toBe(true);
    expect(
      await sor((s, i) => s.sonGirebilenKokSuperAdminMi(i, sirsiz.id)),
    ).toBe(false);
  });

  it('unutulmuş, kullanıcı adı olmayan ve sistem aktörü olan SuperAdmin girebilen sayılmaz', async () => {
    const unutulmus = await ortam.kullaniciAc(yeniAd());
    const adsiz = await ortam.kullaniciAc(yeniAd());
    superAdminlikleriTestSonundaKapat([unutulmus.id, adsiz.id, sistemAktoru]);
    await ortam.db.query(
      'update kullanici set unutulma_zamani = clock_timestamp() where id = $1',
      [unutulmus.id],
    );
    await ortam.db.query(
      'update kullanici set kullanici_adi = null where id = $1',
      [adsiz.id],
    );
    // Sistem aktörüne giriş bilgisi ve sır, sayımın onu işaretiyle dışarıda bıraktığını görmek için
    // SQL ile verilir (olağan yolla oluşamaz; değişmez 16).
    await ortam.db.query(
      "update kullanici set kullanici_adi = 'aktor' where id = $1",
      [sistemAktoru],
    );
    await ortam.db.query(
      "insert into kullanici_sirri (kullanici_id, parola_ozeti) values ($1, 'ozet')",
      [sistemAktoru],
    );
    for (const kisi of [unutulmus.id, adsiz.id, sistemAktoru]) {
      await uyelikEkle(kisi, kokGrup, superadminRol);
    }
    expect(
      await sor((s, i) =>
        s.sonGirebilenKokSuperAdminMi(i, ortam.superadmin.id),
      ),
    ).toBe(true);
  });
});

describe('bu grup canlı mı', () => {
  it('evet: silinmemiş grup; hayır: silinmiş grup', async () => {
    const canli = await grupEkle(kokGrup);
    const silinmis = await grupEkle(kokGrup, true);
    expect(await sor((s, i) => s.grupCanliMi(i, canli))).toBe(true);
    expect(await sor((s, i) => s.grupCanliMi(i, silinmis))).toBe(false);
  });
});

describe('bu rol canlı mı', () => {
  it('evet: silinmemiş rol; hayır: silinmiş rol', async () => {
    const canli = await rolEkle();
    const silinmis = await rolEkle(true);
    expect(await sor((s, i) => s.rolCanliMi(i, canli))).toBe(true);
    expect(await sor((s, i) => s.rolCanliMi(i, silinmis))).toBe(false);
  });
});

describe('bu (grup, rol) kümesi (Kök, SuperAdmin) mi', () => {
  it('evet: (Kök, SuperAdmin); hayır: (Kök, Temel) ve (alt grup, SuperAdmin)', async () => {
    const altGrup = await grupEkle(kokGrup);
    expect(
      await sor((s, i) => s.kokSuperAdminKumesiMi(i, kokGrup, superadminRol)),
    ).toBe(true);
    expect(
      await sor((s, i) => s.kokSuperAdminKumesiMi(i, kokGrup, temelRol)),
    ).toBe(false);
    expect(
      await sor((s, i) => s.kokSuperAdminKumesiMi(i, altGrup, superadminRol)),
    ).toBe(false);
  });
});

describe('bu grup boş mu', () => {
  it('evet: yeni grup', async () => {
    const grup = await grupEkle(kokGrup);
    expect(await sor((s, i) => s.grupBosMu(i, grup))).toBe(true);
  });

  it('hayır: canlı alt grubu, canlı üyeliği ya da canlı yeteneği olan grup', async () => {
    const altGruplu = await grupEkle(kokGrup);
    await grupEkle(altGruplu);
    const uyelikli = await grupEkle(kokGrup);
    await uyelikEkle(ortam.superadmin.id, uyelikli, temelRol);
    const yetenekli = await grupEkle(kokGrup);
    await yetenekEkle(yetenekli, temelRol);
    for (const grup of [altGruplu, uyelikli, yetenekli]) {
      expect(await sor((s, i) => s.grupBosMu(i, grup))).toBe(false);
    }
  });

  it('evet: silinmiş alt grup, silinmiş üyelik ve silinmiş yetenek grubu dolu yapmaz', async () => {
    const grup = await grupEkle(kokGrup);
    await grupEkle(grup, true);
    await uyelikEkle(ortam.superadmin.id, grup, temelRol, true);
    await yetenekEkle(grup, temelRol, true);
    expect(await sor((s, i) => s.grupBosMu(i, grup))).toBe(true);
  });
});

describe('bu rol boş mu', () => {
  it('evet: yeni rol; silinmiş üyelik ve silinmiş yetenek rolü dolu yapmaz', async () => {
    const yeni = await rolEkle();
    const silinmisli = await rolEkle();
    await uyelikEkle(ortam.superadmin.id, kokGrup, silinmisli, true);
    await yetenekEkle(kokGrup, silinmisli, true);
    expect(await sor((s, i) => s.rolBosMu(i, yeni))).toBe(true);
    expect(await sor((s, i) => s.rolBosMu(i, silinmisli))).toBe(true);
  });

  it('hayır: canlı üyeliği ya da canlı yeteneği olan rol', async () => {
    const uyelikli = await rolEkle();
    await uyelikEkle(ortam.superadmin.id, kokGrup, uyelikli);
    const yetenekli = await rolEkle();
    await yetenekEkle(kokGrup, yetenekli);
    for (const rol of [uyelikli, yetenekli]) {
      expect(await sor((s, i) => s.rolBosMu(i, rol))).toBe(false);
    }
  });
});

describe('şu grubu şu grubun altına taşımak döngü yapar mı', () => {
  // Kök → üst → taşınan → çocuk → torun; üst → kardeş.
  let ust: string;
  let tasinan: string;
  let cocuk: string;
  let torun: string;
  let kardes: string;

  beforeAll(async () => {
    ust = await grupEkle(kokGrup);
    tasinan = await grupEkle(ust);
    cocuk = await grupEkle(tasinan);
    torun = await grupEkle(cocuk);
    kardes = await grupEkle(ust);
  });

  it('evet: kendisinin, çocuğunun ve torununun altına', async () => {
    for (const hedef of [tasinan, cocuk, torun]) {
      expect(await sor((s, i) => s.tasimaDonguYaparMi(i, tasinan, hedef))).toBe(
        true,
      );
    }
  });

  it('hayır: kardeşinin, kendi üstünün ve kökün altına', async () => {
    for (const hedef of [kardes, ust, kokGrup]) {
      expect(await sor((s, i) => s.tasimaDonguYaparMi(i, tasinan, hedef))).toBe(
        false,
      );
    }
  });
});

describe('sorular isteyenin yeteneğinden bağımsızdır', () => {
  it('yetkisi olmayan oturumsuz isteğin içinde de doğru cevap verir', async () => {
    // Kişinin tek üyeliği (Kök, Temel) kapatılır: derlenmiş kuralı kalmaz. Kişi henüz oturumlu istek
    // yapmadığı için yetki belleğinde eski kaydı yoktur.
    const yeteneksiz = await ortam.kullaniciAc(yeniAd());
    await ortam.db.query(
      'update uyelik set silinme_zamani = clock_timestamp() where kullanici_id = $1',
      [yeteneksiz.id],
    );
    const yetkilerim = await request(ortam.app.getHttpServer())
      .get('/kimlik/oturum/yetkilerim')
      .set(ortam.basliklar(yeteneksiz.erisimBelirteci));
    expect(yetkilerim.status).toBe(200);
    expect(yetkilerim.body).toEqual({ kurallar: [] });

    // Yetki kapısından okunsaydı bu kişi hiçbir satırı göremez: dolu grubu boş, canlı grubu ve rolü
    // ölü, superadmin'i SuperAdmin değil görürdü.
    const dolu = await grupEkle(kokGrup);
    await grupEkle(dolu);
    await uyelikEkle(ortam.superadmin.id, dolu, temelRol);
    const bos = await grupEkle(kokGrup);
    const silinmisGrup = await grupEkle(kokGrup, true);
    istekteSorulacak = async (s, i) => ({
      superadminKokSuperAdmin: await s.kokSuperAdminUyesiMi(
        i,
        ortam.superadmin.id,
      ),
      yeteneksizKokSuperAdmin: await s.kokSuperAdminUyesiMi(i, yeteneksiz.id),
      superadminSonGirebilen: await s.sonGirebilenKokSuperAdminMi(
        i,
        ortam.superadmin.id,
      ),
      doluCanli: await s.grupCanliMi(i, dolu),
      silinmisCanli: await s.grupCanliMi(i, silinmisGrup),
      temelCanli: await s.rolCanliMi(i, temelRol),
      kokSuperAdminKumesi: await s.kokSuperAdminKumesiMi(
        i,
        kokGrup,
        superadminRol,
      ),
      doluBos: await s.grupBosMu(i, dolu),
      bosBos: await s.grupBosMu(i, bos),
      temelBos: await s.rolBosMu(i, temelRol),
      kokuDoluyaTasimakDongu: await s.tasimaDonguYaparMi(i, kokGrup, dolu),
      bosuDoluyaTasimakDongu: await s.tasimaDonguYaparMi(i, bos, dolu),
    });
    try {
      // Oturumsuz istek: bağlamda derlenmiş yetki hiç yoktur.
      const cevap = await request(ortam.app.getHttpServer()).get(
        '/butunluk-sinama/sor',
      );
      expect(cevap.status).toBe(200);
      expect(cevap.body).toEqual({
        kuralSayisi: -1,
        cevaplar: {
          superadminKokSuperAdmin: true,
          yeteneksizKokSuperAdmin: false,
          superadminSonGirebilen: true,
          doluCanli: true,
          silinmisCanli: false,
          temelCanli: true,
          kokSuperAdminKumesi: true,
          doluBos: false,
          bosBos: true,
          temelBos: false,
          kokuDoluyaTasimakDongu: true,
          bosuDoluyaTasimakDongu: false,
        },
      });
    } finally {
      istekteSorulacak = undefined;
    }
  });
});
