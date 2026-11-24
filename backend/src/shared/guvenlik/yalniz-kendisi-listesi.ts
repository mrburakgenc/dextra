// "Yalnız kendisi" işaretli uçların sayılı listesi (TS-002 AK-33; KR-008 Seçim 46). Listede adı
// olmayan bir uç bu işareti taşırsa açılış denetimi uygulamayı açtırmaz. Öğe, ucun `Sinif.yontem`
// adıdır (açılış denetiminin hata iletisindeki ad).
export const YALNIZ_KENDISI_UCLARI: readonly string[] = [
  'OturumController.cikis',
  'OturumController.yetkilerim',
];

// Listeyi açılış denetimine veren belirteç; GuvenlikModule yukarıdaki listeyi bağlar.
export const YALNIZ_KENDISI_LISTESI = Symbol('YALNIZ_KENDISI_LISTESI');
