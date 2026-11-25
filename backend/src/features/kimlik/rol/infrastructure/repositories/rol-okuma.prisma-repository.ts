// IRolOkumaRepo'nun gerçeklemesi: rol ve izin kayıtlarını işlemin istemcisiyle, yetki kapısının
// okuma yüzünden okur.
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/okuma-kapisi.js';
import type { IRolOkumaRepo } from '../../domain/repositories/i-rol.repository.js';

export function rolOkumaPrismaRepository(
  istemci: RepoIstemcisi,
  kapi: OkumaKapisi,
): IRolOkumaRepo {
  return {
    roller: (siralama, sayfa) =>
      kapi.liste(istemci, 'Rol', { siralama, sayfa, yalnizCanli: true }),
    rol: (id) => kapi.tek(istemci, 'Rol', id),
    izinler: (siralama, sayfa) =>
      kapi.liste(istemci, 'Izin', { siralama, sayfa }),
  };
}
