'use client';

import { startTransition, type SubmitEvent, useActionState, useRef, useState } from 'react';
import { GonderDugmesi } from '../../../shared/ui/gonder-dugmesi';
import { Can } from '../../../shared/yetki/yetki-saglayici';
import { BOS_FORM_DURUMU } from '../form-durumu';
import { GenelHata } from '../is-parcalari';
import { SecimAlani } from '../uyelik/uyelik-isleri';
import type { YetenekSecenekleri } from './yetenek-listesi';
import { yetenekYaz, yetenekYenile } from './yetenek-eylemleri';
import {
  DEGER_TURLERI,
  DEGER_TURU_ETIKETLERI,
  type FormSatiri,
  ISLECLER,
  LISTELI_ISLECLER,
  type SaklananSatir,
  type SartSatiri,
  YER_TUTUCULAR,
} from './yetenek-sarti';

// Yetenek yaz ve yenile formları (TS-004 "Yönetim ekranları" ve form kuralları). İçerik alanları
// denetimlidir; böylece sınırı boş kalan yeteneğin uyarısı yazarken görünür. Alan ve kolon adlarını
// ekran bilmez; hatayı backend söyler.
//
// Çatı, action ile gönderilen formu iş bitince sıfırlar; denetimli seçim de ilk seçeneğine döner ve
// durumu değişmediği için yeniden eşlenmez (işleç ekranda 'esit' görünür, sonraki gönderim onu
// yollar). Bu yüzden iki form onSubmit ile, geçiş içinde ve sıfırlamasız gönderilir (React belgesi:
// "Skip the reset with onSubmit"); gönderim sürerken düğme yine kapalıdır. action da verilir:
// hidrasyondan önce ya da JavaScript'siz form Server Action'a POST ile gider; hidrasyondan sonra
// onSubmit varsayılanı engellediği için React action'ı çalıştırmaz ve formu sıfırlamaz.
function sifirlamadanGonder(eylem: (form: FormData) => void) {
  return (olay: SubmitEvent<HTMLFormElement>) => {
    olay.preventDefault();
    const form = new FormData(olay.currentTarget);
    startTransition(() => {
      eylem(form);
    });
  };
}

const GIRDI =
  'rounded border border-gray-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';
const IKINCIL_DUGME =
  'self-start rounded border border-gray-500 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

// sakliKolonlar: virgülle yazılınca kaybolacak kolon listesi; salt okunur gösterilir ve aynen gider.
export interface YetenekIcerigi {
  readonly sart: readonly FormSatiri[];
  readonly butunKayitlar: boolean;
  readonly butunBirimler: boolean;
  readonly kolonlar: string;
  readonly sakliKolonlar: readonly string[] | null;
  readonly butunKolonlar: boolean;
}

const BOS_ICERIK: YetenekIcerigi = {
  sart: [],
  butunKayitlar: false,
  butunBirimler: false,
  kolonlar: '',
  sakliKolonlar: null,
  butunKolonlar: false,
};

// Satırın anahtarı listede kalıcıdır; satır çıkarılınca öbürlerinin durumu kaymaz.
type AnahtarliSatir<S extends FormSatiri = FormSatiri> = S & { readonly anahtar: number };

function Kutu({
  ad,
  etiket,
  isaretli,
  degistir,
}: Readonly<{ ad: string; etiket: string; isaretli: boolean; degistir: (deger: boolean) => void }>) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={ad}
        name={ad}
        type="checkbox"
        checked={isaretli}
        onChange={(olay) => {
          degistir(olay.target.checked);
        }}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      />
      <label htmlFor={ad} className="font-medium">
        {etiket}
      </label>
    </div>
  );
}

