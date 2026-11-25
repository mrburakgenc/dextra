// Üyelik kaldır işinin işleyicisi (TS-002 "İşlem sınırları"; KR-008 Seçim 47; AK-39, AK-43).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/http/istek-baglami.js';
import {
  type HataKodu,
  KodluHata,
} from '../../../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/genel-sayac.js';
import { KisininSayisi } from '../../../../_shared/kisinin-sayisi.js';
import {
  type UyelikKaldirmaReddi,
  uyelikKaldirmaKarari,
  uyelikKaldirmaOncesiKarari,
} from '../../../domain/entities/uyelik.entity.js';
import {
  type IUyelikYazmaRepo,
  UYELIK_YAZMA_REPO,
} from '../../../domain/repositories/i-uyelik.repository.js';
import type { UyelikKaldirKomutu } from './uyelik-kaldir.command.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:uyelik-kaldir';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_HATASI: Record<
  UyelikKaldirmaReddi,
  { readonly kod: HataKodu; readonly ileti: string }
> = {
  temel_uyelik: { kod: 'cakisma', ileti: 'Kök üyelik kaldırılamaz' },
  superadmin_degil: {
    kod: 'yetki_yok',
    ileti: 'SuperAdmin üyeliğini yalnız SuperAdmin kaldırabilir',
  },
  son_superadmin: {
    kod: 'cakisma',
    ileti: 'Girebilen son SuperAdmin üyeliği kaldırılamaz',
  },
};

// Tek işlemde: genel sayaç satırı kilitlenir ama artırılmaz; üyeliğin künyesi okunur, yok ya da
// silinmiş üyelik bulunamadi alır; olgular silmeden önceki hâle göre sorulur; satır yetki kapısından
// (Uyelik:sil yeteneğiyle) silinmiş işaretlenir; kişinin sayısı artar. Karar silmeden sonra uygulanır,
// böylece satırı silemeyen kişi bulunamadi alır ve üyeliğin türünü öğrenemez; karara takılan iş hata
// attığı için silme de geri alınır. Olay yazılmaz (AK-39).
@Injectable()
export class UyelikKaldirHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly kisininSayisi: KisininSayisi,
    @Inject(UYELIK_YAZMA_REPO) private readonly yazma: IUyelikYazmaRepo,
  ) {}

  calistir({ id }: UyelikKaldirKomutu): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: false });
      const kunye = await this.butunluk.uyelikKunyesi(islem, id);
      if (
        kunye === undefined ||
        uyelikKaldirmaOncesiKarari({ canliMi: kunye.canli }).tur === 'ret'
      ) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      const { kullaniciId, grupId, rolId } = kunye;
      const olgular = {
        superAdminUyeligiMi: await this.butunluk.kokSuperAdminKumesiMi(
          islem,
          grupId,
          rolId,
        ),
        grupKokMu: await this.butunluk.grupKokMu(islem, grupId),
        rolSistemRoluMu: await this.butunluk.rolSistemRoluMu(islem, rolId),
        isteyenSuperAdminMi: await this.butunluk.kokSuperAdminUyesiMi(
          islem,
          oturum.kullaniciId,
        ),
        sonGirebilenSuperAdminMi:
          await this.butunluk.sonGirebilenKokSuperAdminMi(islem, kullaniciId),
      };

      await this.yazma.sil(islem, IS_ADI, id);
      const karar = uyelikKaldirmaKarari(olgular);
      if (karar.tur === 'ret') {
        const { kod, ileti } = RET_HATASI[karar.neden];
        throw new KodluHata(kod, ileti);
      }
      await this.kisininSayisi.artir(islem, kullaniciId, {
        yazanId: oturum.kullaniciId,
        isAdi: IS_ADI,
      });
    });
  }
}
