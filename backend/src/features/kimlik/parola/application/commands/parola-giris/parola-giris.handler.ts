// Parola ile giriş işinin işleyicisi: oturum çekirdeğinin tükettiği giriş yöntemi sözleşmesini uygular;
// sözleşme gereği tek calistir yerine iki adımı (doğrula, kesinleştir) vardır.
import { Injectable } from '@nestjs/common';
import {
  type Islem,
  UnitOfWork,
} from '../../../../../../shared/database/unit-of-work.js';
import type { GirisYontemi } from '../../../../../../shared/kimlik/application/i-giris-yontemi.port.js';
import type {
  GirisDogrulamaSonucu,
  GirisKesinlestirmeSonucu,
} from '../../../../../../shared/kimlik/domain/i-giris-yontemi.contract.js';
import {
  girisKarari,
  girisKesinlestirmeKarari,
} from '../../../domain/entities/kullanici-sirri.entity.js';
import { ParolaOzetleyici } from '../../../domain/parola-ozetleyici.port.js';
import { PAROLA_REPO } from '../../../domain/repositories/i-parola.repository.js';
import {
  type ParolaGirisGovdesi,
  parolaGirisSemasi,
} from './parola-giris.command.js';

// Kişi yokken ya da parolası belirlenmemişken doğrulamanın karşılaştırıldığı sabit sahte özet (TS-002
// AK-15): rastgele bir girdinin Argon2id özetidir, hiçbir parolaya uymaz. Ayarları ARGON2ID_AYARLARI
// ile aynıdır, böylece süre gerçek doğrulamanınkiyle aynı kalır; ayarlar değişirse bu da yenilenir.
const SAHTE_OZET =
  '$argon2id$v=19$m=19456,t=2,p=1$g0vBgwaGyBEMylmGSjjebw$FNLMoomc3bsxeuAg6YylGjCtwpExOu6SVl3ml7tB/CE';

// Parola ile giriş yöntemi (TS-002 "Yapı", "İşlem sınırları"; KR-009 Seçim 10). Doğrulama işlemin
// dışında koşar; kanıt sırrın doğrulama anındaki güncelleme zamanıdır. Kesinleştirme, kişinin kilidi
// altında sırrın o zamandan beri değişmediğine bakar (parola belirleme kişiyi kilitleyip yazar).
@Injectable()
export class ParolaGirisYontemi implements GirisYontemi<ParolaGirisGovdesi> {
  readonly ad = 'parola';
  readonly dogrulaSemasi = parolaGirisSemasi;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly ozetleyici: ParolaOzetleyici,
  ) {}

  // Kullanıcı adı küçük harfe çevrilerek aranır (TS-002 değişmez 15). Kişi yoksa da doğrulama koşar;
  // sonuç her iki durumda "yanlis"tır.
  async dogrula({
    kullaniciAdi,
    parola,
  }: ParolaGirisGovdesi): Promise<GirisDogrulamaSonucu> {
    const sir = await this.uow
      .read(PAROLA_REPO)
      .girisSirri(kullaniciAdi.toLowerCase());
    const karar = girisKarari({
      sir,
      parolaDogruMu: await this.ozetleyici.dogrula(
        parola,
        sir?.parolaOzeti ?? SAHTE_OZET,
      ),
    });
    if (karar.tur === 'ret') {
      return { sonuc: 'yanlis' };
    }
    return {
      sonuc: 'tamam',
      kullaniciId: karar.deger.kullaniciId,
      kanit: karar.deger.guncellemeZamani.toISOString(),
    };
  }

  async kesinlestir(
    islem: Islem,
    kullaniciId: string,
    kanit: string,
  ): Promise<GirisKesinlestirmeSonucu> {
    const karar = girisKesinlestirmeKarari({
      kanit,
      kilitAltindakiZaman: await islem.repo(PAROLA_REPO).sirZamani(kullaniciId),
    });
    return karar.tur === 'tamam' ? 'tamam' : 'gecersiz';
  }
}
