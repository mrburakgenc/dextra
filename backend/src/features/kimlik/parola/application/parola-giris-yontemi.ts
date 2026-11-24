import { Injectable } from '@nestjs/common';
import {
  type Islem,
  UnitOfWork,
} from '../../../../shared/database/unit-of-work.js';
import type {
  GirisDogrulamaSonucu,
  GirisKesinlestirmeSonucu,
  GirisYontemi,
} from '../../../../shared/kimlik/giris-yontemi.contract.js';
import { ParolaOzetleyici } from '../domain/parola-ozetleyici.port.js';
import { PAROLA_REPO } from '../domain/parola.repository.js';
import {
  type ParolaGirisGovdesi,
  parolaGirisSemasi,
} from '../presentation/parola-giris.schema.js';

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
    const dogru = await this.ozetleyici.dogrula(
      parola,
      sir?.parolaOzeti ?? SAHTE_OZET,
    );
    if (sir === null || !dogru) {
      return { sonuc: 'yanlis' };
    }
    return {
      sonuc: 'tamam',
      kullaniciId: sir.kullaniciId,
      kanit: sir.guncellemeZamani.toISOString(),
    };
  }

  async kesinlestir(
    islem: Islem,
    kullaniciId: string,
    kanit: string,
  ): Promise<GirisKesinlestirmeSonucu> {
    const zaman = await islem.repo(PAROLA_REPO).sirZamani(kullaniciId);
    return zaman?.toISOString() === kanit ? 'tamam' : 'gecersiz';
  }
}
