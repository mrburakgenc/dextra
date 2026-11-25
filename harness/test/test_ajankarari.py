#!/usr/bin/env python3
"""Ajan kararlarının görünürlüğü (TS-006 Yapı 20): düğümlerin gövdesine gömülü, kullanıcıya sorulmadan verilmiş kararlar
sayılır ve kullanıcı kabul ederken onları görür.

Tanıma (h.ajan_kararlari): (1) `AK-<n>` ile başlayan liste maddesi, aynı numaralı ek madde ayrı sayılmaz; (2) başlığında
"Ajan kararları" geçen bölümün üst düzey liste maddeleri; (3) "Ajan kararı" sözüyle başlayan paragraf: bölümü tek karar
öbeğidir ve başlığıyla gösterilir. `h.py ajan-karari` listeler; durum ve oturum başı taslaklardaki toplamı söyler; kabul
sorusu, taslak engeli ve `--taslakla` sorusu ajan kararlarını taşır.

Koşum: python3 harness/test/test_ajankarari.py
"""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import gorev  # noqa: E402
import plan  # noqa: E402
import ajan_hook  # noqa: E402
from test_h import depo  # noqa: E402
from test_hook import baglam, gerekce, kabul_komutu, karar, komut, taslakli_depo  # noqa: E402
from test_engel import TASARIM, HEDEF, OLCUT, sessiz  # noqa: E402
from test_acikuc import cli, deposu, kart_ac  # noqa: E402

KARARLI = TASARIM + """
## Yapı
- AK-1 Birinci karar: tablo adı iptal. Gerekçesi ikinci cümlededir.
  - AK-2 İkinci karar iç içe maddededir.
  - AK-2 eki: aynı numaralı ek madde ayrı sayılmaz.
- Sıradan madde (ajan kararı): biçimlerden birine uymaz, sayılmaz.
  1. AK-3 Numaralı madde de sayılır.
- Kullanıcı kararı: sayılmaz.

### Ajan kararları (kullanıcı teyidi bekler)
- **Kuyruk kullanılmaz**: doğrudan çağrı. Bedel: gecikme.
- AK-1 eki: bu bölümde de olsa aynı numara bir kez sayılır.
- AK-4 İki biçime uyan madde bir kez sayılır.
  - Alt madde sayılmaz.

## Ekranlar
Ajan kararı (gece); ekranlar şöyledir.

Ajan kararı ikinci paragraf; aynı bölüm bir kez sayılır.

## Kod
```
- AK-9 kod bloğundaki satır sayılmaz
# Ajan kararları
- kod bloğu bölüm açmaz
```
Düz paragraf; Ajan kararı sözü başta değil.
"""
BEKLENEN = ["AK-1 Birinci karar: tablo adı iptal.", "AK-2 İkinci karar iç içe maddededir.",
            "AK-3 Numaralı madde de sayılır.", "**Kuyruk kullanılmaz**: doğrudan çağrı.",
            "AK-4 İki biçime uyan madde bir kez sayılır.", "Ekranlar"]
YOL = "kb/tasarim/TS-001-iptal.md"


def tasarim(kimlik: str, n: int, durum: str = "taslak") -> str:
    """n ajan kararı taşıyan tasarım kaydı."""
    return (TASARIM.replace("TS-001", kimlik).replace("durum: taslak", "durum: " + durum)
            + "\n## Yapı\n" + "".join("- AK-%d Karar %d.\n" % (i, i) for i in range(1, n + 1)))


def dugum(metin: str) -> dict:
    return {"_govde": h.ayristir(metin)[1]}


class Tanima(unittest.TestCase):
    """a) Üç biçim sayılır; aynı numaralı ek madde ve iki biçime uyan madde bir kez; başka maddeler sayılmaz."""

    def test_uc_bicim_ve_tekillik(self):
        self.assertEqual(h.ajan_kararlari(dugum(KARARLI)), BEKLENEN)

    def test_ajan_karari_olmayan_dugum(self):
        self.assertEqual(h.ajan_kararlari(dugum(TASARIM)), [])

    def test_ilk_cumle_160_karakterde_kesilir(self):
        uzun = "AK-1 " + "uzun " * 60
        kararlar = h.ajan_kararlari(dugum(TASARIM + "\n- %s\n- AK-2 Kısa. İkinci cümle.\n" % uzun))
        self.assertEqual(len(kararlar[0]), 160)
        self.assertTrue(kararlar[0].startswith("AK-1 uzun") and kararlar[0].endswith("…"))
        self.assertEqual(kararlar[1], "AK-2 Kısa.")

    def test_ilk_cumle_rakamdan_ve_kisaltmadan_sonra_bolunmez(self):
        kararlar = h.ajan_kararlari(dugum(TASARIM + "\n- AK-1 Bkz. 12. davranış böyledir. Ek.\n"
                                          "- AK-2 (Ezildi, bkz. AU-27.) İlk hâli şuydu. Ek.\n"
                                          "- AK-3 Sonu rakam 1. " + "a" * 200 + "\n"))
        self.assertEqual(kararlar[:2], ["AK-1 Bkz. 12. davranış böyledir.", "AK-2 (Ezildi, bkz. AU-27.) İlk hâli şuydu."])
        self.assertEqual(len(kararlar[2]), 160)   # bölünemeyen metin 160 karaktere kadar gösterilir

    def test_alt_baslik_bolumu_bitirmez_dalga_kod_blogu_atlanir(self):
        metin = TASARIM + """
## Ajan kararları
- Birinci.
### Veri
- İkinci, alt bölümde.
~~~
- dalga işaretli kod bloğu sayılmaz
```
- AK-7 içteki ``` bloğu kapatmaz
~~~
#### Daha alt
- Üçüncü.
## Sonraki bölüm
- Sayılmaz.
"""
        self.assertEqual(h.ajan_kararlari(dugum(metin)), ["Birinci.", "İkinci, alt bölümde.", "Üçüncü."])