// Satırın hatası satırın altında görünür; hatalı girdi işaretlidir ve iletiye bağlıdır.
function SartSatirAlanlari({
  sira,
  satir,
  alanHatasi,
  degerHatasi,
  degistir,
  cikar,
}: Readonly<{
  sira: number;
  satir: AnahtarliSatir<SartSatiri>;
  alanHatasi: string | undefined;
  degerHatasi: string | undefined;
  degistir: (satir: AnahtarliSatir<SartSatiri>) => void;
  cikar: () => void;
}>) {
  const kimlik = `sart-${String(satir.anahtar)}`;
  const hataKimligi = `${kimlik}-hata`;
  const listeli = LISTELI_ISLECLER.includes(satir.islec);
  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-300 p-3">
      <legend className="font-medium">{`${String(sira + 1)}. şart`}</legend>
      <label htmlFor={`${kimlik}-alan`}>Alan</label>
      <input
        id={`${kimlik}-alan`}
        name="sartAlan"
        type="text"
        autoComplete="off"
        value={satir.alan}
        onChange={(olay) => {
          degistir({ ...satir, alan: olay.target.value });
        }}
        aria-invalid={alanHatasi !== undefined}
        aria-describedby={alanHatasi === undefined ? undefined : hataKimligi}
        className={GIRDI}
      />
      <label htmlFor={`${kimlik}-islec`}>İşleç</label>
      <select
        id={`${kimlik}-islec`}
        name="sartIslec"
        value={satir.islec}
        onChange={(olay) => {
          const islec = ISLECLER.find((ad) => ad === olay.target.value);
          if (islec !== undefined) {
            degistir({ ...satir, islec });
          }
        }}
        className={GIRDI}
      >
        {ISLECLER.map((islec) => (
          <option key={islec} value={islec}>
            {islec}
          </option>
        ))}
      </select>
      <label htmlFor={`${kimlik}-tur`}>Değer türü</label>
      <select
        id={`${kimlik}-tur`}
        name="sartTur"
        value={satir.tur}
        onChange={(olay) => {
          const tur = DEGER_TURLERI.find((ad) => ad === olay.target.value);
          if (tur !== undefined) {
            // Yer tutucu seçimi ile yazılan değer birbirine çevrilmez; tür o sınırı geçince değer
            // boşalır.
            const sinirGecildi = (tur === 'yerTutucu') !== (satir.tur === 'yerTutucu');
            degistir({ ...satir, tur, deger: sinirGecildi ? '' : satir.deger });
          }
        }}
        className={GIRDI}
      >
        {DEGER_TURLERI.map((tur) => (
          <option key={tur} value={tur}>
            {DEGER_TURU_ETIKETLERI[tur]}
          </option>
        ))}
      </select>
      <label htmlFor={`${kimlik}-deger`}>
        {listeli && satir.tur !== 'yerTutucu' ? 'Değer (virgülle ayrılmış)' : 'Değer'}
      </label>
      {satir.tur === 'yerTutucu' ? (
        <select
          id={`${kimlik}-deger`}
          name="sartDeger"
          value={satir.deger}
          onChange={(olay) => {
            degistir({ ...satir, deger: olay.target.value });
          }}
          aria-invalid={degerHatasi !== undefined}
          aria-describedby={degerHatasi === undefined ? undefined : hataKimligi}
          className={GIRDI}
        >
          <option value="">Seç</option>
          {YER_TUTUCULAR.map((yerTutucu) => (
            <option key={yerTutucu} value={yerTutucu}>
              {yerTutucu}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`${kimlik}-deger`}
          name="sartDeger"
          type="text"
          autoComplete="off"
          value={satir.deger}
          onChange={(olay) => {
            degistir({ ...satir, deger: olay.target.value });
          }}
          aria-invalid={degerHatasi !== undefined}
          aria-describedby={degerHatasi === undefined ? undefined : hataKimligi}
          className={GIRDI}
        />
      )}
      <HataIletisi kimlik={hataKimligi} ileti={alanHatasi ?? degerHatasi} />
      <button type="button" onClick={cikar} className={IKINCIL_DUGME}>
        {`${String(sira + 1)}. şartı çıkar`}
      </button>
    </fieldset>
  );
}

// Saklanan şart öğesi (TS-004 "Yönetim formlarının sertleştirilmesi"): düzenleme girdisi taşımaz;
// saklandığı yazımla gösterilir, gizli alanlarla aynen gider ve yalnız çıkarılabilir.
function SaklananSatirAlani({
  sira,
  satir,
  hata,
  cikar,
}: Readonly<{
  sira: number;
  satir: AnahtarliSatir<SaklananSatir>;
  hata: string | undefined;
  cikar: () => void;
}>) {
  const { alan, islec, deger } = satir.oge;
  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-300 p-3">
      <legend className="font-medium">{`${String(sira + 1)}. şart`}</legend>
      <input type="hidden" name="sartAlan" value={alan} />
      <input type="hidden" name="sartIslec" value={islec} />
      <input type="hidden" name="sartTur" value="saklanan" />
      <input type="hidden" name="sartDeger" value={JSON.stringify(deger)} />
      <code className="break-all">{JSON.stringify(satir.oge)}</code>
      <p className="text-sm">Bu şart formda düzenlenemez; yalnız çıkarılabilir</p>
      <HataIletisi kimlik={`sart-${String(satir.anahtar)}-hata`} ileti={hata} />
      <button type="button" onClick={cikar} className={IKINCIL_DUGME}>
        {`${String(sira + 1)}. şartı çıkar`}
      </button>
    </fieldset>
  );
}

