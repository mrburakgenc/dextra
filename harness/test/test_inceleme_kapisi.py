#!/usr/bin/env python3
"""GV-160 (TS-009 Yapı 1, 2 ve 9) testleri: inceleme kapısı ölçüt hükmünü, koşturulan komutları ve bakılmayan alanı
okur; inceleme istemi iki ekseni ve koku listesini taşır.

İşçi ve inceleyici oturumu sahte bir komutla verilir (test_gorev.py düzeni); her test geçici bir git deposu kurar,
gerçek görev kayıtlarına ve gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_inceleme_kapisi.py
"""
from __future__ import annotations

import contextlib
import io
import json
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
import gorev  # noqa: E402
import rapor  # noqa: E402
from test_gorev import dolu_kart, gorev_deposu, kayit, sorun_adlari  # noqa: E402
from test_rapor import cli, gorev_durumu, kayit as sahte_kayit, sablonlu_depo  # noqa: E402

# Sahte oturum. İnceleyici tam bir kayıt yazar; INCELEME_EK ile verilen alanlar üzerine yazılır,
# INCELEME_SIL ile verilen alanlar silinir. Her oturum kendi sayısını oturumlar.txt dosyasına ekler.
SAHTE = r'''
import json, os, pathlib, re, sys
kok = pathlib.Path(os.environ["HARNESS_KOK"]); gv = os.environ["HARNESS_GOREV"]
rol = os.environ.get("HARNESS_ROL", "uygulayici")
gd = kok / ".harness/gorev" / gv
with (kok.parents[2] / ".harness/gorev" / gv / "oturumlar.txt").open("a", encoding="utf-8") as f:
    f.write(rol + "\n")
istem = sys.argv[sys.argv.index("-p") + 1]
print(json.dumps({"type": "result", "subtype": "success", "num_turns": 2, "total_cost_usd": 0.1}))
if rol == "inceleyici":
    kayit = {"gorev": gv, "hukum": "gecti", "ozet": "incelendi", "kosulan": ["python3 -c pass"], "bulgular": [],
             "olcut": {"karsilandi": True, "kanit": "src/siparis/iptal.ts:1"}, "bakilmayan": [],
             "kurallar": [{"kimlik": k, "hukum": "uyuyor", "kanit": "src/siparis/iptal.ts:1"}
                          for k in re.findall(r"^\[ \] ((?:KU)-\d{3,}@\d+) ", istem, re.M)]}
    kayit.update(json.loads(os.environ.get("INCELEME_EK") or "{}"))
    for ad in json.loads(os.environ.get("INCELEME_SIL") or "[]"):
        del kayit[ad]
    (gd / "inceleme.json").write_text(json.dumps(kayit, ensure_ascii=False), encoding="utf-8")
    sys.exit(0)
(kok / "src/siparis/iptal.ts").write_text("export const x = 2\n", encoding="utf-8")
kurallar = re.findall(r"^(?:\[ \] )?((?:KU)-\d{3,}@\d+) ", istem, re.M)
(gd / "bitis.json").write_text(json.dumps({
    "gorev": gv, "durum": "tamam", "ozet": "yapıldı", "kararlar": [], "reddedilenler": [], "testler": [],
    "kalan": None, "soru": None, "denenmedi": [],
    "kurallar": [{"kimlik": k, "hukum": "uyuyor", "not": ""} for k in kurallar]}), encoding="utf-8")
'''


def kosmus_gorev():
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "inceleme.py"
    sahte.write_text(SAHTE, encoding="utf-8")
    kok = gorev_deposu(komut=[sys.executable, str(sahte)])
    kimlik = dolu_kart(kok)
    gorev.kos(kok, kimlik)
    return kok, kimlik


def cikti(islev, *arg) -> str:
    tampon = io.StringIO()
    with contextlib.redirect_stdout(tampon):
        islev(*arg)
    return tampon.getvalue()


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("INCELEME_EK", "INCELEME_SIL"):
            os.environ.pop(ad, None)

    tearDown = setUp

    def incele(self, ek=None, sil=None):
        kok, kimlik = kosmus_gorev()
        os.environ["INCELEME_EK"] = json.dumps(ek or {})
        os.environ["INCELEME_SIL"] = json.dumps(sil or [])
        return kok, kimlik, gorev.incele(kok, kimlik)


class OlcutHukmu(Ortam):
    def test_olcut_alani_olmayan_yeni_kayit_gecersizdir(self):
        _, _, r = self.incele(sil=["olcut"])
        self.assertIn("eksik-alan", sorun_adlari(r))
        self.assertEqual(r["sonuc"], "sorunlu")

    def test_genel_hukum_gecti_olsa_da_karsilanmayan_olcut_isi_kaldirir(self):
        kok, kimlik, r = self.incele(ek={"olcut": {"karsilandi": False, "kanit": "test kırmızı"}})
        self.assertEqual((r["sonuc"], r["sorunlar"]), ("kaldi", []))
        self.assertEqual(json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))["inceleme"],
                         "kaldi")

    def test_kanitsiz_karsilanan_olcut_gecersizdir(self):
        _, _, r = self.incele(ek={"olcut": {"karsilandi": True, "kanit": "  "}})
        self.assertIn("kanitsiz-olcut", sorun_adlari(r))
        self.assertEqual(r["sonuc"], "sorunlu")

    def test_butun_alanlar_dolu_ve_engel_yoksa_gecer(self):
        _, _, r = self.incele()
        self.assertEqual((r["sonuc"], r["sorunlar"]), ("gecti", []))


