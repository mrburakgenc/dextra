import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import type { KullaniciOkumaRepo } from '../domain/kullanici.repository.js';

const KAYNAK = 'Kullanici';

export function kullaniciPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<KullaniciOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ pasif, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul:
          pasif === undefined
            ? []
            : [{ alan: 'pasifZamani', islec: pasif ? 'dolu' : 'bos' }],
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