function HataIletisi({ kimlik, ileti }: Readonly<{ kimlik: string; ileti: string | undefined }>) {
  if (ileti === undefined) {
    return null;
  }
  return (
    <p id={kimlik} role="alert" className="text-sm text-red-700">
      {ileti}
    </p>
  );
}

// Yaz ve yenile formlarının ortak içerik alanları; sınırı boş kalan yeteneğin uyarısı altta görünür.
function IcerikAlanlari({
  baslangic,
  alanHatalari,
}: Readonly<{ baslangic: YetenekIcerigi; alanHatalari: Readonly<Record<string, string>> }>) {
  const sonrakiAnahtar = useRef(baslangic.sart.length);
  const [satirlar, satirlariYap] = useState<readonly AnahtarliSatir[]>(() =>
    baslangic.sart.map((satir, anahtar) => ({ ...satir, anahtar })),
  );
  const [butunKayitlar, butunKayitlarYap] = useState(baslangic.butunKayitlar);
  const [butunBirimler, butunBirimlerYap] = useState(baslangic.butunBirimler);
  const [kolonlar, kolonlarYap] = useState(baslangic.kolonlar);
  const [sakliKolonlar, sakliKolonlariYap] = useState(baslangic.sakliKolonlar);
  const [butunKolonlar, butunKolonlarYap] = useState(baslangic.butunKolonlar);
  // Satır hatasının anahtarı gönderimdeki sıradır; yeni hatalar gelince o anki satır anahtarları
  // saklanır, böylece sonradan bir satır çıkarılınca hata başka satıra kaymaz.
  const [hataSirasi, hataSirasiYap] = useState(() => ({
    hatalar: alanHatalari,
    anahtarlar: satirlar.map((satir) => satir.anahtar),
  }));
  if (hataSirasi.hatalar !== alanHatalari) {
    hataSirasiYap({ hatalar: alanHatalari, anahtarlar: satirlar.map((satir) => satir.anahtar) });
  }
  const sartHatasi = alanHatalari['sart'];
  const kolonHatasi = alanHatalari['kolonlar'];
  return (
    <>
      <Kutu
        ad="butunKayitlar"
        etiket="Bütün kayıtlar"
        isaretli={butunKayitlar}
        degistir={butunKayitlarYap}
      />
      <fieldset
        aria-describedby={sartHatasi === undefined ? undefined : 'sart-hata'}
        className="flex flex-col gap-3"
      >
        <legend className="font-medium">Şart</legend>
        {satirlar.map((satir, sira) => {
          const onEk = `sart.${String(hataSirasi.anahtarlar.indexOf(satir.anahtar))}`;
          const cikar = () => {
            satirlariYap(satirlar.filter((eski) => eski.anahtar !== satir.anahtar));
          };
          return satir.tur === 'saklanan' ? (
            <SaklananSatirAlani
              key={satir.anahtar}
              sira={sira}
              satir={satir}
              hata={alanHatalari[`${onEk}.deger`]}
              cikar={cikar}
            />
          ) : (
            <SartSatirAlanlari
              key={satir.anahtar}
              sira={sira}
              satir={satir}
              alanHatasi={alanHatalari[`${onEk}.alan`]}
              degerHatasi={alanHatalari[`${onEk}.deger`]}
              degistir={(yeni) => {
                satirlariYap(satirlar.map((eski) => (eski.anahtar === yeni.anahtar ? yeni : eski)));
              }}
              cikar={cikar}
            />
          );
        })}
        <button
          type="button"
          onClick={() => {
            const anahtar = sonrakiAnahtar.current;
            sonrakiAnahtar.current += 1;
            satirlariYap([
              ...satirlar,
              { anahtar, alan: '', islec: 'esit', tur: 'metin', deger: '' },
            ]);
          }}
          className={IKINCIL_DUGME}
        >
          Şart ekle
        </button>
        <HataIletisi kimlik="sart-hata" ileti={sartHatasi} />
      </fieldset>
      <Kutu
        ad="butunBirimler"
        etiket="Bütün birimler"
        isaretli={butunBirimler}
        degistir={butunBirimlerYap}
      />
      <Kutu
        ad="butunKolonlar"
        etiket="Bütün kolonlar"
        isaretli={butunKolonlar}
        degistir={butunKolonlarYap}
      />
      {sakliKolonlar === null ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="kolonlar" className="font-medium">
            Kolonlar (virgülle ayrılmış)
          </label>
          <input
            id="kolonlar"
            name="kolonlar"
            type="text"
            autoComplete="off"
            value={kolonlar}
            onChange={(olay) => {
              kolonlarYap(olay.target.value);
            }}
            aria-invalid={kolonHatasi !== undefined}
            aria-describedby={kolonHatasi === undefined ? undefined : 'kolonlar-hata'}
            className={GIRDI}
          />
          <HataIletisi kimlik="kolonlar-hata" ileti={kolonHatasi} />
        </div>
      ) : (
        // Virgülle yazılınca kaybolacak liste: saklandığı yazımla gösterilir ve aynen gider;
        // Değiştir boş bir girdiyle baştan yazdırır.
        <div className="flex flex-col gap-1">
          <p className="font-medium">Kolonlar</p>
          {sakliKolonlar.map((kolon, sira) => (
            <input key={sira} type="hidden" name="sakliKolon" value={kolon} />
          ))}
          <code className="break-all">{JSON.stringify(sakliKolonlar)}</code>
          <p className="text-sm">Bu kolon listesi formda düzenlenemez; değiştirirsen baştan yazılır</p>
          <HataIletisi kimlik="kolonlar-hata" ileti={kolonHatasi} />
          <button
            type="button"
            onClick={() => {
              sakliKolonlariYap(null);
            }}
            className={IKINCIL_DUGME}
          >
            Değiştir
          </button>
        </div>
      )}
      <div role="status" className="flex flex-col gap-1 text-sm">
        {!butunKayitlar && satirlar.length === 0 && (
          <p>Kayıt sınırı boş: bu yetenek kayıt vermez</p>
        )}
        {!butunKolonlar && sakliKolonlar === null && kolonlar.trim() === '' && (
          <p>Kolon sınırı boş: bu yetenek kolon vermez</p>
        )}
      </div>
    </>
  );
}

