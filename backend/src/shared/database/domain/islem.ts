import type { RepoBelirteci } from './repo-belirteci.js';

// Çağrı başına örnek; yalnız run verir ve tam arayüz yalnız buradan alınır.
export interface Islem {
  repo<TOkuma, TTam extends TOkuma>(
    belirtec: RepoBelirteci<TOkuma, TTam>,
  ): TTam;
}
