import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../../../../shared/yetki/kaynak-katalogu.js';
import { yetenekleriDerle } from '../../../../shared/yetki/yetenek-derleyici.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import {
  YETENEK_REPO,
  type YeniYetenek,
  YetenekYazmaRepo,
} from '../domain/yetenek.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:yetenek-olustur';

// Yazma eylemlerini yalnız (Kök, SuperAdmin) kümesine bağlanabilen kaynaklar (KR-008 Seçim 17;
// TS-002 değişmez 8). Yazma eylemi okuma dışındaki her eylemdir.
const KORUNAN_KAYNAKLAR = ['Grup', 'Rol', 'Uyelik', 'Yetenek'];
const OKUMA_EYLEMI = 'oku';

// Yetenek yaz (TS-002 "İşlem sınırları", AK-39; KR-008 Seçim 5, 7, 11, 17, 21, 34). Tek işlemde: genel
// sayaç satırı kilitlenir ve artırılır (yetenek, grup ve rol yazan bütün işler aynı satırı kilitlediği
// için denetimlerle yazma arasında grup, rol ya da yetenek değişemez); grubun ve rolün canlı olduğu
// bütünlük sorusuyla sorulur; izin yetki kapısından okunur, görülemeyen izin yok sayılır; satır
// denetlenir; korunan kaynağın yazma izni yalnız (Kök, SuperAdmin) kümesine yazılır; satır yetki
// kapısından (Yetenek:olustur yeteneğiyle) yazılır. Olay yazılmaz (AK-39).
@Injectable()
export class YetenekOlusturHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: YetenekYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
  ) {}

  calistir(yetenek: YeniYetenek): Promise<string> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      if (
        !(await this.butunluk.grupCanliMi(islem, yetenek.grupId)) ||
        !(await this.butunluk.rolCanliMi(islem, yetenek.rolId))
      ) {
        throw new KodluHata('cakisma', 'Grup ya da rol yok ya da silinmiş');
      }
      const izin = await islem.repo(YETENEK_REPO).izin(yetenek.izinId);
      const kaynak = izin?.['kaynak'];
      const eylem = izin?.['eylem'];
      if (typeof kaynak !== 'string' || typeof eylem !== 'string') {
        throw new KodluHata('cakisma', 'İzin katalogda yok');
      }
      this.denetle(yetenek, kaynak, eylem);
      if (
        KORUNAN_KAYNAKLAR.includes(kaynak) &&
        eylem !== OKUMA_EYLEMI &&
        !(await this.butunluk.kokSuperAdminKumesiMi(
          islem,
          yetenek.grupId,
          yetenek.rolId,
        ))
      ) {
        throw new KodluHata(
          'cakisma',
          'Bu izin yalnız (Kök, SuperAdmin) kümesine yazılabilir',
        );
      }
      return this.repo.olustur(islem, IS_ADI, yetenek);
    });
  }

  // Kolonlar kaynağın alanlarından olmalıdır (derleyici bilinmeyen kolonu sessizce attığı için ayrıca
  // bakılır). Şartın alanı, işleci, değerinin biçimi ve yer tutucusu, satır ortak koddaki derleyiciye
  // verilerek sınanır: derleyici satırı derleyemezse (derlenmeyenler listesine koyarsa) satır yazılmaz.
  // Derleme yalnız satırı sorgu koşuluna çevirir; hiçbir kayıt üzerinde karar verilmez. Yer tutucular
  // derlenebilirlik için yazanın kimliği ve yalnız yeteneğin grubundan oluşan alt grup listesiyle
  // çözülür; okumada kişinin gerçek verisiyle çözülürler.
  private denetle(yetenek: YeniYetenek, kaynak: string, eylem: string): void {
    const alanlar = this.katalog.alanlar(kaynak) ?? [];
    const bilinmeyenKolon = yetenek.kolonlar?.find(
      (kolon) => !alanlar.includes(kolon),
    );
    if (bilinmeyenKolon !== undefined) {
      throw new KodluHata('dogrulama_hatasi', 'Yetenek doğrulanamadı', [
        { alan: 'kolonlar', neden: `bilinmeyen kolon: ${bilinmeyenKolon}` },
      ]);
    }
    const { oturum } = istekBaglami();
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const { derlenmeyenler } = yetenekleriDerle(
      {
        yetenekler: [
          {
            ...yetenek,
            yetenekId: 'yazilacak',
            kaynak,
            eylem,
            sart: yetenek.sart ?? [],
            kolonlar: yetenek.kolonlar ?? [],
          },
        ],
        altGruplar: { [yetenek.grupId]: [yetenek.grupId] },
      },
      oturum.kullaniciId,
      this.katalog,
    );
    const [derlenmeyen] = derlenmeyenler;
    if (derlenmeyen !== undefined) {
      throw new KodluHata('dogrulama_hatasi', 'Yetenek doğrulanamadı', [
        { alan: 'sart', neden: derlenmeyen.neden },
      ]);
    }
  }
}
