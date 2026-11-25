---
name: kural
description: Bir kararın yükümlülüğünü kural taslağı olarak yazar; kabulü kullanıcı verir. Kullanıcı bir kural koymak ya da alınmış bir kararın sonucunu bağlayıcı hâle getirmek istediğinde kullan.
argument-hint: <yükümlülük>
---

Şu yükümlülük için bir kural taslağı hazırla: $ARGUMENTS

## Ne zaman

- Bir karar kabul edildi ve "bundan sonra şöyle yapılır" diyen bir sonucu var.
- Aynı hata ikinci kez yapıldı ve önleyecek bağlayıcı bir ifade gerekiyor.

## Ne zaman değil

- Dayanacağı karar yok: önce `karar`. Dayanağı olmayan kural kabul edilemez.
- Söylenen şey bir tercih ya da öneri: kural değil, rehber (`denetim_duzey: rehber`) ya da hiç yazma.

## Adımlar

1. Kuralın dayanacağı kararı bul.
2. Taslağı aç: `python3 harness/h.py yeni kural "<başlık>"`.
3. İlk paragrafa tek, bağlayıcı ifadeyi yaz: şöyle yapılır ya da yapılmaz. En çok 400 karakter.
4. Başlık alanlarını doldur:
   - `dayanak`: kararın kimliği ve sürümü, örnek `[KR-004@1]`.
   - Kapsam: bir yapı kimliği (`kapsam: [YP-003]`), bir katman (`kapsam_katman: [alan]`), bir yol deseni ya da bir olay (`olay: [push]`). Yeni dizinleri de kapsaması için önce yapı ve katmanı tercih et.
   - `rol`: kural yalnız bazı rollere gidecekse (`rol: [uygulayici, inceleyici]`).
   - `kesinlik`: her ajanın doğarken bilmesi gerekiyorsa `kesin`; değilse `olagan`.
   - `denetim_duzey`: önce kuralı yapıya taşımayı dene (çiğnenince derlenmesin); olmuyorsa `mekanik` ya da `test`; o da olmuyorsa `gozden-gecirme` ve bir `bakis` tarihi.
   - `denetim_ref` (mekanik kuralda): denetim düğümünün kimliği. Denetimin push kapısında koşması için o düğümün baş bloğuna `komut: <deponun kökünde çalışan kabuk komutu>` yazılır (aracın kendi denetimiyse `cesit: yerlesik`); komutu `python3 harness/h.py denetim kos <DN-NNN>` ile dene. Kapı yalnız kabul edilmiş kurala bağlı, kabul edilmiş denetimi koşturur. Köşeli parantezle başlayan komut tırnak içine yazılır (`komut: "[ -f harness.json ]"`); kabul edilmiş denetimin komutu değişirse sürümü de artar. Komut yalnız git'in push kapısında (`denetle --dal`) koşar, ajanın push kancasında koşmaz; kapı kesilirse komutun süreç grubu da durdurulur, ama kendi oturumunu açan torun süreç izlenemez.
5. Kesin kuralda "İhlal örneği" ve "Uygun örnek" bölümlerini somut yaz. Karara bağlanmamış bir nokta kalırsa onu "belgede yok" ya da "kullanıcıya sorulacak" diye düz metne yazma; açık uç olarak ekle: `python3 harness/h.py acik-uc ekle KU-NNN "<soru>"` (iş o noktaya gelince soru kullanıcıya gider).
6. `python3 harness/h.py denetle` ile kontrol et; kuralın hangi dosyalara düştüğünü `python3 harness/h.py sor <KİMLİK>` ile göster.
7. Kullanıcıya kuralı özetle ve kabul etmek isteyip istemediğini sor. İsterse `python3 harness/h.py kabul <KİMLİK>` çalıştır (kararı da taslaksa onu da aynı komuta yaz); hook taslağı kullanıcıya gösterip sorar. Kimlikleri kullanıcıya yazdırma, komutu sen çalıştır.

## Yapma

- Düğümü dosyada elle kabul durumuna getirme ve kullanıcı istemeden kabul komutunu çalıştırma.
- "Her", "hiçbir", "asla" yazıp bırakma: kapsamı bir sınıfla tanımla ya da kararın istisna yoluna bağla.
- Örneği yazılamayan kesin kural yazma: örneği yoksa denetlenemez.
- Her şeyi kesin yapma: kesin kurallar her ajanın bağlamına girer ve bütçesi sınırlıdır.

## İlgili skill'ler

- `karar`: kuralın dayanağı.
- `kb-tara`: kurallar arası çelişkiyi ve bayat kuralı arar.

## Sınırlar

`gozden-gecirme` düzeyindeki kuralı hiçbir araç kendiliğinden denetlemez; yalnız inceleyici hüküm verir ve `bakis` tarihi gelince yeniden bakılır.
