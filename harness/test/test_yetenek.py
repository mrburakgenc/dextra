#!/usr/bin/env python3
"""GV-164 (TS-009 Yapı 7 ve 8) testleri: işçinin test yazma ve hata ayıklama yeteneği proje skill'i olarak durur,
sonucu bitiş kaydında ölçülür.

a) test-yaz skill'i vardır, ön bloğu ve altı bölümü vardır, 120 satırı geçmez.
b) Yeni açılan görev kartı test-yaz ve hata-ayikla adlarını anar; bitiş şablonu testler alanını nesne olarak gösterir.
c) Yeni bitiş kaydında testler zorunludur; boş liste, nesne listesi (dosya dolu) ve eski biçim metin listesi geçerlidir.
d) testler alanı olmayan eski bitiş kaydı duran alınmış görevde gorev durum ve rapor uret hata vermez.
e) İnceleme istemi kendini doğrulayan test ile tam liste sınamasının engel olduğunu söyler.
f) hata-ayikla altı yeni maddeyi taşır, var olan sekiz adımı korur.
g) İki skill dosyası kaynak ve lisans satırıyla biter.

GV-165 (TS-009 Yapı 10 ve 14): kod tasarımı sözlüğü ve mimari taraması proje skill'idir; tasarım protokolü iki ek taşır.

h) kod-tasarimi ve mimari-tara vardır, ön blok ve altı bölümü taşır, 120 satırı geçmez; mimari-tara elle çağrılır.
i) kod-tasarimi yedi terimi, silme testini, KU-008 ve KU-005'i taşır.
j) mimari-tara çıktısını depoya yazmaz ve üç güç düzeyini söyler.
k) Tasarım protokolü iki yeni konuşma kuralını ve dokuz bakış açısını taşır; tek soru kuralı yerindedir.
l) Yeni görev kartı ve inceleme istemi kod-tasarimi adını anar; AGENTS.md skill tablosu iki yeni satırı taşır.
m) İki yeni skill kaynak ve lisans satırıyla biter.

GV-166 (TS-009 Yapı 11): ön yüz tasarımı proje skill'idir.

n) on-yuz-tasarimi vardır, ön blok ve altı bölümü taşır, 120 satırı geçmez; tasarım sistemi belgesinin yolunu ve belge
   yokken yeni görsel karar alınmayacağını söyler.
o) Metin dört kalite tabanı maddesini ve üç durumu (boş, yükleniyor, hata) taşır.
p) Yeni görev kartı on-yuz-tasarimi adını anar; inceleme istemi üç durumu anar; AGENTS.md skill tablosu satırı taşır.
q) Skill kaynak (anthropics/skills, frontend-design) ve lisans (Apache-2.0) satırıyla biter.

Her test geçici bir git deposu kurar; gerçek görev kayıtlarına ve gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_yetenek.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import gorev  # noqa: E402
import rapor  # noqa: E402
from test_gorev import dolu_kart, gorev_deposu, kayit  # noqa: E402
from test_kayit import kayit_deposu  # noqa: E402
from test_rapor import cli, gorev_durumu, kayit as sahte_kayit, sablonlu_depo  # noqa: E402

SKILLER = BURASI.parents[1] / ".claude/skills"
BOLUMLER = ("Ne zaman", "Ne zaman değil", "Adımlar", "Yapma", "İlgili skill'ler", "Sınırlar")


def skill(ad: str) -> str:
    return (SKILLER / ad / "SKILL.md").read_text(encoding="utf-8")


def bitis_yaz(kok, kimlik, **degisen) -> list:
    """Kartın her kuralına hüküm veren bir bitiş kaydı yazar, verilen alanları değiştirir; sorunlarını döner."""
    k = kayit(kok, kimlik)
    kurallar = gorev.KURAL_KIMLIGI.findall((k / "kart.md").read_text(encoding="utf-8"))
    b = {"gorev": kimlik, "durum": "tamam", "ozet": "x", "kararlar": [], "reddedilenler": [], "denenmedi": [],
         "testler": [], "kurallar": [{"kimlik": ku, "hukum": "uyuyor", "not": ""} for ku in kurallar]}
    b.update(degisen)
    b = {a: v for a, v in b.items() if v is not None}   # None: alan hiç yazılmamış
    (k / "bitis.json").write_text(json.dumps(b, ensure_ascii=False), encoding="utf-8")
    return gorev.bitis_dogrula(kok, kimlik, k)


class TestYazSkili(unittest.TestCase):
    """a) ve g)"""

    def test_on_blokta_ad_ve_aciklama_alti_bolum_ve_en_cok_120_satir(self):
        metin = skill("test-yaz")
        on_blok = metin.split("---")[1]
        self.assertIn("\nname: test-yaz\n", on_blok)
        self.assertIn("\ndescription: ", on_blok)
        basliklar = [s[3:].strip() for s in metin.split("\n") if s.startswith("## ")]
        for b in BOLUMLER:
            self.assertIn(b, basliklar)
        self.assertLessEqual(len(metin.splitlines()), 120)

    def test_iki_skill_kaynak_ve_lisans_satiriyla_biter(self):
        for ad in ("test-yaz", "hata-ayikla"):
            son = [s for s in skill(ad).splitlines() if s.strip()][-1]
            self.assertIn("Kaynak", son, ad)
            self.assertIn("MIT", son, ad)


class HataAyiklaSkili(unittest.TestCase):
    """f) Var olan sekiz adım olduğu gibi durur; altı yeni madde eklenir."""

    SEKIZ = ("1. **Yeniden üret.**", "2. **Mesajın tamamını oku.**", "3. **Ne değişti?**",
             "4. **Tek bir açıklama yaz.**", "5. **Açıklamayı sına, düzeltmeyi değil.**", "6. **Tek değişiklik yap.**",
             "7. **Doğrula.**", "8. **Üç denemede çözemediysen dur.**")

    def test_sekiz_adim_sirasiyla_korunur(self):
        satirlar = skill("hata-ayikla").splitlines()
        sira = [next(i for i, s in enumerate(satirlar) if s.startswith(adim)) for adim in self.SEKIZ]
        self.assertEqual(sira, sorted(sira))

    def test_alti_yeni_madde_vardir(self):
        metin = skill("hata-ayikla")
        for parca in ("hatayı yakalayan tek komut", "çalışan bir örnekle karşılaştır", "kaynağında düzelt",
                      "o hatayı yakalayan testi yaz", "bulgu olarak yaz", "tek bir etiketle", "etiketi ara",
                      "yaklaşım ya da yapı yanlış olabilir mi"):
            self.assertIn(parca, metin)
        self.assertLessEqual(len(metin.splitlines()), 120)


class Kart(unittest.TestCase):
    """b)"""

    def test_yeni_kart_test_yaz_ve_hata_ayikla_skilllerini_anar(self):
        metin = gorev.yeni(gorev_deposu(), "İş", "uygulayici", ["src/siparis/**"], []).read_text(encoding="utf-8")
        self.assertIn("`test-yaz`", metin)
        self.assertIn("`hata-ayikla`", metin)

    def test_yeni_kartin_bitis_sablonu_testleri_nesne_olarak_gosterir(self):
        metin = gorev.yeni(gorev_deposu(), "İş", "uygulayici", ["src/siparis/**"], []).read_text(encoding="utf-8")
        satir = next(s for s in metin.splitlines() if s.strip().startswith('"testler"'))
        for alan in ('"dosya"', '"kirmizi"', '"yesil"'):
            self.assertIn(alan, satir)


class BitisTestleri(unittest.TestCase):
    """c) Yeni bitiş kaydında testler zorunludur; öğesi dosyası dolu nesne ya da (eski kartlar için) metindir."""

    def setUp(self):
        os.environ.pop("KAYIT_MOD", None)
        self.kok = kayit_deposu()
        self.kimlik = dolu_kart(self.kok)

    def test_testler_alani_yoksa_eksik_alan(self):
        sorunlar = bitis_yaz(self.kok, self.kimlik, testler=None)
        self.assertEqual([s["ad"] for s in sorunlar], ["eksik-alan"])
        self.assertIn("testler", sorunlar[0]["mesaj"])

    def test_bos_liste_gecerli(self):
        self.assertEqual(bitis_yaz(self.kok, self.kimlik, testler=[]), [])

    def test_dosya_kirmizi_yesil_nesneleri_gecerli(self):
        testler = [{"dosya": "harness/test/test_x.py", "kirmizi": "FAILED (failures=1)",
                    "yesil": "python3 harness/test/test_x.py → OK"},
                   {"dosya": "harness/test/test_y.py", "kirmizi": "yok: var olan testi yalnız koşturdum",
                    "yesil": "python3 harness/test/test_y.py → OK"}]
        self.assertEqual(bitis_yaz(self.kok, self.kimlik, testler=testler), [])

    def test_eski_bicim_metin_ogeleri_gecerli(self):
        self.assertEqual(bitis_yaz(self.kok, self.kimlik, testler=["python3 harness/test/test_x.py: 4 test geçti"]),
                         [])

    def test_dosyasiz_nesne_gecersiz(self):
        sorunlar = bitis_yaz(self.kok, self.kimlik, testler=[{"kirmizi": "FAILED", "yesil": "OK"}])
        self.assertEqual([s["ad"] for s in sorunlar], ["eksik-alan"])
        self.assertIn("dosya", sorunlar[0]["mesaj"])

    def test_bos_dosyali_nesne_ve_bos_metin_gecersiz(self):
        for oge in ({"dosya": "", "kirmizi": "x", "yesil": "y"}, "  "):
            self.assertTrue(bitis_yaz(self.kok, self.kimlik, testler=[oge]), oge)

    def test_liste_olmayan_testler_gecersiz(self):
        self.assertTrue(bitis_yaz(self.kok, self.kimlik, testler="python3 x.py geçti"))


class EskiKayit(unittest.TestCase):
    """d) Alınmış görevin eski bitiş kaydı yeniden doğrulanmaz: durum ve rapor uret onunla çalışır."""

    def test_testlersiz_eski_bitis_gorev_durum_ve_rapor_uretti_bozmaz(self):
        kok = sablonlu_depo()
        eski = {"gorev": "GV-001", "durum": "tamam", "ozet": "x", "kararlar": [], "reddedilenler": [], "kurallar": [],
                "denenmedi": []}
        sahte_kayit(kok, "GV-001", gorev_durumu("GV-001", "Eski iş", alindi=True, inceleme="gecti"),
                    bitis=eski, rapor={"sure_sn": 60, "degisen": ["a"], "kullanim": {}, "bitis": eski})
        kod, cikti = cli(kok, "gorev", "durum")
        self.assertEqual(kod, 0, cikti)
        self.assertIn("GV-001", cikti)
        yol = rapor.yeni(kok, "Eski", "2026-11-26")
        kod, cikti = cli(kok, "rapor", "uret", str(yol.relative_to(kok)))
        self.assertEqual(kod, 0, cikti)
        self.assertIn("| GV-001 |", yol.read_text(encoding="utf-8"))


class IncelemeIstemi(unittest.TestCase):
    """e) İnceleyiciye giden istem, yeni testi koşturmasını ve iki test kusurunun engel olduğunu söyler."""

    def test_istem_kendini_dogrulayan_ve_tam_liste_testini_engel_sayar(self):
        os.environ.pop("KAYIT_MOD", None)
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        istem = (kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        madde = next(s for s in istem.split("\n- ") if "kendini doğrulayan" in s)
        for parca in ("kendin koştur", "tam liste", "engel"):
            self.assertIn(parca, madde)


KOK = BURASI.parents[1]


class KodTasarimiVeMimariTara(unittest.TestCase):
    """h), i), j) ve m)"""

    def test_on_blok_alti_bolum_ve_en_cok_120_satir(self):
        for ad in ("kod-tasarimi", "mimari-tara"):
            metin = skill(ad)
            on_blok = metin.split("---")[1]
            self.assertIn("\nname: %s\n" % ad, on_blok)
            self.assertIn("\ndescription: ", on_blok)
            basliklar = [s[3:].strip() for s in metin.split("\n") if s.startswith("## ")]
            for b in BOLUMLER:
                self.assertIn(b, basliklar, ad)
            self.assertLessEqual(len(metin.splitlines()), 120, ad)

    def test_mimari_tara_elle_cagrilir(self):
        self.assertIn("\ndisable-model-invocation: true\n", skill("mimari-tara").split("---")[1])

    def test_kod_tasarimi_yedi_terim_silme_testi_ve_iki_kural(self):
        metin = skill("kod-tasarimi")
        for parca in ("**Modül**", "**Arayüz**", "**Derinlik**", "**Dikiş**", "**Bağdaştırıcı**", "**Kaldıraç**",
                      "**Yerellik**", "Silme testi", "KU-008", "KU-005"):
            self.assertIn(parca, metin)

    def test_mimari_tara_ciktiyi_depoya_yazmaz_ve_uc_guc_duzeyi_soyler(self):
        metin = skill("mimari-tara")
        for parca in ("depoya yazılmaz", "güçlü", "araştırmaya değer", "spekülatif"):
            self.assertIn(parca, metin)

    def test_iki_skill_kaynak_ve_lisans_satiriyla_biter(self):
        for ad in ("kod-tasarimi", "mimari-tara"):
            son = [s for s in skill(ad).splitlines() if s.strip()][-1]
            self.assertIn("Kaynak", son, ad)
            self.assertIn("MIT", son, ad)


class TasarimProtokolu(unittest.TestCase):
    """k)"""

    def test_iki_yeni_konusma_kurali_ve_tek_soru_kurali(self):
        metin = (KOK / "harness/protokol/tasarim.md").read_text(encoding="utf-8")
        kurallar = metin.split("## Konuşma kuralları")[1].split("\n## ")[0]
        self.assertIn("Her seferinde tek soru sorulur.", kurallar)
        self.assertIn("önerilen cevabı ve gerekçesiyle sorulur", kurallar)
        self.assertIn("Ortamdan öğrenilebilecek olgu kullanıcıya sorulmaz", kurallar)

    def test_dokuz_bakis_acisi_adimlar_tablosunun_altinda(self):
        metin = (KOK / "harness/protokol/tasarim.md").read_text(encoding="utf-8")
        bolum = metin.split("Seçenek üretirken bakış açıları")[1].split("## Konuşma kuralları")[0]
        for aci in ("Tersine çevir", "Yük taşıyan varsayımı kaldır", "Sıfır bütçe ve bir saat",
                    "Sınırsız bütçe ve on yıl", "Gece üçte nöbetçi", "Denetçi", "Sistemi kırmaya çalışan rakip",
                    "On yaşında bir çocuk", "Başka bir alandan bak"):
            self.assertIn(aci, bolum)
        self.assertLess(metin.index("| 12 | Çürütme turu"), metin.index("Seçenek üretirken bakış açıları"))


class KodTasarimiGondermeleri(unittest.TestCase):
    """l)"""

    def test_yeni_kart_kod_tasarimi_skillini_anar(self):
        metin = gorev.yeni(gorev_deposu(), "İş", "uygulayici", ["src/siparis/**"], []).read_text(encoding="utf-8")
        self.assertIn("`kod-tasarimi`", metin)

    def test_inceleme_istemi_karmasiklik_sorusunda_kod_tasarimini_anar(self):
        os.environ.pop("KAYIT_MOD", None)
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        istem = (kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        cumle = istem.split("gereğinden karmaşık")[1].split("Değişen dosyaların tamamını oku")[0]
        self.assertIn("`kod-tasarimi`", cumle)

    def test_agents_skill_tablosu_iki_yeni_satiri_tasir(self):
        metin = (KOK / "AGENTS.md").read_text(encoding="utf-8")
        tablo = metin.split("## İş akışları (skill)")[1].split("\n\n")[2]
        self.assertIn("| `kod-tasarimi` |", tablo)
        self.assertIn("| `mimari-tara` |", tablo)


class OnYuzTasarimi(unittest.TestCase):
    """n), o), p) ve q)"""

    def test_on_blok_alti_bolum_ve_en_cok_120_satir(self):
        metin = skill("on-yuz-tasarimi")
        on_blok = metin.split("---")[1]
        self.assertIn("\nname: on-yuz-tasarimi\n", on_blok)
        self.assertIn("\ndescription: ", on_blok)
        basliklar = [s[3:].strip() for s in metin.split("\n") if s.startswith("## ")]
        for b in BOLUMLER:
            self.assertIn(b, basliklar)
        self.assertLessEqual(len(metin.splitlines()), 120)

    def test_tasarim_sistemi_belgesi_yoksa_yeni_gorsel_karar_alinmaz(self):
        metin = skill("on-yuz-tasarimi")
        self.assertIn("docs/tasarim-sistemi.md", metin)
        self.assertIn("yeni görsel karar alma", metin)

    def test_dort_kalite_tabani_ve_uc_durum(self):
        metin = skill("on-yuz-tasarimi")
        for parca in ("dar ekranda", "klavye odağı", "azaltılmış hareket", "karşıtlık", "boş", "yükleniyor", "hata"):
            self.assertIn(parca, metin)

    def test_kaynak_ve_lisans_satiriyla_biter(self):
        son = [s for s in skill("on-yuz-tasarimi").splitlines() if s.strip()][-1]
        for parca in ("Kaynak", "anthropics/skills", "frontend-design", "Apache-2.0"):
            self.assertIn(parca, son)

    def test_yeni_kart_on_yuz_tasarimi_skillini_anar(self):
        metin = gorev.yeni(gorev_deposu(), "İş", "uygulayici", ["src/siparis/**"], []).read_text(encoding="utf-8")
        self.assertIn("`on-yuz-tasarimi`", metin)

    def test_inceleme_istemi_on_yuz_isinde_uc_durumu_ve_klavye_odagini_anar(self):
        os.environ.pop("KAYIT_MOD", None)
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        istem = (kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        madde = next(s for s in istem.split("\n- ") if "frontend" in s)
        for parca in ("boş", "yükleniyor", "hata", "klavye odağı", "bulgu"):
            self.assertIn(parca, madde)

    def test_agents_skill_tablosu_satiri_tasir(self):
        metin = (KOK / "AGENTS.md").read_text(encoding="utf-8")
        tablo = metin.split("## İş akışları (skill)")[1].split("\n\n")[2]
        self.assertIn("| `on-yuz-tasarimi` |", tablo)


if __name__ == "__main__":
    unittest.main(verbosity=1)
