import type { RepoIstemcisi } from '../../../../shared/database/registrar.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import type { RolOkumaRepo } from '../domain/rol.repository.js';

export function rolPrismaRepository(
  istemci: RepoIstemcisi,
  kapi: OkumaKapisi,
): RolOkumaRepo {
  return {
    roller: (siralama, sayfa) =>
      kapi.liste(istemci, 'Rol', { siralama, sayfa }),
    rol: (id) => kapi.tek(istemci, 'Rol', id),
    izinler: (siralama, sayfa) =>
      kapi.liste(istemci, 'Izin', { siralama, sayfa }),
  };
}
