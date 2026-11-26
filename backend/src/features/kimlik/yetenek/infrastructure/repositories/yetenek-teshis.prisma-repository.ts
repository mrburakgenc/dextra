// IYetenekTeshisRepo'nun gerçeklemesi: izin kataloğunu, teşhis edilen kişiyi ve sorulan kaydı işlemsiz
// istemciyle okur. Sorguları kendisi yazar; satır süzgecini, kolon seçimini ve okumayı kapatan işlevi
// yetki kapısının okuma ve teşhis yüzünden alır (TS-007 "Yapı"; TS-008 "Yönetim, izinler ve teşhis").
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { TeshisKapisi } from '../../../../../shared/yetki/infrastructure/teshis-kapisi.js';
import type { IYetenekTeshisRepo } from '../../domain/repositories/i-yetenek-teshis.repository.js';

// Sıra: kaynak ve eylem izin kataloğunda mı (isteyenin göremediği izin katalogda yok sayılır; yetenek
// yazımıyla aynı), teşhis edilen kişiyi isteyen görüyor mu, sorulan kaydı isteyen görüyor mu. Kişinin
// kuralları teşhis yüzünden gelir; kaydı tutup tutmadıklarını yeniden okuma deyimi sorar.
export function yetenekTeshisPrismaRepository(
  kapi: OkumaKapisi,
  teshisKapisi: TeshisKapisi,
): RepoFabrikasi<IYetenekTeshisRepo> {
  return (istemci: RepoIstemcisi) => ({
    teshis: async ({ kullaniciId, kaynak, eylem, kayitId }) => {
      const izinYetkisi = kapi.yetki('Izin', { bakilan: ['kaynak', 'eylem'] });
      const izinler = await istemci.izin.findMany({
        where: { AND: [{ kaynak, eylem }, izinYetkisi.satirlar] },
        select: izinYetkisi.kolonlar,
      });
      const [izin] = await izinYetkisi.kayitlar(izinler, (where, select) =>
        istemci.izin.findMany({ where, select }),
      );
      if (izin === undefined) {
        throw new KodluHata('dogrulama_hatasi', 'İstek doğrulanamadı', [
          { alan: 'kaynak', neden: 'kaynak ve eylem izin kataloğunda yok' },
        ]);
      }

      const kisiYetkisi = kapi.yetki('Kullanici', { bakilan: [] });
      const kisiler = await istemci.kullanici.findMany({
        where: { AND: [{ id: kullaniciId }, kisiYetkisi.satirlar] },
        select: kisiYetkisi.kolonlar,
      });
      const [kisi] = await kisiYetkisi.kayitlar(kisiler, (where, select) =>
        istemci.kullanici.findMany({ where, select }),
      );
      if (kisi === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }

      const yetki = await teshisKapisi.yetki(kaynak, eylem, kullaniciId);
      const okuyucu = yetki.okuyucu(istemci);
      const kayitlar = await okuyucu.findMany({
        where: { AND: [{ id: kayitId }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const teshis = await yetki.kayitlar(kayitlar, (where, select) =>
        okuyucu.findMany({ where, select }),
      );
      if (teshis === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      return teshis;
    },
  });
}
