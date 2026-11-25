import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../shared/database/domain/islem.js';
import { YETKI_SURUMU_CEKIRDEK_REPO } from '../domain/repositories/i-yetki-surumu-cekirdek.repository.js';

// Çekirdek parça "genel sayaç" (TS-002 "Yapı"): genel sayaç satırını anahtar dışı güncelleme
// kilidiyle kilitler, istenirse bir artırır; satır yoksa hata verir. Kilit sırasının ilk halkasıdır:
// genel sayaç, sonra kişi, sonra öbürleri. Kendi işlemini açmaz; çağıranın işleminde çalışır.
@Injectable()
export class GenelSayac {
  async kilitle(islem: Islem, { artir }: { artir: boolean }): Promise<void> {
    await islem.repo(YETKI_SURUMU_CEKIRDEK_REPO).kilitle(artir);
  }
}
