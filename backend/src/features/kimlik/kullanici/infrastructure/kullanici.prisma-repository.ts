import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { SabitDeger } from '../../../../shared/kimlik/yetki-verisi.contract.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import type { KullaniciOkumaRepo } from '../domain/kullanici.repository.js';

const KAYNAK = 'Kullanici';

// Kapının koşul dili boş değeri tipte taşımaz (SabitDeger); çevirici değeri olduğu gibi Prisma'ya
// verir ve Prisma "equals: null"u IS NULL, "not: null"u IS NOT NULL yapar. Pasif süzgeci bununla
// yazılır; davranışı kimlik-kullanici-oku testi sınar.
const BOS = null as unknown as SabitDeger;

export function kullaniciPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<KullaniciOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ pasif, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul:
          pasif === undefined
            ? []
            : [
                {
                  alan: 'pasifZamani',
                  islec: pasif ? 'esit_degil' : 'esit',
                  deger: BOS,
                },
              ],
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
