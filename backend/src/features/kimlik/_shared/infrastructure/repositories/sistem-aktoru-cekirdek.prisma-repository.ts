// Kimlik'in sistem aktörünü bulan çekirdek işlev (TS-002 AK-2, AK-35): sistemin kendi kararıyla
// yaptığı yazmaların notunda yazanı arayan her yer bunu kullanır. Yetki kapısından geçmeden okur
// (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';

// Aktörün giriş bilgisi yoktur; tabloda onu sistem aktörü işaretiyle birlikte bu görünen ad ayırır.
// Adın sistem aktörleri arasında tekilliğini tohum yardımcısı korur.
export const KIMLIK_SISTEM_AKTORU_ADI = 'kimlik';

// Hiç ya da birden çok satır bulunursa hata verir.
export async function kimlikSistemAktoru(
  istemci: RepoIstemcisi,
): Promise<string> {
  const [satir, fazla] = await istemci.kullanici.findMany({
    where: { sistemAktoru: true, gorunenAd: KIMLIK_SISTEM_AKTORU_ADI },
    select: { id: true },
    take: 2,
  });
  if (satir === undefined) {
    throw new Error(
      `Kimlik sistem aktörü yok: görünen adı "${KIMLIK_SISTEM_AKTORU_ADI}" olan sistem aktörü bulunamadı`,
    );
  }
  if (fazla !== undefined) {
    throw new Error(
      `Kimlik sistem aktörü tekil değil: görünen adı "${KIMLIK_SISTEM_AKTORU_ADI}" olan birden çok sistem aktörü var`,
    );
  }
  return satir.id;
}
