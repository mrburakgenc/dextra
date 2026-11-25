---
kimlik: KU-018
tur: kural
durum: taslak
surum: 1
baslik: Kök yöneticinin sistem izinleri yasakla kapatılmaz
dayanak: [KR-016@1]
kapsam: [backend/src/shared/yetki/**, backend/src/features/kimlik/_shared/**, frontend/src/shared/yetki/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-11-25
---
Kök yönetici rolünün sistem satırı olan izinleri hiçbir yasakla kapatılmaz: yasak bu izinlerin satır koşuluna, kolonlarına ve yazma adaylığına uygulanmaz; ekrana verilen kural sırası da aynı sonucu verir. Başka hiçbir satır muaf değildir.

## Neden
Kullanıcı (2026-11-25): SuperAdmin yasakla kapatılamasın; muafiyet yalnız onun sistem yetenekleriyle sınırlı olsun. Kök yönetici herkesin taşıdığı temel üyeliği de taşır; ona düşen bir yasak yöneticiyi kilitleyebilirdi.

## İhlal örneği
Temel role yazılan "yetenekleri okuma, giremez" yasağının kök yöneticinin yetenek ekranını da boşaltması; ya da muafiyetin bütün sistem satırlarına (temel rolün satırlarına, projelerin tohumladığı satırlara) genişletilmesi.

## Uygun örnek
Aynı yasak varken kök yönetici bütün yetenekleri ve kolonları görür ve yasağı silebilir; temel rolün sistem satırından gelen izin ise yasakla kapanır (TS-008 Senaryo 5).

## Alım notu
- Kural uygulanmadan önce yazıldı (TS-008 "Aşamalar"). Muafiyetin veriyle tanımı (kök grup, rol kodu, sistem satırı) uygulama görevinde kesinleşir.
