import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
  Queue,
  Worker,
  createPostgresBackend,
  type Job,
  type JobProgress,
  type PostgresConnectionOptions,
  type PostgresQueueBackend,
} from 'bullmq';
import {
  type Dinleyici,
  GecersizIsKimligiHatasi,
  type IsIsleyici,
  type IsKuyrugu,
  type KuyrukIsi,
} from '../../domain/kuyruk/is-kuyrugu.js';

// Kuyruk tabloları asıl veritabanında bu şemada durur (TS-003 Seçenek 2).
export const KUYRUK_SEMASI = 'kuyruk';
// Yeniden deneme penceresi (1 + 2 + … + 64 = 127 sn) tüketici tabanının sahiplenme süresinden
// uzun olsun diye 8'dir (TS-003 Sertleştirme); işçisi ölen olay, sahiplenme dolunca işlenir.
export const DENEME_SAYISI = 8;
// Üstel aralığın ilk adımı: 1, 2, 4, …, 64 sn.
export const ILK_ARALIK_MS = 1000;

// Kapının kimlik kısıtı (is-kuyrugu.ts): bullmq salt sayı ve iki nokta içeren özel kimliği kendi
// iletisiyle reddeder; kapı onu paketten önce, kendi hatasıyla reddeder.
const GECERSIZ_KIMLIK = /^[0-9]+$|:/;

type Veri = KuyrukIsi['veri'];
// Tip parametrelerinin varsayılanı Redis arka ucudur; PostgreSQL arka ucu açıkça yazılır.
type Kuyruk = Queue<
  Veri,
  unknown,
  string,
  Veri,
  unknown,
  string,
  PostgresQueueBackend,
  PostgresConnectionOptions
>;
type Isci = Worker<
  Veri,
  void,
  string,
  PostgresQueueBackend,
  JobProgress,
  PostgresConnectionOptions
>;

// İş kuyruğu kapısının bullmq ve PostgreSQL üzerindeki gerçeklemesi. Kuyruk ve dinleyiciler ilk
// kullanımda açılır; uygulama kapanırken açılanların hepsi kapatılır.
// Kuyruğun ve dinleyicinin hata olayı dinlenir ve günlüğe yazılır (kuyruğun adı ve hatanın
// sınıfı; işin verisi yazılmaz).
export class BullmqIsKuyrugu implements IsKuyrugu, OnApplicationShutdown {
  private readonly gunluk = new Logger(BullmqIsKuyrugu.name);
  private readonly baglanti: { connectionString: string; schema: string };
  private readonly kuyruklar = new Map<string, Kuyruk>();
  private readonly dinleyiciler = new Set<Isci>();

  // dinlemez: uygulama komut olarak açıldı (TS-002 AK-25); dinle() dinleyici açmaz, kapatması bir
  // şey yapmayan dinleyici döner.
  constructor(
    connectionString: string,
    private readonly dinlemez = false,
  ) {
    this.baglanti = { connectionString, schema: KUYRUK_SEMASI };
  }

  async koy(kuyruk: string, is: KuyrukIsi): Promise<void> {
    if (GECERSIZ_KIMLIK.test(is.kimlik)) {
      throw new GecersizIsKimligiHatasi();
    }
    await this.kuyruk(kuyruk).add(is.ad, is.veri, { jobId: is.kimlik });
  }

  async dinle(kuyruk: string, isleyici: IsIsleyici): Promise<Dinleyici> {
    if (this.dinlemez) {
      return { kapat: () => Promise.resolve() };
    }
    const worker = new Worker(
      kuyruk,
      (job: Job<Veri>) =>
        isleyici({ kimlik: String(job.id), ad: job.name, veri: job.data }),
      { connection: this.baglanti },
      createPostgresBackend,
    );
    worker.on('error', (hata) => {
      this.gunluk.error(
        `${kuyruk} kuyruğunun dinleyicisinde hata: ${hata.constructor.name}`,
      );
    });
    this.dinleyiciler.add(worker);
    await worker.waitUntilReady();
    return {
      kapat: async () => {
        await worker.close();
        this.dinleyiciler.delete(worker);
      },
    };
  }

  basarisizSayisi(kuyruk: string): Promise<number> {
    return this.kuyruk(kuyruk).getFailedCount();
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([...this.dinleyiciler].map((w) => w.close()));
    this.dinleyiciler.clear();
    await Promise.all([...this.kuyruklar.values()].map((q) => q.close()));
    this.kuyruklar.clear();
  }

  private kuyruk(ad: string): Kuyruk {
    let kuyruk = this.kuyruklar.get(ad);
    if (kuyruk === undefined) {
      kuyruk = new Queue(
        ad,
        {
          connection: this.baglanti,
          defaultJobOptions: {
            attempts: DENEME_SAYISI,
            backoff: { type: 'exponential', delay: ILK_ARALIK_MS },
            // Tamamlanan iş hemen silinir; başarısız iş görünür kalsın diye silinmez.
            removeOnComplete: true,
            removeOnFail: false,
          },
        },
        createPostgresBackend,
      );
      kuyruk.on('error', (hata) => {
        this.gunluk.error(`${ad} kuyruğunda hata: ${hata.constructor.name}`);
      });
      this.kuyruklar.set(ad, kuyruk);
    }
    return kuyruk;
  }
}
