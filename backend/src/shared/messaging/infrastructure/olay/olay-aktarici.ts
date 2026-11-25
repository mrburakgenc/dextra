import type { UnitOfWork } from '../../../database/infrastructure/unit-of-work.js';
import { Dongu } from '../aktarim/dongu.js';
import type { IsKuyrugu } from '../../domain/kuyruk/is-kuyrugu.js';
import type { AboneDefteri } from '../../application/olay/abone-defteri.js';
import {
  OUTBOX_OLAY_REPO,
  type OutboxOlayOlculeri,
} from '../../domain/olay/i-outbox-olay.repository.js';

// Bir geçişte en çok alınan not sayısı.
export const PARTI_BOYU = 100;
// Tek kuyruk çağrısının süre sınırı; dolarsa o iş konamamış sayılır.
export const KUYRUK_CAGRISI_SURE_SINIRI_MS = 1000;
// Geçişin başından bu kadar süre geçtiyse yeni nota başlanmaz. Bütçe, son notun kuyruk çağrıları
// (en çok bir süre sınırı) ve işaretlemeler, notları kilitleyen işlemin 5 saniyelik süre sınırına
// (ISLEM_SURE_SINIRI_MS) sığar.
export const GECIS_BUTCESI_MS = 3000;
// Parti dolu gelmediyse döngünün yeniden okumadan önce beklediği süre.
export const BOS_BEKLEME_MS = 1000;
// Konamayan iş kaldıysa ya da geçiş hata verdiyse bekleme: ilk seferde taban, her ardışık seferde
// iki katı, üst sınırda durur.
export const HATA_TABAN_BEKLEME_MS = 1000;
export const HATA_UST_BEKLEME_MS = 60_000;
// Temizlik döngüsünün iki koşusu arasındaki süre ve bir temizlik partisinde en çok silinen not.
export const TEMIZLIK_ARALIGI_MS = 3_600_000;
export const TEMIZLIK_PARTI_BOYU = 1000;

// Kuyruk çağrısı süre sınırında bitmedi. Çağrı iptal edilemez; geç biterse iş kuyruğa konmuş olur
// ve not yeniden denenince, iş kuyrukta duruyorsa aynı kimlikle ikilenmez.
export class KuyrukSuresiDoldu extends Error {
  constructor() {
    super(
      `Kuyruk çağrısı ${String(KUYRUK_CAGRISI_SURE_SINIRI_MS)} ms içinde bitmedi`,
    );
    this.name = 'KuyrukSuresiDoldu';
  }
}

// Konamayan iş: olayın kimliği, kuyruğun adı ve hatanın sınıfı. Hatanın metni taşınmaz.
export interface KonamayanIs {
  olayId: string;
  kuyruk: string;
  hataSinifi: string;
}

export interface GecisSonucu {
  // Bütün kuyruklarına iş konup işaretlenen not sayısı.
  aktarilan: number;
  // İşaretlenmeyen not sayısı: ertelenenler ve bütçe dolduğu için dokunulmayanlar.
  kalan: number;
  // Konamayan her iş.
  konamayanlar: KonamayanIs[];
}

async function sureyleSinirla(cagri: Promise<void>): Promise<void> {
  let zamanlayici: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      cagri,
      new Promise<never>((_, reddet) => {
        zamanlayici = setTimeout(() => {
          reddet(new KuyrukSuresiDoldu());
        }, KUYRUK_CAGRISI_SURE_SINIRI_MS);
      }),
    ]);
  } finally {
    clearTimeout(zamanlayici);
  }
}

// outbox_olay notlarını, olayı dinleyen her tüketicinin kendi kuyruğuna taşır (KR-012 Kural 4, 6).
export class OlayAktarici {
  private readonly aktarimDongusu = new Dongu({
    adim: async () => {
      const sonuc = await this.gecis();
      if (sonuc.konamayanlar.length > 0) {
        throw new Error('Konamayan iş kaldı');
      }
      return sonuc.aktarilan === PARTI_BOYU;
    },
    bosBeklemeMs: BOS_BEKLEME_MS,
    hataBeklemeTabanMs: HATA_TABAN_BEKLEME_MS,
    hataBeklemeUstMs: HATA_UST_BEKLEME_MS,
  });
  private readonly temizlikDongusu = new Dongu({
    adim: async () => (await this.temizle()) === TEMIZLIK_PARTI_BOYU,
    bosBeklemeMs: TEMIZLIK_ARALIGI_MS,
    hataBeklemeTabanMs: HATA_TABAN_BEKLEME_MS,
    hataBeklemeUstMs: HATA_UST_BEKLEME_MS,
  });

