// IOturumDenetimiRepo'nun gerçeklemesi: oturum denetiminin okuması ve adres değişince kapatma, işlemin
// istemcisiyle ve yetki kapısından geçmeden (çekirdek yol).
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';
import { kimlikSistemAktoru } from '../../../_shared/cekirdek/sistem-aktoru.js';
import type { DenetimSatiri } from '../../domain/entities/oturum.entity.js';
import type { IOturumDenetimiRepo } from '../../domain/repositories/i-oturum-denetimi.repository.js';

export function oturumDenetimiPrismaRepository(
  istemci: RepoIstemcisi,
): IOturumDenetimiRepo {
  return {
    // Feature içindeki tek ham sorgu (KR-010 Seçim 49): model arayüzüyle bu okuma üç ayrı deyim
    // olur ve üçü üç ayrı anı görebilir. Genel sayaç satırı yoksa çapraz birleştirme satır vermez.
    // Kolon adları elle yazılıdır; değişirse derleyici değil test yakalar.
    oku: async (oturumId) => {
      const [satir] = await istemci.$queryRaw<DenetimSatiri[]>`
        select o.kullanici_id                 as "kullaniciId",
               o.mutlak_bitis_zamani          as "mutlakBitisZamani",
               o.son_dondurme_zamani          as "sonDondurmeZamani",
               o.ip_adresi                    as "ipAdresi",
               o.tarayici_bilgisi             as "tarayiciBilgisi",
               o.kapatilma_zamani is not null as "kapali",
               k.pasif_zamani is not null     as "kullaniciPasif",
               k.sistem_aktoru                as "sistemAktoru",
               k.yetki_surumu                 as "kisiSurumu",
               y.sayac                        as "genelSurum"
          from oturum o
          join kullanici k on k.id = o.kullanici_id
         cross join yetki_surumu y
         where o.id = ${oturumId}::uuid`;
      return satir ?? null;
    },
    kimlikSistemAktoru: () => kimlikSistemAktoru(istemci),
    // Tek oturuma dokunan yol kişiyi kilitlemez; yalnız bu satır "kapatılmamışsa kapat" diye
    // koşullu güncellenir (TS-002 "İşlem sınırları"). Zamanı uygulama saati verir (AK-21).
    adresleKapat: async (oturumId, kapatilmaZamani) => {
      const { count } = await istemci.oturum.updateMany({
        where: { id: oturumId, kapatilmaZamani: null },
        data: { kapatilmaZamani, kapatilmaNedeni: 'adres_degisti' },
      });
      return count > 0;
    },
  };
}
