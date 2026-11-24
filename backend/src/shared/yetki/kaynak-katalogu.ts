// Kaynak türünün adından o türün alan adlarına; bilinmeyen tür için undefined.
export interface KaynakKatalogu {
  alanlar(tur: string): readonly string[] | undefined;
}
