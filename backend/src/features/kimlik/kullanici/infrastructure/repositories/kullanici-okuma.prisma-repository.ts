// IKullaniciOkumaRepo'nun gerçeklemesi: kullanıcı kayıtlarını işlemin istemcisiyle, yetki kapısının
// okuma yüzünden okur.
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IKullaniciOkumaRepo } from '../../domain/repositories/i-kullanici.repository.js';

const KAYNAK = 'Kullanici';

export function kullaniciOkumaPrismaRepository(
  istemci: RepoIstemcisi,
  kapi: OkumaKapisi,
): IKullaniciOkumaRepo {
  return {
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
  };
}
