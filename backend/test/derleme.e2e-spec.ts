// Test derleme klasörünün yeri ve yarıda kalmış klasörlerin temizliği (TS-002 AK-32). Koşturma:
//   pnpm -C backend test:e2e test/derleme.e2e-spec.ts --reporter=verbose
// Derlemeden önce derleme yerine üç klasör konur: bir saatten eski ve kendi önekini taşıyan (yarıda
// kalmış bir test), yeni ve kendi önekini taşıyan (yan yana koşan bir test) ve bir saatten eski ama
// başka önekli olan. Derleme yalnız ilkini siler.
import { mkdir, mkdtemp, rm, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BAYAT_KLASOR_MS,
  DERLEME_ONEKI,
  DERLEME_YERI,
  derle,
} from './derleme.js';

it('derleme klasörü backend/node_modules/.cache altında açılır; bir saatten eski kendi önekli klasör silinir, yenisine ve başka önekliye dokunulmaz', async () => {
  await mkdir(DERLEME_YERI, { recursive: true });
  const eskiZaman = new Date(Date.now() - BAYAT_KLASOR_MS - 60_000);
  const eski = await mkdtemp(join(DERLEME_YERI, DERLEME_ONEKI));
  await utimes(eski, eskiZaman, eskiZaman);
  const yeni = await mkdtemp(join(DERLEME_YERI, DERLEME_ONEKI));
  const baskasi = await mkdtemp(join(DERLEME_YERI, 'baska-'));
  await utimes(baskasi, eskiZaman, eskiZaman);
  try {
    const derleme = await derle();
    try {
      expect(derleme.klasor.startsWith(join(DERLEME_YERI, DERLEME_ONEKI))).toBe(
        true,
      );
      expect((await stat(join(derleme.klasor, 'main.js'))).isFile()).toBe(true);
    } finally {
      await derleme.sil();
    }
    await expect(stat(eski)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await stat(yeni)).isDirectory()).toBe(true);
    expect((await stat(baskasi)).isDirectory()).toBe(true);
  } finally {
    for (const klasor of [eski, yeni, baskasi]) {
      await rm(klasor, { recursive: true, force: true });
    }
  }
}, 60_000);