class KosulanKomut(Ortam):
    def test_gecti_hukmu_kosulmus_komut_ister(self):
        _, _, r = self.incele(ek={"kosulan": []})
        self.assertIn("kosulmadi", sorun_adlari(r))
        self.assertEqual(r["sonuc"], "sorunlu")

    def test_kaldi_hukmunde_kosulan_bos_olabilir(self):
        _, _, r = self.incele(ek={"hukum": "kaldi", "kosulan": []})
        self.assertEqual((r["sonuc"], r["sorunlar"]), ("kaldi", []))


class BakilmayanAlan(Ortam):
    def test_bakilmayan_alani_olmayan_kayit_gecersizdir(self):
        _, _, r = self.incele(sil=["bakilmayan"])
        self.assertIn("eksik-alan", sorun_adlari(r))

    def test_bos_bakilmayan_listesi_gecerlidir(self):
        _, _, r = self.incele(ek={"bakilmayan": []})
        self.assertEqual((r["sonuc"], r["sorunlar"]), ("gecti", []))

    def test_dolu_bakilmayan_listesi_inceleme_ozetinde_gorunur(self):
        kok, kimlik = kosmus_gorev()
        os.environ["INCELEME_EK"] = json.dumps({"bakilmayan": ["BAKILMAYAN-ISARETI-41 mobil ekran"]})
        ozet = cikti(gorev.komut, kok, ["incele", kimlik])
        self.assertIn("BAKILMAYAN-ISARETI-41 mobil ekran", ozet)


class OzetSatiri(Ortam):
    def test_inceleme_ozeti_olcut_hukmunu_kural_hukumlerinden_ayri_satirda_gosterir(self):
        kok, kimlik = kosmus_gorev()
        os.environ["INCELEME_EK"] = json.dumps({"olcut": {"karsilandi": False, "kanit": "OLCUT-KANIT-77"}})
        satirlar = cikti(gorev.komut, kok, ["incele", kimlik]).splitlines()
        olcut = [s for s in satirlar if "OLCUT-KANIT-77" in s]
        self.assertEqual(len(olcut), 1)
        self.assertIn("karşılanmadı", olcut[0])
        self.assertNotIn("inceleyicinin hükmü", olcut[0])
        self.assertTrue(any("inceleyicinin hükmü" in s for s in satirlar))

    def test_gorev_durum_olcut_hukmunu_ayri_satirda_gosterir(self):
        kok, kimlik = kosmus_gorev()
        os.environ["INCELEME_EK"] = json.dumps({"olcut": {"karsilandi": True, "kanit": "OLCUT-KANIT-88"}})
        gorev.incele(kok, kimlik)
        satirlar = cikti(gorev.komut, kok, ["durum"]).splitlines()
        olcut = [s for s in satirlar if "OLCUT-KANIT-88" in s]
        self.assertEqual(len(olcut), 1)
        self.assertIn("karşılandı", olcut[0])
        self.assertNotIn(kimlik, olcut[0])   # görev satırından ayrı satır


class EskiKayit(unittest.TestCase):
    def test_olcutsuz_ve_bakilmayansiz_eski_kayitli_alinmis_gorev_durum_ve_rapor_uretinde_okunur(self):
        kok = sablonlu_depo()
        eski = {"gorev": "GV-001", "hukum": "gecti", "ozet": "eski", "kurallar": [], "bulgular": [],
                "kosulan": []}
        sahte_kayit(kok, "GV-001", gorev_durumu("GV-001", "Eski iş", alindi=True, inceleme="gecti"),
                    rapor={"sure_sn": 60, "degisen": ["a"], "kullanim": {"total_cost_usd": 0.2}},
                    inceleme=eski,
                    inceleme_rapor={"gorev": "GV-001", "sonuc": "gecti", "sorunlar": [], "celiskiler": [],
                                    "bulgular": [{"onem": "oneri", "dosya": "a", "satir": 1, "aciklama": "x"}],
                                    "kurallar": [], "ozet": "eski", "kosulan": [], "sure_sn": 30})
        kod, metin = cli(kok, "gorev", "durum")
        self.assertEqual(kod, 0, metin)
        self.assertIn("GV-001 [alındı]", metin)
        yol = rapor.yeni(kok, "Eski", "2026-11-26")
        kod, metin = cli(kok, "rapor", "uret", str(yol.relative_to(kok)))
        self.assertEqual(kod, 0, metin)
        self.assertIn("| GV-001 |", yol.read_text(encoding="utf-8"))


class IncelemeIstemi(Ortam):
    def test_istem_iki_ekseni_alti_kokuyu_ve_uc_siniri_tasir(self):
        kok, kimlik = kosmus_gorev()
        gorev.incele(kok, kimlik)
        istem = (kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        tek = " ".join(istem.split())
        self.assertIn("Ölçüt ve kurallar iki ayrı eksendir", tek)
        self.assertIn("biri geçti diye öbürü geçmiş sayılmaz", tek)
        for koku in ("tekrar eden kod", "gereksiz genelleme", "yalnız aktaran aracı parça", "birlikte dolaşan veri öbeği",
                     "ilkel tiple taşınan alan kavramı", "ne yaptığını söylemeyen ad"):
            self.assertIn(koku, tek)
        self.assertIn("en çok üç koku önerisi", tek)
        self.assertIn('"bakilmayan"', istem)
        self.assertIn("geçti hükmü en az bir koşturulmuş komut ister", tek)
        self.assertNotIn("hiçbir şey çalıştırmadıysan boş liste", tek)

    def test_incele_ikinci_bir_oturum_baslatmaz(self):
        kok, kimlik = kosmus_gorev()
        gorev.incele(kok, kimlik)
        oturumlar = (kayit(kok, kimlik) / "oturumlar.txt").read_text(encoding="utf-8").split()
        self.assertEqual(oturumlar, ["uygulayici", "inceleyici"])


if __name__ == "__main__":
    unittest.main()
