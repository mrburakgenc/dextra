import { RepoBelirteci } from '../../database/domain/repo-belirteci.js';

export interface TohumGocuRepo {
  // Göçün adını deftere yazar; ad zaten yazılıysa hiçbir şey yazmaz ve false döner. Aynı adı yazan
  // ve henüz bitmemiş başka bir işlem varsa onun bitmesini bekler: o onaylanırsa false, geri
  // alınırsa bu çağrı yazar ve true döner.
  yaz(ad: string): Promise<boolean>;
}

// Defter yalnız run içinde kullanılır; işlem dışı okuma görünümü boştur (unknown).
export const TOHUM_GOCU_REPO = new RepoBelirteci<unknown, TohumGocuRepo>(
  'TohumGocuRepo',
);
