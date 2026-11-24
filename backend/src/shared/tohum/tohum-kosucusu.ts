import type { Islem, UnitOfWork } from '../database/unit-of-work.js';
import type { TohumDefteri, TohumGocu } from './tohum-defteri.js';
import { TOHUM_GOCU_REPO } from './tohum-gocu.repository.js';

// Kuru koşunun işlemini geri aldırmak için atılır; koşucunun dışına çıkmaz.
class KuruKosuGeriAlmasi extends Error {}

// Göç deftere yazılmamışsa önce adını yazar, sonra göçü çalıştırır; uyguladıysa true döner.
// Göçün hatası, adıyla birlikte bildirilir.
async function uygula(
  islem: Islem,
  ad: string,
  goc: TohumGocu,
): Promise<boolean> {
  if (!(await islem.repo(TOHUM_GOCU_REPO).yaz(ad))) {
    return false;
  }
  try {
    await goc(ad, islem);
  } catch (hata) {
    throw new Error(`${ad} tohum göçü uygulanamadı`, { cause: hata });
  }
  return true;
}

// Defterdeki tohum göçlerini sırayla ve yalnız bir kez uygular (TS-002 AK-1).
export class TohumKosucusu {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly defter: TohumDefteri,
  ) {}

  // Her göç kendi run'ında uygulanır; hata veren göç geri alınır, sonrakiler koşmaz ve hata
  // çağırana ulaşır. Bu çağrının uyguladığı göçlerin adlarını döner.
  async kos(): Promise<string[]> {
    const uygulanan: string[] = [];
    for (const [ad, goc] of this.defter.sirayla()) {
      if (await this.uow.run((islem) => uygula(islem, ad, goc))) {
        uygulanan.push(ad);
      }
    }
    return uygulanan;
  }

  // Bekleyen göçleri tek run içinde sırayla uygular, sonra hepsini geri alır; uygulanacak
  // göçlerin adlarını döner. Göçlerden biri hata verirse hata çağırana ulaşır.
  async kuruKos(): Promise<string[]> {
    const uygulanacak: string[] = [];
    try {
      await this.uow.run(async (islem) => {
        for (const [ad, goc] of this.defter.sirayla()) {
          if (await uygula(islem, ad, goc)) {
            uygulanacak.push(ad);
          }
        }
        throw new KuruKosuGeriAlmasi();
      });
    } catch (hata) {
      if (!(hata instanceof KuruKosuGeriAlmasi)) {
        throw hata;
      }
    }
    return uygulanacak;
  }
}
