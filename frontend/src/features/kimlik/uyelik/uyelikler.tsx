import { tarihSaat } from '../../../shared/bicim/bicim';
import { BOS, kimliginAdi, ListeTablosu } from '../../../shared/liste/liste-parcalari';
import { Can, Kolon } from '../../../shared/yetki/yetki-saglayici';
import { AlinamayanListeler } from '../alinamayan-listeler';
import { adHaritasi } from '../yetenek/yetenek-bicimi';
import { UyelikKaldir, UyelikVerFormu } from './uyelik-isleri';
import type { Uyelikler as UyeliklerVerisi } from './uyelik-listesi';

// Kullanıcı sayfasındaki üyelikler tablosu ve üyelik ver formu (TS-004 "Yönetim ekranları"). Grup
// ve rol adı listelerden eşlenir; adı bulunamayan kimlik kısaltılarak görünür. Kişinin tür düzeyinde
// okuyamadığı kolon çizilmez; çizilen kolonda alanı gelmeyen kaydın hücresi boş işarettir. Grup ya
// da rol listesi alınamadıysa tablo yine çizilir, form yerine ileti çıkar (TS-004 "Yönetim
// formlarının sertleştirilmesi"). Form tür düzeyinde sorulur. Sunucu bileşenidir.

const HUCRE = 'px-3 py-2 text-left';
const KAYNAK = 'Uyelik';

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
            <Kolon a={KAYNAK} alanlar={['grupId']}>
              <th scope="col" className={HUCRE}>
                Grup
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['rolId']}>
              <th scope="col" className={HUCRE}>
                Rol
              </th>
            </Kolon>
            <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
              <th scope="col" className={HUCRE}>
                Verilme zamanı
              </th>
            </Kolon>
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
              <Kolon a={KAYNAK} alanlar={['grupId']}>
                <td className="px-3 py-2">{grup}</td>
              </Kolon>
              <Kolon a={KAYNAK} alanlar={['rolId']}>
                <td className="px-3 py-2">{rol}</td>
              </Kolon>
              <Kolon a={KAYNAK} alanlar={['olusturmaZamani']}>
                <td className="px-3 py-2">
                  {kayit.olusturmaZamani === undefined
                    ? BOS
                    : tarihSaat(kayit.olusturmaZamani)}
                </td>
              </Kolon>
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