// Öncelik metin olarak gider; boşsa gövdeye girmez.
function OncelikAlani({
  baslangic,
  hata,
}: Readonly<{ baslangic: string; hata: string | undefined }>) {
  const [oncelik, oncelikYap] = useState(baslangic);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="oncelik" className="font-medium">
        Öncelik
      </label>
      <input
        id="oncelik"
        name="oncelik"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={oncelik}
        onChange={(olay) => {
          oncelikYap(olay.target.value);
        }}
        aria-invalid={hata !== undefined}
        aria-describedby={hata === undefined ? undefined : 'oncelik-hata'}
        className={GIRDI}
      />
      <p className="text-sm">
        0 ile 100 arasında bir tam sayı; büyük olan kazanır
      </p>
      <HataIletisi kimlik="oncelik-hata" ileti={hata} />
    </div>
  );
}

// Yazılırken seçilen etki ve öncelik (TS-008 "Yönetim, izinler ve teşhis"); yasak seçilince yasağın
// sınırlarını anlatan yardım metni görünür (TS-008 "Hata modları").
function EtkiAlanlari({
  alanHatalari,
}: Readonly<{ alanHatalari: Readonly<Record<string, string>> }>) {
  const [etki, etkiYap] = useState('izin');
  const hata = alanHatalari['giremez'];
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="giremez" className="font-medium">
          Etki
        </label>
        <select
          id="giremez"
          name="giremez"
          value={etki}
          onChange={(olay) => {
            etkiYap(olay.target.value);
          }}
          aria-invalid={hata !== undefined}
          aria-describedby={hata === undefined ? undefined : 'giremez-hata'}
          className={GIRDI}
        >
          <option value="izin">İzin</option>
          <option value="yasak">Yasak</option>
        </select>
        <HataIletisi kimlik="giremez-hata" ileti={hata} />
      </div>
      {etki === 'yasak' && (
        <div
          role="note"
          aria-label="Yasağın sınırları"
          className="flex flex-col gap-1 text-sm"
        >
          <p>
            Yasak bir kara listedir: modele sonradan eklenen kolonu kapsamaz.
          </p>
          <p>
            Her zaman kapalı kalması gereken yerde kaydın bütününü kapatan bir
            yasak yaz, açılacak dar izni bir üst öncelikte ver.
          </p>
          <p>
            Öncelik 0 ile yazılan yasak öncelik 0&apos;daki izinleri kapatır;
            yasağı aşacak izin daha yüksek öncelikle yazılır.
          </p>
          <p>
            Yasak her eylem için ayrıca yazılır: okuma yasağı yazmayı
            kısıtlamaz.
          </p>
          <p>
            Okuma yasağı bir işin baktığı kolona denk gelirse o iş de dolaylı
            olarak kapanır.
          </p>
          <p>
            Şartı kişinin göremediği bir kolona bakan yazma yasağı, o kolonun
            değerini ret cevabından ele verebilir.
          </p>
        </div>
      )}
      <OncelikAlani baslangic="" hata={alanHatalari['oncelik']} />
    </>
  );
}

