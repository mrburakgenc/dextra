// Çekirdek repository: göçten önceki yasak taraması için canlı yasak satırlarını yetki kapısından
// geçmeden okur (KR-010 Seçim 48 eki; TS-008 kapanan AU-36). Yalnız okur, başka hiçbir şey yapmaz;
// yalnız tarama komutunun uygulama parçası (application/yasak-taramasi.ts) kullanır. Gerçeklemesi
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';
import type { SaklananYetenek } from './i-yetki-verisi.repository.js';

// Saklandığı gibi okunan yasak: şartın biçimi henüz doğrulanmamıştır.
export type SaklananYasak = Omit<SaklananYetenek, 'sistemSatiri'>;

export interface YasakTaramaCekirdekRepo {
  // Silinmemiş yasaklar (giremez), kimliğe göre sıralı. Yetenek tablosu ya da tabloda iki kolon
  // (giremez, oncelik) yoksa (hiç göç uygulanmamış ya da TS-008 birinci aşamanın göçünden önceki
  // veritabanı) undefined.
  canliYasaklar(): Promise<SaklananYasak[] | undefined>;
}

export const YASAK_TARAMA_CEKIRDEK_REPO = new RepoBelirteci<
  YasakTaramaCekirdekRepo,
  YasakTaramaCekirdekRepo
>('YasakTaramaCekirdekRepo');
