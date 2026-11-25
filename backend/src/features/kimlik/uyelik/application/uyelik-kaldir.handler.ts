import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import { KisininSayisi } from '../../_shared/kisinin-sayisi.js';
import { UyelikYazmaRepo } from '../domain/uyelik.repository.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:uyelik-kaldir';

// Üyelik kaldır (TS-002 "İşlem sınırları"; KR-008 Seçim 47; AK-39, AK-43). Tek işlemde: genel sayaç
// satırı kilitlenir ama artırılmaz; üyeliğin künyesi okunur ve kurallar silmeden önceki hâle göre
// hesaplanır; satır yetki kapısından (Uyelik:sil yeteneğiyle) silinmiş işaretlenir; kişinin sayısı
// artar. Kurallar silmeden sonra uygulanır, böylece satırı silemeyen kişi bulunamadi alır ve
// üyeliğin türünü öğrenemez; kurala takılan iş hata attığı için silme de geri alınır.
// Kurallar: kişinin (Kök, Temel) üyeliği bu uçla kaldırılamaz (cakisma); SuperAdmin üyeliğini yalnız
// (Kök, SuperAdmin) üyesi kaldırır (yetki_yok); girebilen son SuperAdmin'in üyeliği kaldırılamaz
// (cakisma). (Kök, Temel) kümesi: kök grup ile kodu dolu (sistem) bir rolün, SuperAdmin olmayan
// kümesidir; sistem rolleri temel ve SuperAdmin'dir. Olay yazılmaz (AK-39).
@Injectable()
export class UyelikKaldirHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: UyelikYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly kisininSayisi: KisininSayisi,
  ) {}

  calistir(id: string): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: false });
      const kunye = await this.butunluk.uyelikKunyesi(islem, id);
      if (!kunye?.canli) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      const { kullaniciId, grupId, rolId } = kunye;
      const superAdmin = await this.butunluk.kokSuperAdminKumesiMi(
        islem,
        grupId,
        rolId,
      );
      const kokTemel =
        !superAdmin &&
        (await this.butunluk.grupKokMu(islem, grupId)) &&
        (await this.butunluk.rolSistemRoluMu(islem, rolId));
      const isteyenSuperAdmin =
        superAdmin &&
        (await this.butunluk.kokSuperAdminUyesiMi(islem, oturum.kullaniciId));
      const sonSuperAdmin =
        superAdmin &&
        (await this.butunluk.sonGirebilenKokSuperAdminMi(islem, kullaniciId));

      await this.repo.sil(islem, IS_ADI, id);
      if (kokTemel) {
        throw new KodluHata('cakisma', 'Kök üyelik kaldırılamaz');
      }
      if (superAdmin && !isteyenSuperAdmin) {
        throw new KodluHata(
          'yetki_yok',
          'SuperAdmin üyeliğini yalnız SuperAdmin kaldırabilir',
        );
      }
      if (sonSuperAdmin) {
        throw new KodluHata(
          'cakisma',
          'Girebilen son SuperAdmin üyeliği kaldırılamaz',
        );
      }
      await this.kisininSayisi.artir(islem, kullaniciId, {
        yazanId: oturum.kullaniciId,
        isAdi: IS_ADI,
      });
    });
  }
}
