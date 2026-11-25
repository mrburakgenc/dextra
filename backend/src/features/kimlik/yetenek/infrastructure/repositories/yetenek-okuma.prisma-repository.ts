// IYetenekRepo'nun gerçeklemesi: yetenek ve izin kayıtlarını işlemin istemcisiyle, yetki kapısının
// okuma yüzünden okur.
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { KosulOgesi } from '../../../../../shared/yetki/application/sart-cevirici.js';
import type { IYetenekRepo } from '../../domain/repositories/i-yetenek.repository.js';

const KAYNAK = 'Yetenek';

// Canlılık süzgecini kapı uygular (TS-002 AK-42): silinme zamanını göremeyen yetenek de listeye
// katılır. Kimlik süzgeçleri çağıranın koşuludur; baktıkları kolonu göremeyen yetenek katılmaz.
export function yetenekOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IYetenekRepo> {
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
    // Kimliğe göre süzme her okuma kuralında serbesttir (AK-38).
    izin: async (id) =>
      (
        await kapi.liste(istemci, 'Izin', {
          kosul: [{ alan: 'id', islec: 'esit', deger: id }],
        })
      )[0],
  });
}
