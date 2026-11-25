import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
// Geçici klasörlerin yeri: git'in ve lint'in zaten yok saydığı backend/node_modules altı. Test
// yarıda kesilip klasör kalırsa çalışma ağacı kirlenmez (TS-002 AK-32).
export const DERLEME_YERI = join(backendDir, 'node_modules', '.cache');
export const DERLEME_ONEKI = 'test-derleme-';
// Bundan eski kendi önekli klasör yarıda kalmış bir testindir; yan yana koşan testin klasörü bu
// kadar eskimez.
export const BAYAT_KLASOR_MS = 60 * 60 * 1000;

// Yarıda kalmış testlerden kalan, kendi önekini taşıyan ve bir saatten eski klasörleri siler.
async function bayatlariSil(): Promise<void> {
  const sinir = Date.now() - BAYAT_KLASOR_MS;
  for (const ad of await readdir(DERLEME_YERI)) {
    if (!ad.startsWith(DERLEME_ONEKI)) {
      continue;
    }
    const yol = join(DERLEME_YERI, ad);
    // Yan yana başlayan başka bir derleme aynı bayat klasörü az önce silmiş olabilir.
    const bilgi = await stat(yol).catch(() => undefined);
    if (bilgi !== undefined && bilgi.mtimeMs < sinir) {
      await rm(yol, { recursive: true, force: true });
    }
  }
}

export interface Derleme {
  // Derlenmiş modüllerin klasörü; main.js, kurulum.js ve tohum.js doğrudan altındadır.
  readonly klasor: string;
  // Klasörü siler; test bitince çağrılır.
  sil(): Promise<void>;
}

// Uygulamayı, `nest build`ün kullandığı yapı ayarıyla (tsconfig.build.json), bu çağrıya özgü geçici
// bir klasöre derler. Testler ortak dist/ klasörüne derlemez: yan yana koşan test dosyaları
// birbirinin çıktısını silemez (TS-002 AK-32).
// Klasör backend/node_modules/.cache altında açılır: derlenmiş modüller paketleri yukarı doğru
// arayarak backend/node_modules'ta bulur. Node paket kapsamını ararken node_modules'ta durduğundan
// backend/package.json'daki "type": "module" buraya uzanmaz; modüller ES modülü olarak Node'un
// sözdizimi algılamasıyla yüklenir (Node 24'te varsayılan açık; kök package.json engines >=24.15).
// Artımlı derleme kapalıdır; açıkken derleyici kayıt dosyasını geçici klasörün dışına, bütün
// derlemelerin ortak yoluna (backend/) yazar.
export async function derle(): Promise<Derleme> {
  await mkdir(DERLEME_YERI, { recursive: true });
  await bayatlariSil();
  const klasor = await mkdtemp(join(DERLEME_YERI, DERLEME_ONEKI));
  const derleme: Derleme = {
    klasor,
    sil: () => rm(klasor, { recursive: true, force: true }),
  };
  try {
    await promisify(execFile)(
      `${backendDir}node_modules/.bin/tsc`,
      [
        '-p',
        'tsconfig.build.json',
        '--outDir',
        klasor,
        '--incremental',
        'false',
      ],
      { cwd: backendDir },
    );
  } catch (error) {
    // Derleme başarısız olursa yarım klasör geride kalmaz.
    await derleme.sil();
    throw error;
  }
  return derleme;
}
