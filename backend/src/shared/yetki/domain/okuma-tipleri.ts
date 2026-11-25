// Kapının döndürdüğü kayıt: yalnız isteyenin görebildiği kolonlar.
export type Kayit = Readonly<Record<string, unknown>>;

export interface Siralama {
  readonly alan: string;
  readonly yon: 'artan' | 'azalan';
}
