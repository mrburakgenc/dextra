// Rol oluştur işinin işleyicisi (TS-002 "İşlem sınırları": rol yaz; KR-008 Seçim 15 ve 22).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { GenelSayac } from '../../../../_shared/genel-sayac.js';
import { rolOlustur } from '../../../domain/entities/rol.entity.js';
import {
  type IRolYazmaRepo,
  ROL_YAZMA_REPO,
} from '../../../domain/repositories/i-rol.repository.js';
import type { RolOlusturKomutu } from './rol-olustur.command.js';
import type { RolOlusturSonucu } from './rol-olustur.result.js';

// İşin adı; değişiklik kaydı notunun işin adı alanına yazılır.
const IS_ADI = 'kimlik:rol-olustur';

// Tek run'dır: önce genel sayaç satırı kilitlenip artırılır (kilit sırasının ilk halkası), sonra rol
// yetki kapısından yazılır. Hata bütün işi geri alır; sayaç da artmaz.
@Injectable()
export class RolOlusturHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    @Inject(ROL_YAZMA_REPO) private readonly yazma: IRolYazmaRepo,
  ) {}

  calistir(komut: RolOlusturKomutu): Promise<RolOlusturSonucu> {
    const rol = rolOlustur(komut.ad);
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      return { id: await this.yazma.olustur(islem, IS_ADI, rol) };
    });
  }
}
