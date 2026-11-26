#!/usr/bin/env python3
"""Söz defteri testleri (TS-009 Yapı 13): kanca kullanıcının iletilerini ve soru cevaplarını ana çalışma ağacının
.harness/soz/ klasörüne yazar; `h.py soz` listeler, `rapor yeni` 4. bölüme koyar, oturum başı özeti gösterir.

Koşum: python3 harness/test/test_soz.py
"""
from __future__ import annotations

import datetime
import json
import pathlib
import sys
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import ajan_hook  # noqa: E402
import rapor  # noqa: E402
from test_h import agac_ac, depo, git_depo  # noqa: E402
from test_hook import baglam, kesin_depo  # noqa: E402
from test_rapor import cli, sablonlu_depo  # noqa: E402


def istem(kok, metin="merhaba", oturum="s1", ortam=None, **girdi):
    return ajan_hook.isle("istem", dict({"session_id": oturum, "cwd": str(kok), "permission_mode": "default",
                                         "prompt": metin}, **girdi), ortam or {})


def soru(kok, oturum="s1", ortam=None, **girdi):
    veri = {"session_id": oturum, "cwd": str(kok), "tool_name": "AskUserQuestion",
            "tool_input": {"questions": [{"question": "Hangi yol?", "header": "Yol",
                                          "options": [{"label": "A"}, {"label": "B"}], "multiSelect": False}]}}
    veri.update(girdi)
    return ajan_hook.isle("soru-sonrasi", veri, ortam or {})


def satirlar(kok, oturum="s1"):
    p = kok / ".harness/soz" / (oturum + ".jsonl")
    return [json.loads(s) for s in p.read_text(encoding="utf-8").split("\n") if s] if p.is_file() else []


def sozler_yaz(kok, oturum, *kayitlar):
    p = kok / ".harness/soz" / (oturum + ".jsonl")
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        for zaman, agac, tur, metin in kayitlar:
            f.write(json.dumps({"zaman": zaman, "agac": agac, "tur": tur, "metin": metin}, ensure_ascii=False) + "\n")


def once(**fark) -> str:
    return (datetime.datetime.now() - datetime.timedelta(**fark)).isoformat(timespec="seconds")


class IstemYazar(unittest.TestCase):
    """a) İleti ana ağacın söz defterine yazılır; b) plan modundaki paket davranışı aynıdır."""

    def test_ileti_oturum_dosyasina_zaman_agac_tur_ve_metinle_yazilir(self):
        kok = depo()
        self.assertIsNone(istem(kok, "şunu  yap\nsatır iki"))
        [k] = satirlar(kok)
        self.assertEqual((k["agac"], k["tur"], k["metin"]), (kok.name, "ileti", "şunu  yap\nsatır iki"))
        datetime.datetime.fromisoformat(k["zaman"])

    def test_calisma_agacindan_cagrilinca_defter_ana_agactadir(self):
        ana = git_depo(depo())
        agac = agac_ac(ana, "a")
        istem(agac, "ağaçtan")
        [k] = satirlar(ana)
        self.assertEqual((k["agac"], k["metin"]), ("a", "ağaçtan"))
        self.assertFalse((agac / ".harness/soz").exists())

    def test_her_ileti_eklenir(self):
        kok = depo()
        istem(kok, "bir")
        istem(kok, "iki")
        self.assertEqual([k["metin"] for k in satirlar(kok)], ["bir", "iki"])

    def test_plan_modunda_paket_bir_kez_verilir_ve_iletiler_yazilir(self):
        kok = kesin_depo()
        self.assertIn("[[KB-PAKET rol=tasarimci", baglam(istem(kok, "plan yap", permission_mode="plan")))
        self.assertIsNone(istem(kok, "devam", permission_mode="plan"))
        self.assertEqual([k["metin"] for k in satirlar(kok)], ["plan yap", "devam"])

    def test_plan_modu_disinda_isteme_bir_sey_eklenmez(self):
        self.assertIsNone(istem(kesin_depo(), "x"))


class SoruYazar(unittest.TestCase):
    """c) Soru aracının sorusu ve cevabı 'cevap' türüyle yazılır."""

    def test_arac_girdisindeki_cevap_yazilir(self):
        kok = depo()
        self.assertIsNone(soru(kok, tool_input={"questions": [{"question": "Hangi yol?"}],
                                                "answers": {"Hangi yol?": "B"}}))
        [k] = satirlar(kok)
        self.assertEqual((k["tur"], k["metin"]), ("cevap", "Hangi yol? → B"))

    def test_arac_sonucundaki_cevap_yazilir(self):
        kok = depo()
        soru(kok, tool_response={"questions": [], "answers": {"Hangi yol?": "A", "Ne zaman?": "şimdi"}})
        self.assertEqual(satirlar(kok)[0]["metin"], "Hangi yol? → A\nNe zaman? → şimdi")

    def test_taninmayan_bicimde_soru_ve_ham_sonuc_yazilir(self):
        kok = depo()
        soru(kok, tool_response="Kullanıcı B dedi")
        self.assertEqual(satirlar(kok)[0]["metin"], "Hangi yol?\ncevap (ham): Kullanıcı B dedi")


