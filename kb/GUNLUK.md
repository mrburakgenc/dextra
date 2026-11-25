# Bilgi tabanı günlüğü

Yalnız eklenir; satırları araç yazar (`h.py yeni`, `h.py kabul`). Son kayıtlar: `grep '^## \[' kb/GUNLUK.md | tail -5`

## [2026-11-21] kabul | KR-001@1 Kurallar ve kararlar bu depoda zincir olarak tutulur
## [2026-11-21] kabul | KR-002@1 Her iş kendi çalışma ağacında yapılır ve onu yapmayan bir oturumca incelenir
## [2026-11-21] kabul | KR-003@1 Kod yazan ajan yalnız isteneni, en sade hâliyle yapar
## [2026-11-21] kabul | KU-001@1 Kabulü yalnız kullanıcı verir
## [2026-11-21] kabul | KU-002@1 Kapılar atlanmaz
## [2026-11-21] kabul | KU-003@1 Her oturum ve her görev kendi çalışma ağacında çalışır
## [2026-11-21] kabul | KU-004@1 İş incelenmeden alınmaz; işaret ve ölçüm kaydı elle yazılmaz
## [2026-11-21] kabul | KU-005@1 Önce sadelik
## [2026-11-21] kabul | KU-006@1 Cerrahi değişiklik
## [2026-11-21] taslak | TS-001 Çok projeli base mimarisi: feature tabanlı monolith (backend, web, mobil)
## [2026-11-21] taslak | KR-004 Yığın: üç yüzeyde TypeScript, BADI ile aynı çatılar
## [2026-11-21] taslak | KU-007 Feature'lar birbirini doğrudan içe aktarmaz
## [2026-11-21] taslak | KR-005 Backend modular monolith ve dikey dilim mimarisidir; bounded context = feature
## [2026-11-21] taslak | KU-008 Katman bağımlılık yönü presentation, application, domain sırasındadır
## [2026-11-21] taslak | KU-009 Çapraz kesen yetenekler yalnız shared altında yaşar
## [2026-11-21] taslak | KR-006 Depo düzeni: backend ve frontend tek pnpm workspace, mobil ayrı kök
## [2026-11-21] taslak | KR-007 Yetkilendirme ABAC'tır ve repository'de çözülür
## [2026-11-21] taslak | KU-010 Guard zincirinin sırası sabittir
## [2026-11-21] taslak | KU-011 Her endpoint tam bir yetki dekoratörü taşır
## [2026-11-21] taslak | KU-012 Yetki repository'de çözülür; handler yetki kodu yazmaz
## [2026-11-21] taslak | KU-013 requesterId istek gövdesinden okunmaz
## [2026-11-21] taslak | KU-014 Rol kalıtımı yoktur; her rol iznini açıkça taşır
## [2026-11-21] taslak | KU-015 İzin değişikliği sürümlü göçle yapılır
## [2026-11-22] taslak | KR-008 Yetki sınırı grup, rol ve izni birleştiren yetenek satırında durur
## [2026-11-23] taslak | KR-009 Oturum beyaz listeyle doğrulanır; belirteç yalnız kimliği taşır
## [2026-11-23] taslak | KR-010 Şartı yalnız veritabanı değerlendirir; derlenmiş yetki sürüm damgasıyla saklanır
## [2026-11-23] taslak | KR-011 Veri erişimi Unit of Work'ün iki kapısından geçer; her çağrı kendi örneğini alır
## [2026-11-24] taslak | KR-012 Olay outbox'tan geçer, her tüketicinin kendi kuyruğu vardır ve tüketici sistem aktörüyle çalışır
## [2026-11-24] taslak | KR-013 İz kayıtları outbox'tan geçer ve ayrı veritabanında durur; günlük kişisel veri taşımaz
## [2026-11-24] taslak | KR-014 Frontend kanondaki kurallarla kurulur; doğrulama iki tarafta da Zod'dur ve form taslağı saklanmaz
## [2026-11-24] taslak | TS-002 Kimlik feature'ı: tablolar, alt özellikler ve ortak kodla arayüzler
## [2026-11-24] taslak | TS-003 Outbox, iz aktarımı ve olay yolu: tablolar, aktarıcı sözleşmesi ve kuyruğun yeri
## [2026-11-24] taslak | TS-004 Web arayüzü: aracı katman, oturum çerezleri, ilk ekranlar ve dosya düzeni
## [2026-11-25] taslak | TS-005 Kimlik alt özelliklerinin kanondaki katman düzenine çekilmesi: komut ve sorgu klasörleri, domain kuralları, repository arayüzleri
## [2026-11-25] taslak | KR-015 Alınan her iş raporla kapanır; raporu olmayan iş gönderilemez
## [2026-11-25] taslak | KU-016 Alınan her görev gönderilmeden önce bir raporda yer alır; görev tablosunu araç üretir
## [2026-11-25] taslak | DN-001 Raporsuz görev denetimi: dalda alınan her görev bir raporda geçer
## [2026-11-25] taslak | TS-006 Aracın boşluklarının kapatılması: uyarılar, denetimler, görev yaşam döngüsü ve rapor
## [2026-11-25] taslak | DN-002 Yapı denetimi: alt özellikler ve ortak kod kanondaki katman düzenindedir
## [2026-11-25] taslak | TS-007 Yetkinin kayıt katmanı repository'de uygulanır: sorgu repository'de, süzgeç yetki yüzünden
## [2026-11-25] taslak | TS-008 Yetenekte öncelik: aynı kaydı tutan yeteneklerden önceliği yüksek olan tek başına geçerlidir
