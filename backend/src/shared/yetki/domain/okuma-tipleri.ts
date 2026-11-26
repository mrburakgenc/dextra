// Kapının döndürdüğü kayıt: yalnız isteyenin görebildiği kolonlar.
export type Kayit = Readonly<Record<string, unknown>>;

export interface Siralama {
  readonly alan: string;
  readonly yon: 'artan' | 'azalan';
}

// Teşhisin cevabı (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-14, AU-19 ve AU-32): bir kişinin bir
// eylem ve kaynakta, bir kayıt için kuralları ve kararı. Kaydın kolon değerleri yoktur.
export interface TeshisKurali {
  readonly yetenekId: string;
  readonly etki: 'izin' | 'yasak';
  readonly oncelik: number;
  // Bütün kolonlar işaretliyse kolon listesi boştur.
  readonly butunKolonlar: boolean;
  readonly kolonlar: readonly string[];
  readonly muaf: boolean;
  readonly bozuk: boolean;
  // Şartı, soranın o kayıtta göremediği bir kolona baktığı için sorulmadı: tutuyor ya da tutmuyor
  // denmez.
  readonly degerlendirilemedi: boolean;
}

// Kararı veren kuralın yetenek kimliği; o kişide kolonu ya da kaydı veren izin yoksa boş. Karar
// değerlendirilemeyen bir kurala bağlıysa belirsizdir: açık mı boştur ve kararVeren o kuraldır.
export interface TeshisKarari {
  readonly acik: boolean | null;
  readonly kararVeren: string | null;
}

export interface Teshis {
  // Kişinin o eylem ve kaynakta kaydı tutan ve değerlendirilemeyen kuralları, derlendikleri sırayla.
  readonly tutanKurallar: readonly TeshisKurali[];
  // Kaynağın her kolonu için, kataloğun sırasıyla.
  readonly kolonKararlari: readonly (TeshisKarari & {
    readonly kolon: string;
  })[];
  // Kayıt o kişiye geliyor mu: kimlik kolonunun kararıdır.
  readonly kayitKarari: TeshisKarari;
}
