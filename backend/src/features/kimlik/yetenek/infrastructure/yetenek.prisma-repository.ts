import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { KosulOgesi } from '../../../../shared/yetki/sart-cevirici.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import type { YetenekOkumaRepo } from '../domain/yetenek.repository.js';

const KAYNAK = 'Yetenek';

// Canlılık süzgecini kapı uygular (TS-002 AK-42): silinme zamanını göremeyen yetenek de listeye
// katılır. Kimlik süzgeçleri çağıranın koşuludur; baktıkları kolonu göremeyen yetenek katılmaz.
export function yetenekPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<YetenekOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ grupId, rolId, izinId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul: Object.entries({ grupId, rolId, izinId }).flatMap(
          ([alan, deger]): KosulOgesi[] =>
            deger === undefined ? [] : [{ alan, islec: 'esit', deger }],
        ),
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
        yalnizCanli: true,
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