class Komut(unittest.TestCase):
    """b) `h.py ajan-karari [<KİMLİK>]` düğüm başına sayıyı ve ilk cümleleri yazar; son satır toplamdır."""

    def test_liste(self):
        kok = depo({YOL: KARARLI})
        r = cli(kok, "ajan-karari")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, "TS-001 [taslak] 6 ajan kararı — İptal akışının tasarımı\n"
                         + "".join("  - %s\n" % k for k in BEKLENEN) + "6 ajan kararı, 1 düğümde\n")
        self.assertEqual(cli(kok, "ajan-karari", "TS-001").stdout, r.stdout)
        self.assertEqual(cli(kok, "ajan-karari", "KR-001").stdout, "0 ajan kararı\n")
        r = cli(kok, "ajan-karari", "TS-009")
        self.assertEqual((r.returncode, r.stderr.strip()), (2, "ÖLÇÜLEMEDİ: TS-009 bulunamadı"))


class Gorunurluk(unittest.TestCase):
    """c, e) durum ve oturum başı taslaklardaki toplamı ve en çok taşıyan üç düğümü söyler; yokken satır yazılmaz.
    Taslak engeli ve --taslakla sorusu işe düşen taslakların ajan kararı sayısını yazar."""

    def test_durum_ve_oturum_basi(self):
        ek = {"kb/tasarim/TS-00%d-t.md" % i: tasarim("TS-00%d" % i, i) for i in range(1, 5)}
        ek["kb/tasarim/TS-005-kabul.md"] = tasarim("TS-005", 9, durum="kabul")   # kabul edilmiş düğüm sayılmaz
        kok = depo(ek)
        self.assertIn("  ajan kararı: 10, 4 taslak düğümde (en çok: TS-004 4, TS-003 3, TS-002 2) — liste: "
                      "python3 harness/h.py ajan-karari\n", cli(kok, "durum").stdout)
        b = baglam(ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok)}, {}))
        self.assertIn("Ajan kararı: 10, 4 taslak düğümde (en çok: TS-004 4, TS-003 3, TS-002 2).", b)
        kok = depo({"kb/tasarim/TS-005-kabul.md": tasarim("TS-005", 9, durum="kabul")})
        self.assertNotIn("ajan kararı", cli(kok, "durum").stdout)
        self.assertNotIn("Ajan kararı", baglam(ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok)}, {})))

    def test_taslak_engeli_ve_izin_sorusu_ajan_kararlarini_sayar(self):
        kok = deposu({YOL: KARARLI}, onay="yok")
        kimlik = kart_ac(kok, dayanak=["TS-001"])
        with self.assertRaises(h.HarnessHata) as e:
            sessiz(gorev.kos, kok, kimlik)
        for parca in ("işe düşen 1 taslak (6 ajan kararı) kabul edilmedi",
                      "TS-001 İptal akışının tasarımı (taslak; 6 ajan kararı)"):
            self.assertIn(parca, str(e.exception))
        c = komut(kok, "python3 harness/h.py gorev kos %s --taslakla" % kimlik)
        self.assertIn("işe düşen 1 taslak (6 ajan kararı):\n  TS-001 İptal akışının tasarımı (taslak; 6 ajan kararı)",
                      gerekce(c))
        sessiz(plan.space, kok, "Sipariş", amac="A.", yollar=["src/siparis/**"])
        sessiz(plan.epic, kok, "siparis", "İptal", hedef="H.", dayanak=["TS-001"])
        sessiz(plan.task, kok, "EP-001", "Yaprak", hedef=HEDEF, olcut=OLCUT)
        c = komut(kok, "python3 harness/h.py plan yurut EP-001 --taslakla")
        self.assertIn("TS-001 İptal akışının tasarımı (taslak; 6 ajan kararı)", gerekce(c))

    def test_ajan_karari_yokken_engel_bugunku_gibidir(self):
        kok = deposu({YOL: TASARIM}, onay="yok")
        kimlik = kart_ac(kok, dayanak=["TS-001"])
        with self.assertRaises(h.HarnessHata) as e:
            sessiz(gorev.kos, kok, kimlik)
        self.assertIn("işe düşen 1 taslak kabul edilmedi", str(e.exception))
        self.assertIn("  TS-001 İptal akışının tasarımı (taslak)\n", str(e.exception))
        self.assertNotIn("ajan kararı", str(e.exception))


