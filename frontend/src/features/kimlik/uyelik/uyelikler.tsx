import { tarihSaat } from '../../../shared/bicim/bicim';
import { BOS, kimliginAdi, ListeTablosu } from '../../../shared/liste/liste-parcalari';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { AlinamayanListeler } from '../alinamayan-listeler';
import { adHaritasi } from '../yetenek/yetenek-bicimi';
import { UyelikKaldir, UyelikVerFormu } from './uyelik-isleri';
import type { Uyelikler as UyeliklerVerisi } from './uyelik-listesi';

// Kullanıcı sayfasındaki üyelikler tablosu ve üyelik ver formu (TS-004 "Yönetim ekranları"). Grup
// ve rol adı listelerden eşlenir; adı bulunamayan kimlik kısaltılarak, gelmeyen kolon boş işaretle
// görünür. Grup ya da rol listesi alınamadıysa tablo yine çizilir, form yerine ileti çıkar (TS-004
// "Yönetim formlarının sertleştirilmesi"). Form tür düzeyinde sorulur. Sunucu bileşenidir.

const HUCRE = 'px-3 py-2 text-left';

export function Uyelikler({
  kullaniciId,
  veri,
}: Readonly<{ kullaniciId: string; veri: UyeliklerVerisi }>) {
  const { liste, gruplar, roller } = veri;
  const grupAdi = adHaritasi(gruplar);
  const rolAdi = adHaritasi(roller);
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
        {liste.kayitlar.map((kayit) => {
          const grup = kimliginAdi(grupAdi, kayit.grupId);
          const rol = kimliginAdi(rolAdi, kayit.rolId);
          return (
            <tr key={kayit.id} className="border-b border-gray-200">
              <td className="px-3 py-2">{grup}</td>
              <td className="px-3 py-2">{rol}</td>
              <td className="px-3 py-2">
                {kayit.olusturmaZamani === undefined
                  ? BOS
                  : tarihSaat(kayit.olusturmaZamani)}
              </td>
              <td className="px-3 py-2">
                <UyelikKaldir kayit={kayit} grup={grup} rol={rol} />
              </td>
            </tr>
          );
        })}
      </ListeTablosu>
      {liste.sonrakiVar && <p className="text-sm">İlk 100 üyelik gösteriliyor</p>}
      <Can I="olustur" a="Uyelik">
        {gruplar !== null && roller !== null ? (
          <UyelikVerFormu kullaniciId={kullaniciId} gruplar={gruplar} roller={roller} />
        ) : (
          <AlinamayanListeler listeler={{ Grup: gruplar, Rol: roller }} />
        )}
      </Can>
    </div>
  );
}