class YalnizAnaOturum(unittest.TestCase):
    """d) Görev işçisi, inceleyici ve alt ajan deftere yazmaz."""

    def test_gorev_isci_oturumu_yazmaz(self):
        kok = depo()
        istem(kok, ortam={"HARNESS_GOREV": "GV-001"})
        soru(kok, ortam={"HARNESS_GOREV": "GV-001", "HARNESS_ROL": "inceleyici"},
             tool_response={"answers": {"q": "a"}})
        self.assertFalse((kok / ".harness/soz").exists())

    def test_alt_ajan_yazmaz(self):
        kok = depo()
        istem(kok, agent_id="a1")
        soru(kok, agent_id="a1", tool_response={"answers": {"q": "a"}})
        self.assertFalse((kok / ".harness/soz").exists())


class SozKomutu(unittest.TestCase):
    """e) `h.py soz` kayıtları zaman sırasıyla, --gun ve --agac süzgeçleriyle listeler."""

    def _depo(self):
        kok = depo()
        sozler_yaz(kok, "s2", ("2026-11-26T10:00:00", "a", "ileti", "üçüncü"),
                   ("2026-11-25T09:00:00", "b", "cevap", "birinci"))
        sozler_yaz(kok, "s1", ("2026-11-26T08:00:00", "b", "ileti", "ikinci\nalt satır"))
        return kok

    @staticmethod
    def _sira(cikti):
        """Çıktıda geçen metinler, çıktıdaki sırasıyla."""
        return [m for _, m in sorted((cikti.index(m), m) for m in ("birinci", "ikinci", "üçüncü") if m in cikti)]

    def test_zaman_sirasiyla_listeler(self):
        kod, cikti = cli(self._depo(), "soz")
        self.assertEqual(kod, 0)
        self.assertEqual(self._sira(cikti), ["birinci", "ikinci", "üçüncü"])
        self.assertIn("2026-11-26T08:00:00 · b · ileti · s1\n  ikinci\n  alt satır", cikti)
        self.assertIn("soz: 3 kayıt", cikti)

    def test_gun_suzgeci(self):
        _, cikti = cli(self._depo(), "soz", "--gun", "2026-11-26")
        self.assertEqual(self._sira(cikti), ["ikinci", "üçüncü"])

    def test_agac_suzgeci(self):
        _, cikti = cli(self._depo(), "soz", "--agac", "b")
        self.assertEqual(self._sira(cikti), ["birinci", "ikinci"])

    def test_iki_suzgec_birlikte(self):
        _, cikti = cli(self._depo(), "soz", "--agac", "b", "--gun", "2026-11-25")
        self.assertEqual(self._sira(cikti), ["birinci"])

    def test_bozuk_gun_reddedilir(self):
        self.assertEqual(cli(self._depo(), "soz", "--gun", "26-11-2026")[0], 2)

    def test_defter_yokken_bos_listeler(self):
        self.assertIn("soz: 0 kayıt", cli(depo(), "soz")[1])


class RaporaGirer(unittest.TestCase):
    """f) `rapor yeni` 4. bölüme ham listeyi koyar; söz yokken bölüm bugünkü gibidir; `rapor uret` bölüme dokunmaz."""

    @staticmethod
    def _bolum(metin):
        return metin.split("## 4. Kullanıcının verdiği kararlar", 1)[1].split("\n## 5.", 1)[0]

    def test_soz_yokken_bolum_sablondaki_gibidir(self):
        kok = sablonlu_depo()
        sablon = (kok / "harness/sablon/rapor.md").read_text(encoding="utf-8")
        self.assertEqual(self._bolum(rapor.yeni(kok, "X", "2026-11-25").read_text(encoding="utf-8")),
                         self._bolum(sablon))

    def test_bu_agacin_sozleri_ham_liste_olarak_girer(self):
        kok = sablonlu_depo()
        uzun = "u" * 400
        sozler_yaz(kok, "s1", ("2026-11-25T10:00:00", kok.name, "ileti", "ilk  söz\nikinci satır"),
                   ("2026-11-25T09:00:00", kok.name, "cevap", uzun),
                   ("2026-11-25T11:00:00", "baska-agac", "ileti", "başka ağacın sözü"))
        bolum = self._bolum(rapor.yeni(kok, "X", "2026-11-25").read_text(encoding="utf-8"))
        self.assertIn("_(doldurulacak:", bolum)
        liste = bolum.split(rapor.SOZ_BASLIGI + "\n\n", 1)[1].strip().split("\n")
        self.assertEqual(liste, ["- 2026-11-25T09:00:00 · cevap — " + "u" * 299 + "…",
                                 "- 2026-11-25T10:00:00 · ileti — ilk söz ikinci satır"])
        self.assertNotIn("başka ağacın", bolum)

    def test_rapor_uret_bolume_dokunmaz(self):
        kok = sablonlu_depo()
        sozler_yaz(kok, "s1", ("2026-11-25T10:00:00", kok.name, "ileti", "ham söz"))
        yol = rapor.yeni(kok, "X", "2026-11-25")
        ayiklanmis = yol.read_text(encoding="utf-8").replace("- 2026-11-25T10:00:00 · ileti — ham söz",
                                                             "- Kullanıcı: ham söz (ayıklandı)")
        yol.write_text(ayiklanmis, encoding="utf-8")
        sozler_yaz(kok, "s1", ("2026-11-25T12:00:00", kok.name, "ileti", "sonraki söz"))
        rapor.uret(kok, yol)
        metin = yol.read_text(encoding="utf-8")
        self.assertEqual(self._bolum(metin), self._bolum(ayiklanmis))
        self.assertNotIn("sonraki söz", metin)


