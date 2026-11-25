// Belirteç, okuma arayüzünü ve onu genişleten tam arayüzü yalnız tip olarak taşır (KR-011 Yazım biçimi).
export class RepoBelirteci<TOkuma, TTam extends TOkuma> {
  declare private readonly okumaTipi: TOkuma;
  declare private readonly tamTipi: TTam;

  constructor(readonly ad: string) {}
}
