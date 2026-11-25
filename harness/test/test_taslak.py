#!/usr/bin/env python3
"""Taslak kural uyarısı ve paketteki taslak bloğu (TS-006 Yapı 1).

Kabul bekleyen kural ve kararlar bağlayıcı paketin ardından ayrı bir blokta gelir; bağlayıcı blok ve özet damgası
değişmez. Kart açılırken ve görev koşturulurken işe düşen taslaklar tek satırla uyarılır.

Koşum: python3 harness/test/test_taslak.py
"""
from __future__ import annotations

import contextlib
import io
import os
import pathlib
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import gorev  # noqa: E402
import plan  # noqa: E402
import ajan_hook  # noqa: E402
from test_h import depo, git, git_depo  # noqa: E402
from test_hook import TASLAK_KARAR, TASLAK_KURAL, karar  # noqa: E402
from test_gorev import SAHTE_ISCI  # noqa: E402

TASLAKLAR = {"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL}
UYARI = "kabul edilmeden bağlayıcı gitmez"


def gorev_deposu(ek=None):
    """Sahte işçi ve inceleyiciyle koşturulabilen git deposu; `ek` bilgi tabanına dosya ekler."""
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "isci.py"
    sahte.write_text(SAHTE_ISCI, encoding="utf-8")
    ayar = {"gorev": {"komut": [sys.executable, str(sahte)], "model": "sonnet", "max_tur": 5,
                      "zaman_asimi_sn": 20, "izin_modu": "acceptEdits"}}
    return git_depo(depo(ek, ayar=ayar))


def sessiz(islev, *arg, **kw):
    """(dönüş, stdout) — komutun yazdığını yakalar."""
    with contextlib.redirect_stdout(io.StringIO()) as c:
        donus = islev(*arg, **kw)
    return donus, c.getvalue()


def kart_ac(kok):
    kart, cikti = sessiz(gorev.yeni, kok, "İptal nedeni ekle", "uygulayici", ["src/siparis/**"], [],
                         hedef="İptal isteğine neden kodu ekle.", olcut="Neden kodu olmadan istek reddedilir.")
    return kart.parent.name, cikti


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)

    tearDown = setUp


