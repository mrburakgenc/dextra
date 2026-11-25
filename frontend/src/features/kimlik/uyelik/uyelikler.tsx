import { tarihSaat } from '../../../shared/bicim/bicim';
import { BOS, ListeTablosu } from '../../../shared/liste/liste-parcalari';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { UyelikKaldir, UyelikVerFormu } from './uyelik-isleri';
import type { Uyelikler as UyeliklerVerisi } from './uyelik-listesi';

// Kullanıcı sayfasındaki üyelikler tablosu ve üyelik ver formu (TS-004 "Yönetim ekranları"). Grup
// ve rol adı listelerden eşlenir; adı bulunamayan kimlik ve gelmeyen kolon boş işaretle görünür.
// Form tür düzeyinde sorulur. Sunucu bileşenidir.

const HUCRE = 'px-3 py-2 text-left';

export function Uyelikler({
  kullaniciId,
  veri,
}: Readonly<{ kullaniciId: string; veri: UyeliklerVerisi }>) {
  const { liste, gruplar, roller } = veri;
  // Anahtar tipi gelmeyen kimliği de kabul eder; onun için ad bulunmaz.
  const grupAdi = new Map<string | undefined, string>(
    gruplar.kayitlar.map((grup) => [grup.id, grup.etiket]),
  );
  const rolAdi = new Map<string | undefined, string>(
    roller.kayitlar.map((rol) => [rol.id, rol.etiket]),
  );
  return (
    <div className="flex flex-col gap-6">
      <ListeTablosu
        baslik="Üyelikler"
        liste={liste}
        basliklar={
          <>
            <th scope="col" className={HUCRE}>
              Grup
            </th>
            <th scope="col" className={HUCRE}>
              Rol
            </th>
            <th scope="col" className={HUCRE}>
              Verilme zamanı
            </th>
            <th scope="col" className={HUCRE}>
              İşler
            </th>
          </>
        }
      >
        {liste.kayitlar.map((kayit) => (
          <tr key={kayit.id} className="border-b border-gray-200">
            <td className="px-3 py-2">{grupAdi.get(kayit.grupId) ?? BOS}</td>
            <td className="px-3 py-2">{rolAdi.get(kayit.rolId) ?? BOS}</td>
            <td className="px-3 py-2">
              {kayit.olusturmaZamani === undefined
                ? BOS
                : tarihSaat(kayit.olusturmaZamani)}
            </td>
            <td className="px-3 py-2">
              <UyelikKaldir kayit={kayit} />
            </td>
          </tr>
        ))}
      </ListeTablosu>
      {liste.sonrakiVar && <p className="text-sm">İlk 100 üyelik gösteriliyor</p>}
      <Can I="olustur" a="Uyelik">
        <UyelikVerFormu kullaniciId={kullaniciId} gruplar={gruplar} roller={roller} />
      </Can>
    </div>
  );
}