// Başarıda Server Action yeni yeteneğin kayıt sayfasına yönlendirir. Etki ve öncelik yalnız yasakla
// izni olan kişiye çizilir; öbür kişinin formu ve gövdesi bu alanları taşımaz.
export function YetenekYazFormu({ secenekler }: Readonly<{ secenekler: YetenekSecenekleri }>) {
  const [durum, eylem] = useActionState(yetenekYaz, BOS_FORM_DURUMU);
  return (
    <form action={eylem} onSubmit={sifirlamadanGonder(eylem)} className="flex flex-col gap-4">
      <GenelHata ileti={durum.genelHata} />
      <SecimAlani
        ad="grupId"
        etiket="Grup"
        secenekler={secenekler.gruplar}
        fazlasiNotu="İlk 100 grup gösteriliyor"
        hata={durum.alanHatalari['grupId']}
        varsayilan={durum.degerler?.['grupId']}
      />
      <SecimAlani
        ad="rolId"
        etiket="Rol"
        secenekler={secenekler.roller}
        fazlasiNotu="İlk 100 rol gösteriliyor"
        hata={durum.alanHatalari['rolId']}
        varsayilan={durum.degerler?.['rolId']}
      />
      <SecimAlani
        ad="izinId"
        etiket="İzin"
        secenekler={secenekler.izinler}
        fazlasiNotu="İlk 100 izin gösteriliyor"
        hata={durum.alanHatalari['izinId']}
        varsayilan={durum.degerler?.['izinId']}
      />
      <Can I="yasakla" a="Yetenek">
        <EtkiAlanlari alanHatalari={durum.alanHatalari} />
      </Can>
      <IcerikAlanlari baslangic={BOS_ICERIK} alanHatalari={durum.alanHatalari} />
      <GonderDugmesi>Yeteneği yaz</GonderDugmesi>
    </form>
  );
}

// Grup, rol ve izin değişmez; form var olan içerikle dolu gelir. Başarıda Server Action yeni satırın
// kayıt sayfasına yönlendirir. Yasakla izni olan kişi önceliği değiştirebilir; etki çevrilemez
// (KU-020), salt okunur görünür ve gövdeye girmez. Kayıtta gelmeyen etki gösterilmez; gelmeyen öncelik
// boş açılır ve boş öncelik gönderilmediği için backend eskisini korur.
export function YetenekYenileFormu({
  id,
  baslangic,
  giremez,
  oncelik,
}: Readonly<{
  id: string;
  baslangic: YetenekIcerigi;
  giremez: boolean | undefined;
  oncelik: number | undefined;
}>) {
  const [durum, eylem] = useActionState(yetenekYenile, BOS_FORM_DURUMU);
  return (
    <form
      action={eylem}
      onSubmit={sifirlamadanGonder(eylem)}
      aria-label="Yenile"
      className="flex flex-col gap-4"
    >
      <h2 className="text-2xl font-bold">Yenile</h2>
      <GenelHata ileti={durum.genelHata} />
      <input type="hidden" name="id" value={id} />
      <Can I="yasakla" a="Yetenek">
        {giremez !== undefined && (
          <p>{`Etki: ${giremez ? 'Yasak' : 'İzin'} (değiştirilemez)`}</p>
        )}
        <OncelikAlani
          baslangic={oncelik === undefined ? '' : String(oncelik)}
          hata={durum.alanHatalari['oncelik']}
        />
      </Can>
      <IcerikAlanlari baslangic={baslangic} alanHatalari={durum.alanHatalari} />
      <GonderDugmesi>Yenile</GonderDugmesi>
    </form>
  );
}