class OturumBasi(unittest.TestCase):
    """g) Oturum başı, aynı ağaçta başka oturumun son 24 saatteki sözlerinden en çok beşini gösterir."""

    def _baglam(self, kok, oturum="s1"):
        return baglam(ajan_hook.isle("oturum-basi", {"session_id": oturum, "cwd": str(kok), "source": "startup"}, {}))

    def test_baska_oturumun_son_bes_sozu_gosterilir(self):
        kok = depo()
        sozler_yaz(kok, "s0", *[(once(hours=7 - i), kok.name, "ileti", "söz-%d" % i) for i in range(7)])
        c = self._baglam(kok)
        self.assertIn("başka bir oturumun son 24 saatteki sözleri", c)
        self.assertEqual([m for m in ("söz-%d" % i for i in range(7)) if m in c],
                         ["söz-2", "söz-3", "söz-4", "söz-5", "söz-6"])
        self.assertLess(c.index("söz-2"), c.index("söz-6"))

    def test_kayit_200_karakterde_kesilir(self):
        kok = depo()
        sozler_yaz(kok, "s0", (once(hours=1), kok.name, "ileti", "k" * 300))
        c = self._baglam(kok)
        self.assertIn("k" * 199 + "…", c)
        self.assertNotIn("k" * 200, c)

    def test_ayni_oturumun_eski_ve_baska_agacin_sozu_gosterilmez(self):
        kok = depo()
        sozler_yaz(kok, "s1", (once(hours=1), kok.name, "ileti", "kendi-sozum"))
        sozler_yaz(kok, "s0", (once(hours=25), kok.name, "ileti", "eski-soz"),
                   (once(hours=1), "baska", "ileti", "baska-agacin"))
        c = self._baglam(kok)
        for m in ("kendi-sozum", "eski-soz", "baska-agacin", "başka bir oturumun"):
            self.assertNotIn(m, c)

    def test_calisma_agacinda_ana_agactaki_defter_okunur(self):
        ana = git_depo(depo())
        agac = agac_ac(ana, "a")
        istem(agac, "önceki oturumdan", oturum="s0")
        self.assertIn("önceki oturumdan", self._baglam(agac))


class Dayaniklilik(unittest.TestCase):
    """h) Defter yazılamazsa kanca hata vermeden geçirir."""

    def test_defter_yazilamazsa_istem_gecer_ve_plan_paketi_verilir(self):
        kok = kesin_depo()
        (kok / ".harness").mkdir(exist_ok=True)
        (kok / ".harness/soz").write_text("klasör değil", encoding="utf-8")
        self.assertIsNone(istem(kok, "x"))
        self.assertIn("[[KB-PAKET rol=tasarimci", baglam(istem(kok, "y", permission_mode="plan")))
        self.assertIsNone(soru(kok, tool_response={"answers": {"q": "a"}}))

    def test_okunamayan_defter_oturum_ozetini_dusurmez(self):
        kok = depo()
        sozler_yaz(kok, "s0", (once(hours=1), kok.name, "ileti", "x"))
        (kok / ".harness/soz/s0.jsonl").write_bytes(b"\xff\xfe bozuk kodlama\n")
        c = baglam(ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok), "source": "startup"}, {}))
        self.assertIn("[harness]", c)

    def test_bozuk_satir_listelemeyi_dusurmez(self):
        kok = depo()
        sozler_yaz(kok, "s1", ("2026-11-25T10:00:00", "a", "ileti", "sağlam"))
        with (kok / ".harness/soz/s1.jsonl").open("a", encoding="utf-8") as f:
            f.write("{bozuk\n[1]\n")
        self.assertEqual([k["metin"] for k in h.sozler(kok)], ["sağlam"])


class AyarKaydi(unittest.TestCase):
    """c) Soru aracı olayı deponun .claude/settings.json dosyasında PostToolUse eşleyicisiyle kayıtlıdır."""

    def test_soru_araci_eslesicisi_soru_sonrasi_olayini_cagirir(self):
        ayar = json.loads((BURASI.parent.parent / ".claude/settings.json").read_text(encoding="utf-8"))
        komutlar = [k["command"] for g in ayar["hooks"]["PostToolUse"] if g.get("matcher") == "AskUserQuestion"
                    for k in g["hooks"]]
        self.assertEqual(len(komutlar), 1)
        self.assertTrue(komutlar[0].endswith("hook.sh\" soru-sonrasi"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