class KabulSorusu(unittest.TestCase):
    """d) Kancanın kabul sorusu her düğümün ajan kararlarını sayısı ve ilk cümleleriyle taşır (çoksa ilk yirmisi ve
    toplam); ajan kararı olmayan düğümde özet bugünküyle aynıdır."""

    def test_soru_ajan_kararlarini_tasir(self):
        kok = depo({YOL: KARARLI})
        c = kabul_komutu(kok, "TS-001")
        self.assertEqual(karar(c), "ask")
        self.assertIn("  dosya: %s\n  ajan kararı: 6 (sana sorulmadan verildi; kabul edersen bunları da teyit "
                      "edersin):\n%s" % (YOL, "\n".join("    - " + k for k in BEKLENEN)), gerekce(c))

    def test_cok_karar_ilk_yirmisi_ve_toplam(self):
        kok = depo({YOL: tasarim("TS-001", 25)})
        g = gerekce(kabul_komutu(kok, "TS-001"))
        self.assertIn("ajan kararı: 25 ", g)
        self.assertIn("    - AK-20 Karar 20.\n    … ilk 20 gösterildi, toplam 25 (hepsi: python3 harness/h.py "
                      "ajan-karari TS-001)", g)
        self.assertNotIn("AK-21", g)

    def test_ajan_karari_yokken_ozet_bugunku_gibidir(self):
        kok = taslakli_depo()
        d = h.Dizin(kok).kimlik["KU-002"]
        self.assertEqual(gerekce(kabul_komutu(kok, "KU-002")),
                         "[harness] Onaylarsan şu taslaklar kabul edilir ve bağlayıcı olur:\n"
                         "KU-002@1 kural — İptal nedeni zorunludur\n  %s\n  dosya: kb/kural/KU-002-iptal-nedeni.md"
                         % d["_ifade"])

    def test_ucbirimdeki_soru_ajan_kararlarini_tasir_hayirda_kabul_etmez(self):
        kok = depo({YOL: KARARLI})
        once = (kok / YOL).read_text(encoding="utf-8")
        ucbirim = mock.Mock()
        ucbirim.stdin.isatty.return_value = ucbirim.stdout.isatty.return_value = True
        with mock.patch.object(h, "sys", ucbirim), mock.patch("builtins.input", return_value="hayır"):
            kod, cikti = sessiz(h._komut_kabul, kok, ["TS-001"])
        self.assertEqual(kod, 1)
        self.assertIn("  ajan kararı: 6 (sana sorulmadan verildi; kabul edersen bunları da teyit edersin):\n%s\n"
                      % "\n".join("    - " + k for k in BEKLENEN), cikti)
        self.assertTrue(cikti.endswith("kabul edilmedi.\n"))
        self.assertEqual((kok / YOL).read_text(encoding="utf-8"), once)
        self.assertEqual(h.Dizin(kok).kimlik["TS-001"]["durum"], "taslak")


class BuDepo(unittest.TestCase):
    """e) Bu depoda (yalnız okur): son satır toplamdır; TS-002 52 karar taşır (57 madde, 52 ayrı numara), TS-004 en az
    beş karar öbeği. f) tasarla ve karar skill'leri ajan kararını `AK-<n>` ile 'Ajan kararları' başlığına yazdırır."""

    def test_bu_depoda_sayim(self):
        kok = BURASI.parents[1]
        r = cli(kok, "ajan-karari")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertRegex(r.stdout.splitlines()[-1], r"^\d+ ajan kararı, \d+ düğümde$")
        dz = h.Dizin(kok)
        self.assertEqual(len(h.ajan_kararlari(dz.kimlik["TS-002"])), 52)
        self.assertGreaterEqual(len(h.ajan_kararlari(dz.kimlik["TS-004"])), 5)

    def test_skiller_ak_bicimini_ister(self):
        for ad in ("tasarla", "karar"):
            metin = (BURASI.parents[1] / ".claude/skills" / ad / "SKILL.md").read_text(encoding="utf-8")
            self.assertIn("`### Ajan kararları` başlığı altına `- AK-<n> <seçim>: <gerekçe>`", metin, ad)


if __name__ == "__main__":
    unittest.main(verbosity=1)
