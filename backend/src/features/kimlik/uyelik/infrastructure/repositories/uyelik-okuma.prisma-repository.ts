// IUyelikOkumaRepo'nun gerçeklemesi: üyelik kayıtlarını işlemin istemcisiyle, yetki kapısının okuma
// yüzünden okur.
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import type { KosulOgesi } from '../../../../../shared/yetki/application/sart-cevirici.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IUyelikOkumaRepo } from '../../domain/repositories/i-uyelik.repository.js';

const KAYNAK = 'Uyelik';

// Canlılık süzgecini kapı uygular (TS-002 AK-42); kişinin verdiği süzgeçler çağıranın koşuludur.
export function uyelikOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IUyelikOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ kullaniciId, grupId, rolId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul: (
          [
            ['kullaniciId', kullaniciId],
            ['grupId', grupId],
            ['rolId', rolId],
          ] as const
        ).flatMap(([alan, deger]): KosulOgesi[] =>
          deger === undefined ? [] : [{ alan, islec: 'esit', deger }],
        ),
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
        yalnizCanli: true,
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
