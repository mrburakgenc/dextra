// IGrupOkumaRepo'nun gerçeklemesi: grup kayıtlarını işlemin istemcisiyle, yetki kapısının okuma
// yüzünden okur.
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IGrupOkumaRepo } from '../../domain/repositories/i-grup.repository.js';

const KAYNAK = 'Grup';

// Liste düzdür: her kayıt ustGrupId taşır, ağacı ekran kurar. Liste yalnız canlı kayıtları verir;
// süzgeci kapı uygular, kişinin baktığı kolonlara girmez (TS-002 AK-42). Tek kayıt süzülmez.
export function grupOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IGrupOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ ustGrupId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul:
          ustGrupId === undefined
            ? []
            : [{ alan: 'ustGrupId', islec: 'esit', deger: ustGrupId }],
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
        yalnizCanli: true,
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
