import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { KullaniciYazmaRepo } from '../domain/kullanici.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:kullanici-guncelle';

// Kullanıcının görünen adını değiştir (TS-002 AK-39). Tek işlemde görünen ad yetki kapısından
// (Kullanici:guncelle yeteneğiyle) yazılır. Yetki verisine dokunmadığı için genel sayaç kilitlenmez.
// Olay yazılmaz (AK-39).
// Sistem aktörü ve unutulmuş kişi hedefi reddedilir (TS-002 değişmez 16 ve AK-47): çekirdek yollar
// kimlik sistem aktörünü görünen adıyla bulur; unutulmuş kişinin görünen adı kişiye geri götürmeyen
// sabit değerdir (KR-012). Sorular kapıdan sonra, satır kilitliyken sorulur; böylece yeteneği kaydı
// tutmayan kişi 409 değil 404 alır. Ret işlemi geri alır.
@Injectable()
export class KullaniciGuncelleHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: KullaniciYazmaRepo,
    private readonly butunluk: ButunlukSorusu,
  ) {}

  calistir(id: string, gorunenAd: string): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.repo.gorunenAdiDegistir(islem, IS_ADI, id, gorunenAd);
      if (await this.butunluk.kisiSistemAktoruMu(islem, id)) {
        throw new KodluHata(
          'cakisma',
          'Sistem aktörünün görünen adı değiştirilmez',
        );
      }
      if (await this.butunluk.kisiUnutulmusMu(islem, id)) {
        throw new KodluHata(
          'cakisma',
          'Unutulmuş kişinin görünen adı değiştirilmez',
        );
      }
    });
  }
}
