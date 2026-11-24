// Yerel deneme (GV-049): uygulamanın tamamını kalıcı hiçbir şeye dokunmadan açar.
// Kullanım: node scripts/yerel-deneme.mjs (ayrıntı: docs/yerel-deneme.md).
// Geçici asıl ve iz veritabanlarını açar, göçleri uygular, anahtar çiftini ve aracı katman sırrını
// bellekte üretir, backend'i derleyip tohum ve kurulum komutlarını koşturur, backend'i 3001'de,
// derlenmiş ön yüzü 3100'de başlatır. Ctrl-C ya da SIGTERM gelince süreçleri kapatır ve geçici
// veritabanlarını siler. Anahtar ve sır yalnız alt süreçlerin ortamına verilir: diske yazılmaz,
// ekrana basılmaz.
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { setTimeout as bekle } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
// Yönetim bağlantısının adresi testlerin okuduğu yerden gelir (Node tür bilgisini atarak yükler).
import { localInfrastructure } from '../backend/test/local-infrastructure.ts';

const backendDir = fileURLToPath(new URL('../backend/', import.meta.url));
const frontendDir = fileURLToPath(new URL('../frontend/', import.meta.url));
const prisma = `${backendDir}node_modules/.bin/prisma`;
const next = `${frontendDir}node_modules/next/dist/bin/next`;
const BACKEND_ADRESI = 'http://localhost:3001';
const ONYUZ_ADRESI = 'http://localhost:3100';
// İlk yöneticinin kullanıcı adı kimlik kurulum göçünde tanımlıdır
// (backend/src/features/kimlik/_shared/tohum/kimlik-kurulum.goc.ts).
const ILK_YONETICI = 'superadmin';

const cocuklar = new Set();
const veritabanlari = [];
let kapanis;

function yaz(ileti) {
  process.stdout.write(`[yerel-deneme] ${ileti}\n`);
}

// Alt süreç kendi süreç grubunda koşar (detached): terminalin Ctrl-C'si yalnız bu betiğe gelir,
// kapanış sırasını betik belirler ve süreç, açtığı alt süreçlerle birlikte durdurulur.
function baslat(komut, args, { cwd, env = {}, stdio }) {
  const cocuk = spawn(komut, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio,
  });
  const bitti = new Promise((resolve) => {
    cocuk.on('error', (hata) => resolve({ hata }));
    cocuk.on('close', (kod, sinyal) => resolve({ kod, sinyal }));
  });
  const kayit = { cocuk, bitti };
  cocuklar.add(kayit);
  void bitti.then(() => cocuklar.delete(kayit));
  return kayit;
}

function neden({ kod, sinyal, hata }) {
  return hata?.message ?? (sinyal === null ? `çıkış kodu ${kod}` : sinyal);
}

// Biten bir komutu koşturur; çıktısını yalnız hata verirse gösterir. Standart çıktıyı döndürür.
async function kos(ad, komut, args, { cwd, env, girdi = '' }) {
  const { cocuk, bitti } = baslat(komut, args, { cwd, env, stdio: 'pipe' });
  let cikti = '';
  let hataCiktisi = '';
  cocuk.stdout.on('data', (parca) => (cikti += parca));
  cocuk.stderr.on('data', (parca) => (hataCiktisi += parca));
  cocuk.stdin.end(girdi);
  const sonuc = await bitti;
  if (sonuc.hata !== undefined || sonuc.kod !== 0) {
    throw new Error(`${ad} başarısız (${neden(sonuc)}):\n${cikti}${hataCiktisi}`);
  }
  return cikti;
}

// Yönetim bağlantısı testlerinki gibi asıl veritabanının adresiyle kurulur ve yalnız sunucu
// düzeyinde komut (CREATE/DROP DATABASE) verir; dextra ve dextra_iz içine bir şey yazılmaz.
function sunucuda(sql) {
  return kos('Yönetim komutu', prisma, ['db', 'execute', '--stdin'], {
    cwd: backendDir,
    env: { DATABASE_URL: localInfrastructure.databaseUrl },
    girdi: sql,
  });
}

function veritabaniAdresi(ad) {
  const adres = new URL(localInfrastructure.databaseUrl);
  adres.pathname = `/${ad}`;
  return adres.toString();
}

async function adim(ad, is) {
  const baslangic = performance.now();
  const sonuc = await is();
  const sure = (performance.now() - baslangic) / 1000;
  yaz(`${ad} (${sure.toFixed(1)} sn)`);
  return sonuc;
}