class Paket(Ortam):
    def test_a_taslak_ayri_blokta_gelir_baglayici_blok_ve_damga_degismez(self):
        once = h.paket(depo(), "uygulayici", ["src/siparis/iptal.ts"])
        sonra = h.paket(depo(TASLAKLAR), "uygulayici", ["src/siparis/iptal.ts"])
        self.assertEqual((sonra["metin"], sonra["ozet"]), (once["metin"], once["ozet"]))
        self.assertTrue(sonra["tam"].startswith(sonra["metin"] + "\n\n[[KB-TASLAK]]\n"))
        taslak = sonra["tam"][len(sonra["metin"]):]
        self.assertIn("bağlayıcı değil", taslak)
        self.assertIn("engel değil öneri", taslak)
        self.assertIn("- KU-002@1 İptal nedeni zorunludur: ", taslak)
        self.assertIn("- KR-002 Sipariş iptali nedensiz olmaz", taslak)
        self.assertNotIn("KU-002", sonra["metin"])
        self.assertEqual(sonra["taslaklar"], ["KU-002", "KR-002"])
        self.assertEqual(h.paket_ozeti_dogrula(sonra["tam"]), once["ozet"])

    def test_a_paket_komutu_iki_blogu_yazar(self):
        kok = depo(TASLAKLAR)
        kod, cikti = sessiz(h._komut_paket, kok, ["--rol", "uygulayici", "--yol", "src/siparis/iptal.ts"])
        self.assertEqual(kod, 0)
        self.assertEqual(cikti, h.paket(kok, "uygulayici", ["src/siparis/iptal.ts"])["tam"] + "\n")
        self.assertLess(cikti.index("[[/KB-PAKET]]"), cikti.index("[[KB-TASLAK]]"))

    def test_b_taslak_yokken_cikti_bugunku_paketle_birebir_aynidir(self):
        kok = depo()
        p = h.paket(kok, "uygulayici", ["src/siparis/iptal.ts"])
        self.assertEqual((p["tam"], p["taslaklar"]), (p["metin"], []))
        _, cikti = sessiz(h._komut_paket, kok, ["--rol", "uygulayici", "--yol", "src/siparis/iptal.ts"])
        self.assertEqual(cikti, p["metin"] + "\n")
        self.assertNotIn("KB-TASLAK", cikti)

    def test_c_yolu_eslesmeyen_taslak_kural_bloga_girmez(self):
        baska = {"kb/karar/KR-002-iptal.md": TASLAK_KARAR,
                 "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL.replace("src/siparis/**", "src/odeme/**")}
        p = h.paket(depo(baska), "uygulayici", ["src/siparis/iptal.ts"])
        self.assertEqual((p["tam"], p["taslaklar"]), (p["metin"], []))
        self.assertEqual(h.paket(depo(baska), "uygulayici", ["src/odeme/a.ts"])["taslaklar"], ["KU-002", "KR-002"])

    def test_inceleyici_paketi_oneri_yonergesini_tasir_digerleri_tasimaz(self):
        kok = depo(TASLAKLAR)
        self.assertIn('"oneri"', h.paket(kok, "inceleyici", ["src/siparis/iptal.ts"])["tam"])
        self.assertNotIn('"oneri"', h.paket(kok, "uygulayici", ["src/siparis/iptal.ts"])["tam"])

    def test_taslak_satiri_hukum_istenen_kural_sayilmaz(self):
        tam = h.paket(depo(TASLAKLAR), "inceleyici", ["src/siparis/iptal.ts"])["tam"]
        self.assertEqual(gorev.KURAL_KIMLIGI.findall(tam), ["KU-001@1"])


class Uyari(Ortam):
    def test_d_gorev_yeni_taslak_kimlikleriyle_uyarir(self):
        kok = gorev_deposu(TASLAKLAR)
        kod, cikti = sessiz(gorev.komut, kok, ["yeni", "İş", "--yol", "src/siparis/**"])
        self.assertEqual(kod, 0)
        satir = [s for s in cikti.splitlines() if UYARI in s]
        self.assertEqual(len(satir), 1)
        self.assertIn("2 taslak", satir[0])
        self.assertIn("KU-002, KR-002", satir[0])

    def test_d_gorev_yeni_taslak_yokken_uyarmaz(self):
        _, cikti = sessiz(gorev.komut, gorev_deposu(), ["yeni", "İş", "--yol", "src/siparis/**"])
        self.assertNotIn(UYARI, cikti)
        self.assertNotIn("taslak", cikti)

    def test_d_gorev_kos_taslak_kimlikleriyle_uyarir_yokken_uyarmaz(self):
        # GV-140 (TS-006 Yapı 18): koşturmadaki uyarı engele döndü; taslaklı iş yalnız izinle (--taslakla) koşar,
        # izni kancanın soruyu sorarken bıraktığı işaret gösterir
        kok = gorev_deposu(TASLAKLAR)
        kimlik, _ = kart_ac(kok)
        # GV-141: işaret kancanın gördüğü komutun özetine bağlıdır; araç yalnız eşleşen işareti tüketir
        gorev.taslak_izni_yaz(kok, kimlik, ["KU-002", "KR-002"],
                              ozet=h.komut_ozeti(["gorev", "kos", kimlik, "--taslakla"]))
        kod, cikti = sessiz(gorev.komut, kok, ["kos", kimlik, "--taslakla"])
        self.assertEqual(kod, 0, cikti)
        self.assertIn("2 taslağa rağmen koşuyor: KU-002, KR-002", cikti)
        kok = gorev_deposu()
        kimlik, _ = kart_ac(kok)
        kod, cikti = sessiz(gorev.komut, kok, ["kos", kimlik])
        self.assertEqual(kod, 0, cikti)
        self.assertNotIn(UYARI, cikti)

    def test_plan_task_karti_acilirken_uyarir(self):
        kok = gorev_deposu(TASLAKLAR)
        sessiz(plan.space, kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/siparis/**"])
        sessiz(plan.epic, kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
        _, cikti = sessiz(plan.komut, kok, ["task", "EP-001", "İptal nedeni", "--hedef", "H", "--olcut", "O"])
        self.assertIn("KU-002, KR-002 — " + UYARI, cikti)


class Kart(Ortam):
    def test_e_acilan_kart_ve_inceleme_karti_taslak_blogunu_tasir(self):
        kok = gorev_deposu(TASLAKLAR)
        kimlik, _ = kart_ac(kok)
        kart = (h.ortak_kok(kok) / ".harness/gorev" / kimlik / "kart.md").read_text(encoding="utf-8")
        self.assertEqual(kart.count("[[KB-TASLAK]]"), 1)
        self.assertIn("- KU-002@1 ", kart)
        rapor, _ = sessiz(gorev.kos, kok, kimlik, taslakla=True)   # GV-140: taslaklı iş yalnız izinle koşar
        self.assertEqual((rapor["durum"], rapor["sorunlar"]), ("tamam", []))
        kart = (h.ortak_kok(kok) / ".harness/gorev" / kimlik / "kart.md").read_text(encoding="utf-8")
        self.assertEqual(kart.count("[[KB-TASLAK]]"), 1)   # koşum paketi yenilerken bloğu çoğaltmaz
        inc, _ = sessiz(gorev.incele, kok, kimlik)
        self.assertEqual((inc["sonuc"], inc["sorunlar"]), ("gecti", []))   # taslağa hüküm istenmez
        istem = (h.ortak_kok(kok) / ".harness/gorev" / kimlik / "inceleme-istem.md").read_text(encoding="utf-8")
        self.assertIn("[[KB-TASLAK]]", istem)
        self.assertIn("- KU-002@1 ", istem)
        self.assertIn('önemini "oneri" yap', istem)

    def test_taslak_yokken_kartta_blok_yoktur(self):
        kok = gorev_deposu()
        kimlik, _ = kart_ac(kok)
        kart = (h.ortak_kok(kok) / ".harness/gorev" / kimlik / "kart.md").read_text(encoding="utf-8")
        self.assertNotIn("KB-TASLAK", kart)

    def test_kosum_taslak_blogunu_guncel_hale_getirir(self):
        kok = gorev_deposu(TASLAKLAR)
        kimlik, _ = kart_ac(kok)
        kart_yolu = h.ortak_kok(kok) / ".harness/gorev" / kimlik / "kart.md"
        ilk = kart_yolu.read_text(encoding="utf-8")
        for yol in TASLAKLAR:   # taslaklar kart açıldıktan sonra kaldırılır
            (kok / yol).unlink()
        git(kok, "commit", "-qam", "taslaklar kalktı")
        sessiz(gorev.kos, kok, kimlik)
        kart = kart_yolu.read_text(encoding="utf-8")
        self.assertNotIn("KB-TASLAK", kart)
        self.assertEqual(h.PAKET.search(kart).group(0), h.PAKET.search(ilk).group(0))


class Hook(Ortam):
    def test_f_taslak_bloklu_gorev_metni_paket_dogrulamasindan_gecer(self):
        kok = depo(TASLAKLAR)
        p = h.paket(kok, "uygulayici", ["src/siparis/**"])
        self.assertIn("[[KB-TASLAK]]", p["tam"])
        prompt = "[gorev] rol=uygulayici yol=src/siparis/**\n\n" + p["tam"] + "\n\nşunu yap"
        c = ajan_hook.isle("ajan-baslatma", {"session_id": "s1", "cwd": str(kok), "tool_name": "Agent",
                                             "tool_input": {"prompt": prompt, "subagent_type": "general-purpose"}}, {})
        self.assertIsNone(c)
        bozuk = prompt.replace("[[KB-PAKET", "[[KB-PAKEX")
        c = ajan_hook.isle("ajan-baslatma", {"session_id": "s1", "cwd": str(kok), "tool_name": "Agent",
                                             "tool_input": {"prompt": bozuk, "subagent_type": "general-purpose"}}, {})
        self.assertEqual(karar(c), "deny")


if __name__ == "__main__":
    unittest.main(verbosity=1)
