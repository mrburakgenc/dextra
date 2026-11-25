// Saklanan kapatılma nedenleri (TS-002 "Veri modeli").
export type KapatilmaNedeni =
  | 'cikis'
  | 'sahibi_kapatti'
  | 'yonetici'
  | 'pasife_alma'
  | 'parola_degisimi'
  | 'giris_bilgisi_degisti'
  | 'yetki_yukseltme'
  | 'sure'
  | 'yeniden_kullanim'
  | 'tutarsiz_nesil'
  | 'oturum_siniri'
  | 'adres_degisti'
  | 'cihaz_uymadi'
  | 'yontem_kapandi'
  | 'unutma';
