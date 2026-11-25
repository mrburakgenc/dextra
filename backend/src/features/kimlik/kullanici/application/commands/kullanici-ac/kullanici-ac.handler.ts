// Kullanıcı aç işinin işleyicisi (TS-002 "İşlem sınırları"; KR-008 Seçim 31).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/http/istek-baglami.js';
import { ParolaBaglantisi } from '../../../../_shared/application/parola-baglantisi.js';
import type { IzBilgisi } from '../../../../_shared/application/iz.js';
import { KokUyelik } from '../../../../_shared/application/kok-uyelik.js';
import { kullaniciOlustur } from '../../../domain/entities/kullanici.entity.js';
import {
  type IKullaniciYazmaRepo,
  KULLANICI_YAZMA_REPO,
} from '../../../domain/repositories/i-kullanici.repository.js';
import type { KullaniciAcKomutu } from './kullanici-ac.command.js';
import type { KullaniciAcSonucu } from './kullanici-ac.result.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:kullanici-ac';

// Tek işlemde: kullanıcı satırı yetki kapısından (Kullanici:olustur yeteneğiyle) yazılır; (Kök, Temel)
// üyeliği "kök üyelik" parçası yeteneksiz yazar; parola bağlantısını "bağlantı" parçası üretir. Genel
// sayaç kilitlenmez. Kişinin satırı bu işlemde yazıldığı için işlem bitene kadar başka işlem ona
// dokunamaz; bağlantı kilit sırasında kişiden sonra gelir. Olay yazılmaz (AK-39). Kod yalnız cevapta
// döner; tabloda özeti durur, notlar ve günlük onu taşımaz. Tekil kullanıcı adı çakışması veritabanının
// tekil kısıtından cakisma olur ve bütün işlem geri alınır.
@Injectable()
export class KullaniciAcHandler {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(KULLANICI_YAZMA_REPO) private readonly repo: IKullaniciYazmaRepo,
    private readonly kokUyelik: KokUyelik,
    private readonly baglanti: ParolaBaglantisi,
  ) {}

  calistir(komut: KullaniciAcKomutu): Promise<KullaniciAcSonucu> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    const kullanici = kullaniciOlustur(komut.kullaniciAdi, komut.gorunenAd);
    return this.uow.run(async (islem) => {
      const id = await this.repo.olustur(islem, IS_ADI, kullanici);
      await this.kokUyelik.yaz(islem, id, iz);
      const parolaBaglantisiKodu = await this.baglanti.uret(
        islem,
        { kullaniciId: id, olusturanId: oturum.kullaniciId },
        iz,
      );
      return { id, parolaBaglantisiKodu };
    });
  }
}
