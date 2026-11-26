// Yetenek yenile işinin işleyicisi (TS-002 "İşlem sınırları", "Durum geçişleri", AK-39, AK-46 ve eki;
// değişmez 6).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import {
  type HataKodu,
  KodluHata,
} from '../../../../../../shared/http/domain/kodlu-hata.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import {
  type YetenekYenilemeReddi,
  yetenekYenilemeKarari,
} from '../../../domain/entities/yetenek.entity.js';
import {
  type IYetenekYazmaRepo,
  YETENEK_REPO,
  YETENEK_YAZMA_REPO,
} from '../../../domain/repositories/i-yetenek.repository.js';
import { YetenekYazimi } from '../../_shared/yetenek-yazimi.js';
import type { YetenekYenileKomutu } from './yetenek-yenile.command.js';
import type { YetenekYenileSonucu } from './yetenek-yenile.result.js';

// İşin adı; kapının iki notuna da yazılır.
const IS_ADI = 'kimlik:yetenek-yenile';

// Kararın baktığı kolonlar; olgular bunlardan okunur, biri görülemiyorsa satırın korunan olup olmadığı
// bilinemez (TS-002 AK-46 eki). Etki ve öncelik yeni satıra eski satırdan geçtiği için onlar da karar
// kolonudur (TS-008 "Yönetim, izinler ve teşhis").
const KARAR_KOLONLARI = [
  'sistemSatiri',
  'tohumAnahtari',
  'grupId',
  'rolId',
  'izinId',
  'silinmeZamani',
  'giremez',
  'oncelik',
];

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_HATASI: Record<
  YetenekYenilemeReddi,
  { readonly kod: HataKodu; readonly ileti: string }
> = {
  gorulemiyor: { kod: 'yetki_yok', ileti: 'Bu işlem için yetki yok' },
  silinmis: { kod: 'bulunamadi', ileti: 'Kayıt bulunamadı' },
  korunan_satir: {
    kod: 'cakisma',
    ileti: 'Sistem satırı ve tohum satırı yenilenemez',
  },
};

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır (yetenek yazan bütün işler aynı satırı
// kilitlediği için okuma ile yazma arasında satır değişmez); eski satır yetki kapısından okunur
// (görülemeyen ya da var olmayan kayıt bulunamadi); karar varlıktandır (karar kolonlarından birini
// göremeyen yetki_yok, silinmiş satır bulunamadi, sistem satırı ve tohum satırı cakisma alır). Eski
// satır kapının niyet yoluyla Yetenek:yenile yeteneğiyle kapatılır; yeni satır grup, rol ve izni eski
// satırdan alarak yetenek yaz'ın yazma kararından geçer ve kapının oluşturma yoluyla Yetenek:olustur
// yeteneğiyle, yerineGectigiId ve köken 'yonetici' ile yazılır. Yenileme iki yeteneği de ister. Olay
// yazılmaz (AK-39).
@Injectable()
export class YetenekYenileHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly yazim: YetenekYazimi,
    @Inject(YETENEK_YAZMA_REPO) private readonly yazma: IYetenekYazmaRepo,
  ) {}

  calistir({
    id,
    icerik,
    oncelik,
  }: YetenekYenileKomutu): Promise<YetenekYenileSonucu> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const eski = await islem.repo(YETENEK_REPO).tek(id);
      const karar = yetenekYenilemeKarari({
        kararKolonlariGorunurMu: KARAR_KOLONLARI.every(
          (kolon) => kolon in eski,
        ),
        silinmisMi: eski.silinmeZamani !== null,
        sistemSatiriMi: eski.sistemSatiri !== false,
        tohumSatiriMi: eski.tohumAnahtari !== null,
      });
      if (karar.tur === 'ret') {
        const { kod, ileti } = RET_HATASI[karar.neden];
        throw new KodluHata(kod, ileti);
      }
      await this.yazma.kapat(islem, IS_ADI, id);
      const { grupId, rolId, izinId } = eski as Record<
        'grupId' | 'rolId' | 'izinId',
        string
      >;
      // Etki eski satırdan gelir; öncelik verilmezse eskisi korunur (TS-008 kapanan AU-9 ve AU-25).
      const etki = eski as { giremez: boolean; oncelik: number };
      const yeni = await this.yazim.kur(
        islem,
        { grupId, rolId, izinId },
        icerik,
        { giremez: etki.giremez, oncelik: oncelik ?? etki.oncelik },
      );
      return {
        id: await this.yazma.olustur(islem, IS_ADI, {
          ...yeni,
          yerineGectigiId: id,
        }),
      };
    });
  }
}