// Uzun koşan sunucu; açılışta ya da hazırken beklenmedik biçimde durursa her şey kapanır.
function sunucu(ad, args, cwd, env) {
  const { bitti } = baslat(process.execPath, args, {
    cwd,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  void bitti.then((sonuc) => {
    if (kapanis !== undefined) return;
    process.stderr.write(
      `[yerel-deneme] ${ad} beklenmedik biçimde durdu (${neden(sonuc)})\n`,
    );
    void kapat(1);
  });
}

async function cevapVerir(adres) {
  const son = Date.now() + 60_000;
  while (Date.now() < son) {
    try {
      if ((await fetch(adres)).ok) return;
    } catch {
      // Henüz dinlemiyor.
    }
    await bekle(500);
  }
  throw new Error(`${adres} 60 sn içinde cevap vermedi`);
}

function grubaGonder(cocuk, sinyal) {
  try {
    process.kill(-cocuk.pid, sinyal);
  } catch {
    // Grup zaten kapanmış.
  }
}

// Bir kez koşar; ilk çağıranın kodu geçerlidir. Süreçler önce SIGTERM ile, 10 sn içinde
// kapanmayan kalırsa SIGKILL ile durdurulur; sonra iki geçici veritabanı silinir.
function kapat(kod) {
  kapanis ??= (async () => {
    yaz('Kapanıyor…');
    const acik = [...cocuklar];
    for (const { cocuk } of acik) grubaGonder(cocuk, 'SIGTERM');
    await Promise.race([Promise.all(acik.map((c) => c.bitti)), bekle(10_000)]);
    for (const { cocuk } of acik) grubaGonder(cocuk, 'SIGKILL');
    await Promise.all(acik.map((c) => c.bitti));

    let cikisKodu = kod;
    for (const ad of veritabanlari) {
      try {
        // Açık kalmış bağlantılar silmeyi engellemesin diye FORCE kullanılır.
        await sunucuda(`DROP DATABASE IF EXISTS ${ad} WITH (FORCE)`);
        yaz(`Silindi: ${ad}`);
      } catch (hata) {
        process.stderr.write(`[yerel-deneme] ${ad} silinemedi: ${hata.message}\n`);
        cikisKodu = 1;
      }
    }
    process.stdout.write('', () => process.exit(cikisKodu));
  })();
  return kapanis;
}

async function ac() {
  const ek = randomBytes(6).toString('hex');
  const asil = `dextra_test_yerel_asil_${ek}`;
  const iz = `dextra_test_yerel_iz_${ek}`;

  await adim(`1. Geçici veritabanları açıldı: ${asil}, ${iz}`, async () => {
    for (const ad of [asil, iz]) {
      veritabanlari.push(ad);
      await sunucuda(`CREATE DATABASE ${ad}`);
    }
  });

  await adim('2. Asıl ve iz şemalarının göçleri uygulandı', () =>
    Promise.all([
      kos('Asıl göçler', prisma, ['migrate', 'deploy'], {
        cwd: backendDir,
        env: { DATABASE_URL: veritabaniAdresi(asil) },
      }),
      kos(
        'İz göçleri',
        prisma,
        ['migrate', 'deploy', '--config', 'prisma.iz.config.ts'],
        { cwd: backendDir, env: { IZ_DATABASE_URL: veritabaniAdresi(iz) } },
      ),
    ]),
  );

  // Değişken adları: backend/src/shared/guvenlik/belirtec.ts ve istemci-adresi-imzasi.ts.
  const sir = await adim('3. Anahtar çifti ve aracı katman sırrı üretildi (yalnız bellekte)', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return {
      KIMLIK_IMZA_OZEL_ANAHTAR: privateKey,
      KIMLIK_IMZA_ACIK_ANAHTAR: publicKey,
      ARACI_KATMAN_SIRRI: randomBytes(32).toString('base64url'),
    };
  });
  const backendOrtami = {
    ...sir,
    DATABASE_URL: veritabaniAdresi(asil),
    IZ_DATABASE_URL: veritabaniAdresi(iz),
    PORT: '3001',
  };

  await adim('4a. Backend derlendi (Prisma istemcisi dahil)', async () => {
    await kos('Prisma istemcisi üretimi', 'pnpm', ['run', 'prisma:generate'], {
      cwd: backendDir,
    });
    await kos('Backend derlemesi', 'pnpm', ['run', 'build'], { cwd: backendDir });
  });
  await adim('4b. Tohum komutu koştu', () =>
    kos('Tohum komutu', 'pnpm', ['run', 'tohum'], {
      cwd: backendDir,
      env: backendOrtami,
    }),
  );
  const kurulumCiktisi = await adim('4c. Kurulum komutu koştu', () =>
    kos('Kurulum komutu', 'pnpm', ['run', 'kurulum'], {
      cwd: backendDir,
      env: backendOrtami,
    }),
  );
  const kod = /bağlantısı kodu[^\n]*:\n(\S+)/.exec(kurulumCiktisi)?.[1];
  if (kod === undefined) {
    throw new Error('Kurulum komutunun çıktısında kod bulunamadı');
  }
  yaz(`İlk yöneticinin kullanıcı adı: ${ILK_YONETICI}`);
  yaz(
    `Parola belirleme adresi (kod yalnız bu geçici veritabanı içindir): ${ONYUZ_ADRESI}/parola-belirle?kod=${encodeURIComponent(kod)}`,
  );

  await adim('5a. Ön yüz derlendi', () =>
    kos('Ön yüz derlemesi', 'pnpm', ['run', 'build'], { cwd: frontendDir }),
  );
  sunucu('Backend', ['dist/main.js'], backendDir, backendOrtami);
  sunucu('Ön yüz', [next, 'start', '--port', '3100'], frontendDir, {
    NEXT_TELEMETRY_DISABLED: '1',
    BACKEND_ADRESI,
    ARACI_KATMAN_SIRRI: sir.ARACI_KATMAN_SIRRI,
  });
  await adim('5b. Backend ve ön yüz başlatıldı, ikisi de cevap veriyor', () =>
    Promise.all([
      cevapVerir(`${BACKEND_ADRESI}/health`),
      cevapVerir(`${ONYUZ_ADRESI}/giris`),
    ]),
  );
  yaz(`hazır — ön yüz: ${ONYUZ_ADRESI}  backend: ${BACKEND_ADRESI}  (kapatmak için Ctrl-C)`);
}

process.on('SIGINT', () => void kapat(0));
process.on('SIGTERM', () => void kapat(0));
try {
  await ac();
} catch (hata) {
  if (kapanis === undefined) {
    process.stderr.write(`[yerel-deneme] Açılış başarısız: ${hata.message}\n`);
  }
  await kapat(1);
}
