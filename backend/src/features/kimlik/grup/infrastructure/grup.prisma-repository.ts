import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import type { GrupOkumaRepo } from '../domain/grup.repository.js';

const KAYNAK = 'Grup';

// Liste düzdür: her kayıt ustGrupId taşır, ağacı ekran kurar. Canlılık süzgeci burada yazılmaz
// (TS-002 AK-42): kapıya "yalnız canlı kayıtlar" seçeneğini ayrı bir görev ekler.
export function grupPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<GrupOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ ustGrupId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul:
          ustGrupId === undefined
            ? []
            : [{ alan: 'ustGrupId', islec: 'esit', deger: ustGrupId }],
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
