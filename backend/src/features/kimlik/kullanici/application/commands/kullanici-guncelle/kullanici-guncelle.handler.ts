// Kullanıcı güncelle işinin işleyicisi: kullanıcının görünen adını değiştirir (TS-002 AK-39).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import {
  type KullaniciGuncellemeReddi,
  kullaniciGuncellemeKarari,
} from '../../../domain/entities/kullanici.entity.js';
import {
  type IKullaniciYazmaRepo,
  KULLANICI_YAZMA_REPO,
} from '../../../domain/repositories/i-kullanici.repository.js';
import type { KullaniciGuncelleKomutu } from './kullanici-guncelle.command.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:kullanici-guncelle';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_ILETISI: Record<KullaniciGuncellemeReddi, string> = {
  sistem_aktoru: 'Sistem aktörünün görünen adı değiştirilmez',
  unutulmus: 'Unutulmuş kişinin görünen adı değiştirilmez',
};

// Tek işlemde görünen ad yetki kapısından (Kullanici:guncelle yeteneğiyle) yazılır. Yetki verisine
// dokunmadığı için genel sayaç kilitlenmez. Olay yazılmaz (AK-39). Olgular kapıdan sonra, satır
// kilitliyken bütünlük sorusuyla sorulur; böylece yeteneği kaydı tutmayan kişi 409 değil 404 alır.
// Karar varlıktandır; ret işlemi geri alır.
@Injectable()
export class KullaniciGuncelleHandler {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(KULLANICI_YAZMA_REPO) private readonly repo: IKullaniciYazmaRepo,
    private readonly butunluk: ButunlukSorusu,
  ) {}

  calistir({ id, gorunenAd }: KullaniciGuncelleKomutu): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.repo.gorunenAdiDegistir(islem, IS_ADI, id, gorunenAd);
      const karar = kullaniciGuncellemeKarari({
        sistemAktoruMu: await this.butunluk.kisiSistemAktoruMu(islem, id),
        unutulmusMu: await this.butunluk.kisiUnutulmusMu(islem, id),
      });
      if (karar.tur === 'ret') {
        throw new KodluHata('cakisma', RET_ILETISI[karar.neden]);
      }
    });
  }
}
