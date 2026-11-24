import type { OnApplicationShutdown } from '@nestjs/common';
import {
  Queue,
  Worker,
  createPostgresBackend,
  type Job,
  type JobProgress,
  type PostgresConnectionOptions,
  type PostgresQueueBackend,
} from 'bullmq';
import type {
  Dinleyici,
  IsIsleyici,
  IsKuyrugu,
  KuyrukIsi,
} from './is-kuyrugu.js';

// Kuyruk tabloları asıl veritabanında bu şemada durur (TS-003 Seçenek 2).
export const KUYRUK_SEMASI = 'kuyruk';
// Kanondaki değer; uyarlaması ayrıca kararlaştırılacak.
export const DENEME_SAYISI = 5;
// Üstel aralığın ilk adımı: 1, 2, 4, 8 sn.
export const ILK_ARALIK_MS = 1000;

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
export class BullmqIsKuyrugu implements IsKuyrugu, OnApplicationShutdown {
  private readonly baglanti: { connectionString: string; schema: string };
  private readonly kuyruklar = new Map<string, Kuyruk>();
  private readonly dinleyiciler = new Set<Isci>();

  constructor(connectionString: string) {
    this.baglanti = { connectionString, schema: KUYRUK_SEMASI };
  }

  async koy(kuyruk: string, is: KuyrukIsi): Promise<void> {
    await this.kuyruk(kuyruk).add(is.ad, is.veri, { jobId: is.kimlik });
  }

  async dinle(kuyruk: string, isleyici: IsIsleyici): Promise<Dinleyici> {
    const worker = new Worker(
      kuyruk,
      (job: Job<Veri>) =>
        isleyici({ kimlik: String(job.id), ad: job.name, veri: job.data }),
      { connection: this.baglanti },
      createPostgresBackend,
    );
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
      this.kuyruklar.set(ad, kuyruk);
    }
    return kuyruk;
  }
}
