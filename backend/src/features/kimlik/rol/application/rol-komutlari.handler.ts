import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import { RolYazici } from '../domain/rol-yazici.port.js';

// İşlerin adları; değişiklik kaydı notunun işin adı alanına yazılır.
const OLUSTUR = 'kimlik:rol-olustur';
const AD_DEGISTIR = 'kimlik:rol-adini-degistir';
const SIL = 'kimlik:rol-sil';

// Rol oluşturma, adını değiştirme ve silme (TS-002 "İşlem sınırları": rol yaz, sil; KR-008 Seçim 15
// ve 22). Her iş tek run'dır ve önce genel sayaç satırını kilitleyip artırır (kilit sırasının ilk
// halkası), sonra rolün satırına yetki kapısından yazar. Hata bütün işi geri alır; sayaç da artmaz.
@Injectable()
export class RolKomutlariHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly yazici: RolYazici,
  ) {}

  olustur(ad: string): Promise<string> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      return this.yazici.olustur(islem, OLUSTUR, ad);
    });
  }

  // Silinmiş rolün adı değişmez (TS-002 "Durum geçişleri"; AK-43): yazma kapısının güncellemesi
  // silinme zamanını süzmediği için canlılık bütünlük sorusuyla, sayaç kilidinin altında sorulur.
  async adDegistir(id: string, ad: string): Promise<void> {
    await this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      if (!(await this.butunluk.rolCanliMi(islem, id))) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      await this.yazici.adDegistir(islem, AD_DEGISTIR, id, ad);
    });
  }

  // Yalnız boş rol silinir. Boşluk, kapı rolü sildikten sonra sorulur: isteyenin silemediği
  // (görmediği) rol böylece dolu olsa da cakisma değil bulunamadi alır (TS-002 AK-39). Sistem rolleri
  // hiçbir zaman boş olmadığı için bu denetimle silinemez. Dolu rolde hata yazmayı ve notu geri alır.
  async sil(id: string): Promise<void> {
    await this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      await this.yazici.sil(islem, SIL, id);
      if (!(await this.butunluk.rolBosMu(islem, id))) {
        throw new KodluHata(
          'cakisma',
          'Rolün canlı üyeliği ya da yeteneği var; silinemez',
        );
      }
    });
  }
}
