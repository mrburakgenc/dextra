import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const backendDir = fileURLToPath(new URL('..', import.meta.url));

export interface Derleme {
  // Derlenmiş modüllerin klasörü; main.js, kurulum.js ve tohum.js doğrudan altındadır.
  readonly klasor: string;
  // Klasörü siler; test bitince çağrılır.
  sil(): Promise<void>;
}

// Uygulamayı, `nest build`ün kullandığı yapı ayarıyla (tsconfig.build.json), bu çağrıya özgü geçici
// bir klasöre derler. Testler ortak dist/ klasörüne derlemez: yan yana koşan test dosyaları
// birbirinin çıktısını silemez (TS-002 AK-32).
// Klasör backend altında açılır: derlenmiş modüller paketleri backend/node_modules'tan, ES modülü
// olduklarını backend/package.json'dan bulur. Artımlı derleme kapalıdır; açıkken derleyici kayıt
// dosyasını geçici klasörün dışına, bütün derlemelerin ortak yoluna (backend/) yazar.
export async function derle(): Promise<Derleme> {
  const klasor = await mkdtemp(join(backendDir, '.test-derleme-'));
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
