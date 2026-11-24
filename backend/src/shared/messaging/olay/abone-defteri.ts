// Hangi tüketicinin hangi olayı dinlediğinin süreç içi kaydı (KR-012 Kural 4). Tüketicinin adı
// aynı zamanda kendi kuyruğunun adıdır (KR-012 Seçim 1). İşleyiciler burada tutulmaz.
export class AboneDefteri {
  // Tüketici adı -> dinlediği olayın adı.
  private readonly tuketiciler = new Map<string, string>();

  bildir(tuketici: string, olay: string): void {
    if (this.tuketiciler.has(tuketici)) {
      throw new Error(`${tuketici} tüketicisi zaten bildirildi`);
    }
    this.tuketiciler.set(tuketici, olay);
  }

  // Olayı dinleyen tüketicilerin (yani kuyrukların) adları; dinleyen yoksa boş liste.
  dinleyenler(olay: string): string[] {
    return [...this.tuketiciler]
      .filter(([, dinlenen]) => dinlenen === olay)
      .map(([tuketici]) => tuketici);
  }
}
