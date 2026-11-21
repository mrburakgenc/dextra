---
kimlik: KU-003
tur: kural
durum: taslak
surum: 1
baslik: Her oturum ve her görev kendi çalışma ağacında çalışır
dayanak: [KR-002@1]
olay: [oturum]
baglama: kapsam
bicim: kural
kesinlik: kesin
denetim_duzey: gozden-gecirme
bakis: 2027-02-20
---
Ana çalışma ağacında dosya düzenlenmez: oturum işe başlamadan kendi çalışma ağacına geçer, ayrı oturuma verilen her görev de kendi ağacında ve kendi dalında koşar.

## Neden
Aynı klasörü paylaşan oturumlar birbirinin yarım işini görür; yalıtılmış ağaçta neyin değiştiği git farkından kesin olarak ölçülür.

## İhlal örneği
Ana çalışma ağacında açılmış bir oturumun doğrudan kaynak dosyasını düzenlemesi ya da iki görevin aynı klasörde yan yana koşturulması.

## Uygun örnek
Oturumun önce `EnterWorktree` ile kendi ağacına geçmesi; bir görevin `python3 harness/h.py gorev kos GV-012` ile kendi ağacında koşturulması.