  constructor(
    private readonly uow: UnitOfWork,
    private readonly defter: AboneDefteri,
    private readonly kuyruk: IsKuyrugu,
  ) {}

  // Aktarım ve temizlik döngülerini başlatır; ikisi de hemen bir kez koşar.
  baslat(): void {
    this.aktarimDongusu.baslat();
    this.temizlikDongusu.baslat();
  }

  // Süren geçişi bitirir; döndükten sonra açık zamanlayıcı kalmaz.
  async durdur(): Promise<void> {
    await Promise.all([
      this.aktarimDongusu.durdur(),
      this.temizlikDongusu.durdur(),
    ]);
  }

  // Bir parti notu taşır. Kuyruğa koyma hatası atılmaz: o not ertelenir, öbürleri ilerler.
  // İşin kimliği olayın kimliğidir; yeniden denemede kuyrukta duran iş ikilenmez.
  async gecis(): Promise<GecisSonucu> {
    return this.uow.run(async (islem) => {
      const baslangic = performance.now();
      const repo = islem.repo(OUTBOX_OLAY_REPO);
      const notlar = await repo.aktarilacaklariKilitle(PARTI_BOYU);
      const aktarilanlar: string[] = [];
      const konamayanlar: KonamayanIs[] = [];
      for (const not of notlar) {
        // Bütçe dolduysa kalan notlara dokunulmaz; sonraki geçişe kalırlar.
        if (performance.now() - baslangic >= GECIS_BUTCESI_MS) {
          break;
        }
        // İşin verisi zarftır: olayın kimliği, adı, sürümü ve gövdesi.
        const zarf = {
          id: not.id,
          ad: not.ad,
          surum: not.surum,
          govde: not.govde,
        };
        const sonuclar = await Promise.all(
          this.defter.dinleyenler(not.ad).map(async (kuyruk) => {
            try {
              await sureyleSinirla(
                this.kuyruk.koy(kuyruk, {
                  kimlik: not.id,
                  ad: not.ad,
                  veri: zarf,
                }),
              );
              return undefined;
            } catch (hata) {
              return {
                olayId: not.id,
                kuyruk,
                hataSinifi: hata instanceof Error ? hata.name : typeof hata,
              };
            }
          }),
        );
        const notunKonamayanlari = sonuclar.filter((k) => k !== undefined);
        if (notunKonamayanlari.length === 0) {
          aktarilanlar.push(not.id);
        } else {
          // Yalnız kuyruk ve hatanın sınıfı yazılır; olayın verisi yazılmaz.
          await repo.konamadiIsaretle(
            not.id,
            notunKonamayanlari
              .map((k) => `${k.kuyruk}: ${k.hataSinifi}`)
              .join(', '),
          );
          konamayanlar.push(...notunKonamayanlari);
        }
      }
      if (aktarilanlar.length > 0) {
        await repo.aktarildiIsaretle(aktarilanlar);
      }
      return {
        aktarilan: aktarilanlar.length,
        kalan: notlar.length - aktarilanlar.length,
        konamayanlar,
      };
    });
  }

  // Aktarımının üzerinden saklama süresi geçmiş bir parti notu siler, silinen sayıyı döner.
  async temizle(): Promise<number> {
    return this.uow.run((islem) =>
      islem.repo(OUTBOX_OLAY_REPO).eskileriSil(TEMIZLIK_PARTI_BOYU),
    );
  }

  olculer(): Promise<OutboxOlayOlculeri> {
    return this.uow.read(OUTBOX_OLAY_REPO).olculer();
  }
}
