---
name: kb-tara
description: Bilgi tabanını yargıyla tarar: birbiriyle çelişen kurallar, bayatlamış kararlar, düğümü olmayan kavramlar, örneği zayıf kurallar. Mekanik denetimin göremediğini arar ve kullanıcıya öneri listesi verir. Dönemsel bakımda, büyük bir belge alımından sonra ya da kurallar birbirine takılmaya başladığında kullan.
argument-hint: <isteğe bağlı: taranacak konu ya da düğüm>
---

Bilgi tabanını tara: $ARGUMENTS

`python3 harness/h.py denetle` zincirin **biçimini** ölçer: dayanak, kapsam, sürüm, bütçe. Bu skill **anlamı** tarar; çıktısı bulgu değil öneridir.

## Ne zaman

- Yeni kurallar eklendi ve eskileriyle çelişip çelişmediği bilinmiyor.
- Bir karar uzun süredir duruyor ve hâlâ geçerli mi belli değil.
- Büyük bir belge alımından (`kb-ice-al`) sonra.

## Ne zaman değil

- Tek bir düğümün nereden geldiğini görmek için: `python3 harness/h.py sor <KİMLİK>`.
- Zincir kırmızıyken: önce `denetle` yeşil olsun.

## Adımlar

1. `python3 harness/h.py denetle` çalıştır; kırmızıysa dur ve onu söyle.
2. Kabul edilmiş bütün karar ve kuralları oku (`kb/karar/`, `kb/kural/`), son değişiklikleri günlükten gör: `grep '^## \[' kb/GUNLUK.md | tail -20`.
3. Şunları ara ve her birini düğüm kimlikleriyle yaz:
   - **Çelişki:** aynı duruma iki kural farklı şey söylüyor.
   - **Bayat karar:** bağlamı ya da varsayımı artık geçerli değil; `bakis` tarihi yaklaşmış ya da geçmiş.
   - **Sahipsiz kavram:** birkaç düğümde geçen ama kendi tanımı olmayan terim.
   - **Zayıf örnek:** ihlal ya da uygun örneği kuralın ifadesini yalnız tekrar eden kesin kural.
   - **Aşırı mutlak:** istisna yolu olmayan "her", "hiçbir", "asla".
   - **Boşluk:** bir kararın "Sonuçlar" bölümünde yazıp kurala dönüşmemiş yükümlülük.
4. Her öneri için ne yapılabileceğini söyle: yeni karar taslağı, kuralı ezen kural, düğümü emekli etme, tanım ekleme.
5. Kullanıcıya önem sırasıyla en çok on öneri ver; her birinde kimlikler ve dayandığın cümle olsun.

## Yapma

- Hiçbir düğümü değiştirme; bu skill yalnız okur ve önerir.
- Emin olmadığın çelişkiyi kesinmiş gibi yazma: "çelişiyor olabilir, çünkü…" de.
- Biçim hatası arama: o `denetle`nin işi.

## İlgili skill'ler

- `karar`, `kural`: önerilerin uygulanacağı yer. `kb-ice-al`: taramayı en çok gerektiren işlem.

## Sınırlar

Tarama bir modelin yargısıdır: gerçek bir çelişkiyi kaçırabilir, olmayanı görebilir. Sonucu kapı değildir, zinciri kırmızı yapmaz; karar kullanıcınındır.
