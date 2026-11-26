#!/usr/bin/env python3
"""GV-123 (TS-006 Yapı 3, 4, 5) testleri: dosya beyanı isteğe bağlıdır, her koşu ve inceleme geçmişe yazılır,
koşan görev durum çıktılarında 'koşuyor' / 'inceleniyor' görünür.

İşçi ve inceleyici oturumu sahte bir komutla verilir (test_gorev.py düzeni); her test geçici bir git deposu kurar,
gerçek görev kayıtlarına ve gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_kayit.py
"""
from __future__ import annotations

import datetime
import json
import os
import pathlib
import subprocess
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
import rapor  # noqa: E402
import ajan_hook  # noqa: E402
from test_gorev import dolu_kart, gorev_deposu, kayit, sorun_adlari  # noqa: E402
from test_hook import baglam, duzenle, karar  # noqa: E402
from test_plan import HEDEF, OLCUT  # noqa: E402
from test_rapor import cli, gorev_durumu, kayit as sahte_kayit  # noqa: E402

# Sahte oturum. KAYIT_MOD işçinin davranışını seçer:
#   (boş) dokunulan alanı olmayan bitiş · yanlis-beyan: ölçümle uyuşmayan beyan · kapsam-disi: kartın dışına yazar ·
#   tur-siniri: bitiş yazmadan tur sınırında kesilir · alt-ajan: hook defterine alt ajan ve workflow kaydı bırakır ·
#   yavas: zaman aşımına uğrar.
# Her oturum, koşarken ortak kayıtta gördüğü koşu işaretini kendi klasörüne `isaret-<rol>.json` olarak yazar.
SAHTE = r'''
import json, os, pathlib, re, sys, time
kok = pathlib.Path(os.environ["HARNESS_KOK"]); gv = os.environ["HARNESS_GOREV"]
rol = os.environ.get("HARNESS_ROL", "uygulayici")
mod = os.environ.get("KAYIT_MOD", "")
gd = kok / ".harness/gorev" / gv
isaret = kok.parents[2] / ".harness/gorev" / gv / "kosuyor.json"
(gd / ("isaret-%s.json" % rol)).write_text(isaret.read_text(encoding="utf-8") if isaret.is_file() else "null",
                                           encoding="utf-8")
sid = "oturum-" + rol
if rol == "inceleyici":
    istem = sys.argv[sys.argv.index("-p") + 1]
    kurallar = re.findall(r"^\[ \] ((?:KU)-\d{3,}@\d+) ", istem, re.M)
    (gd / "inceleme.json").write_text(json.dumps({
        "gorev": gv, "hukum": "gecti", "ozet": "incelendi", "kosulan": ["python3 -c pass"], "bulgular": [], "bakilmayan": [],
        "olcut": {"karsilandi": True, "kanit": "src/siparis/iptal.ts:1"},
        "kurallar": [{"kimlik": k, "hukum": "uyuyor", "kanit": "src/siparis/iptal.ts:1"} for k in kurallar]}),
        encoding="utf-8")
    print(json.dumps({"type": "result", "subtype": "success", "num_turns": 2, "total_cost_usd": 0.25,
                      "session_id": sid}))
    sys.exit(0)
if mod == "yavas":
    time.sleep(10)
(kok / "src/siparis/iptal.ts").write_text("export const x = 2\n", encoding="utf-8")
if mod == "kapsam-disi":
    (kok / "src/odeme").mkdir(parents=True, exist_ok=True)
    (kok / "src/odeme/a.ts").write_text("export const y = 1\n", encoding="utf-8")
if mod == "alt-ajan":
    defter = kok / ".harness/defter" / (sid + ".jsonl")
    defter.parent.mkdir(parents=True, exist_ok=True)
    olaylar = [{"olay": "paket-verildi", "ajan": "ana", "kanal": None},
               {"olay": "paket-verildi", "ajan": "a1", "kanal": "baslangic"},
               {"olay": "paket-verildi", "ajan": "a2", "kanal": "baslangic"},
               {"olay": "paket-verildi", "ajan": "(workflow)", "kanal": "workflow"},
               {"olay": "gosterildi", "ajan": "a1", "kanal": "baslangic"}]
    defter.write_text("\n".join(json.dumps(o) for o in olaylar) + "\nbozuk satır\n", encoding="utf-8")
kart = (gd / "kart.md").read_text(encoding="utf-8")
kurallar = re.findall(r"^(?:\[ \] )?((?:KU)-\d{3,}@\d+) ", kart, re.M)
bitis = {"gorev": gv, "durum": "tamam", "ozet": "yapıldı", "kararlar": [], "reddedilenler": [], "testler": [],
         "kalan": None, "soru": None, "denenmedi": [],
         "kurallar": [{"kimlik": k, "hukum": "uyuyor", "not": ""} for k in kurallar]}
if mod == "yanlis-beyan":
    bitis["dokunulan"] = ["baska/dosya.ts"]
if mod != "tur-siniri":
    (gd / "bitis.json").write_text(json.dumps(bitis, ensure_ascii=False), encoding="utf-8")
print(json.dumps({"type": "result", "subtype": "error_max_turns" if mod == "tur-siniri" else "success",
                  "is_error": mod == "tur-siniri", "num_turns": 4, "total_cost_usd": 0.5, "session_id": sid}))
'''

RAPOR_ALANLARI = {"gorev", "durum", "sorunlar", "uyarilar", "degisen", "agac", "dal", "taban", "kullanim", "sure_sn",
                  "bitis"}


def kayit_deposu(**gorev_ayari):
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "kayit.py"
    sahte.write_text(SAHTE, encoding="utf-8")
    return gorev_deposu(komut=[sys.executable, str(sahte)], **gorev_ayari)


def yerel(kok, kimlik):
    return h.ortak_kok(kok) / ".harness/agac" / kimlik / ".harness/gorev" / kimlik


def isaret_koy(kok, kimlik, pid, tip="isci", dakika=12):
    basla = (datetime.datetime.now() - datetime.timedelta(minutes=dakika, seconds=5)).isoformat(timespec="seconds")
    (kayit(kok, kimlik) / "kosuyor.json").write_text(json.dumps({"tip": tip, "pid": pid, "basla": basla}),
                                                     encoding="utf-8")


def olu_pid():
    p = subprocess.Popen([sys.executable, "-c", "pass"])
    p.wait()
    return p.pid


def tablo_satiri(kok, kimlik):
    for s in rapor.tablo(kok, [kimlik]).split("\n"):
        if s.startswith("| %s |" % kimlik):
            return [x.strip() for x in s.strip("|").split("|")]
    raise AssertionError("%s tabloda yok" % kimlik)


class Ortam(unittest.TestCase):
    def setUp(self):
        os.environ.pop("KAYIT_MOD", None)

    tearDown = setUp


class Beyan(Ortam):
    """a) 'dokunulan' isteğe bağlıdır; ölçümle uyuşmaması sorun değildir. Kapsam dışı dosya yine sorundur."""

    def test_dokunulan_alani_olmayan_bitis_sorun_uretmez(self):
        kok = kayit_deposu()
        r = gorev.kos(kok, dolu_kart(kok))
        self.assertNotIn("dokunulan", r["bitis"])
        self.assertEqual((r["durum"], r["sorunlar"]), ("tamam", []))
        self.assertEqual(r["degisen"], ["src/siparis/iptal.ts"])

    def test_olcumle_uyusmayan_beyan_sorun_uretmez(self):
        os.environ["KAYIT_MOD"] = "yanlis-beyan"
        kok = kayit_deposu()
        r = gorev.kos(kok, dolu_kart(kok))
        self.assertEqual(r["bitis"]["dokunulan"], ["baska/dosya.ts"])
        self.assertEqual((r["durum"], r["sorunlar"]), ("tamam", []))

    def test_kapsam_disi_dosya_bugunku_gibi_sorundur(self):
        os.environ["KAYIT_MOD"] = "kapsam-disi"
        kok = kayit_deposu()
        r = gorev.kos(kok, dolu_kart(kok))
        self.assertEqual(r["durum"], "sorunlu")
        self.assertEqual(sorun_adlari(r), {"kapsam-disi"})
        self.assertIn("src/odeme/a.ts", r["sorunlar"][0]["mesaj"])

    def test_bitis_dogrula_dokunulani_istemez(self):
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        (kayit(kok, kimlik) / "bitis.json").write_text(json.dumps({
            "gorev": kimlik, "durum": "tamam", "ozet": "x", "kararlar": [], "reddedilenler": [], "denenmedi": [],
            "testler": [], "kurallar": [{"kimlik": "KU-001@1", "hukum": "uyuyor", "not": ""}]}), encoding="utf-8")
        self.assertEqual(gorev.bitis_dogrula(kok, kimlik, kayit(kok, kimlik)), [])

    def test_isci_karti_liste_istemez_olcumu_soyler(self):
        kok = kayit_deposu()
        kart = (kayit(kok, dolu_kart(kok)) / "kart.md").read_text(encoding="utf-8")
        self.assertNotIn('"dokunulan"', kart)
        self.assertIn("Değişen dosyaları araç ölçer", kart)


class Gecmis(Ortam):
    """b) Her işçi koşusu ve inceleme geçmişte bir satırdır; rapor tablosu toplamı ve koşu sayısını gösterir."""

    def test_uc_kosu_iki_inceleme_bes_satir_ve_tablo_toplami(self):
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        for adim in (gorev.kos, gorev.incele, gorev.kos, gorev.incele, gorev.kos):
            adim(kok, kimlik)
        gecmis = gorev.kosu_gecmisi(kayit(kok, kimlik))
        self.assertEqual([k["tip"] for k in gecmis], ["isci", "inceleme", "isci", "inceleme", "isci"])
        self.assertEqual([k["sonuc"] for k in gecmis], ["tamam", "gecti", "tamam", "gecti", "tamam"])
        self.assertEqual([k["tur_sayisi"] for k in gecmis], [4, 2, 4, 2, 4])
        self.assertEqual([k["maliyet_usd"] for k in gecmis], [0.5, 0.25, 0.5, 0.25, 0.5])
        for k in gecmis:
            datetime.datetime.fromisoformat(k["basla"])
            self.assertIsInstance(k["sure_sn"], float)
            self.assertNotIn("alt_ajan", k)   # defter yoksa alt ajan sayısı yazılmaz
        satirlar = (kayit(kok, kimlik) / "kosular.jsonl").read_text(encoding="utf-8").strip().split("\n")
        self.assertEqual(len(satirlar), 5)
        # rapor.json son koşudur ve biçimi değişmedi
        son = json.loads((kayit(kok, kimlik) / "rapor.json").read_text(encoding="utf-8"))
        self.assertEqual(set(son), RAPOR_ALANLARI)
        self.assertEqual(son["sure_sn"], gecmis[-1]["sure_sn"])
        d = json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))
        self.assertEqual(d["kosuldu"], gecmis[-1]["basla"])
        self.assertEqual(d["incelendi"], gecmis[3]["basla"])
        # tablo: süre ve maliyet beşinin toplamı, Koşu hücresi 3 / 2
        s = tablo_satiri(kok, kimlik)
        self.assertEqual(s[4], "3 / 2")
        self.assertEqual(s[5], "%.1f" % (sum(k["sure_sn"] for k in gecmis if k["tip"] == "isci") / 60))
        self.assertEqual(s[6], "%.1f" % (sum(k["sure_sn"] for k in gecmis if k["tip"] == "inceleme") / 60))
        self.assertEqual(s[7], "2.00")   # son koşu ve son inceleme olsaydı 0.75

    def test_sahte_gecmisle_tablo_toplami(self):
        kok = kayit_deposu()
        sahte_kayit(kok, "GV-007", gorev_durumu("GV-007", inceleme="gecti"),
                    rapor={"sure_sn": 180, "degisen": ["a"], "kullanim": {"total_cost_usd": 0.3}},
                    inceleme_rapor={"sure_sn": 90, "kullanim": {"total_cost_usd": 0.05}, "bulgular": []})
        gecmis = [("isci", 60, 0.1), ("inceleme", 30, 0.05), ("isci", 120, 0.2), ("inceleme", 90, 0.05),
                  ("isci", 180, 0.3)]
        (kayit(kok, "GV-007") / "kosular.jsonl").write_text("".join(
            json.dumps({"tip": t, "basla": "2026-11-25T10:00:00", "sure_sn": s, "tur_sayisi": 3, "maliyet_usd": m,
                        "sonuc": "tamam"}) + "\n" for t, s, m in gecmis) + "bozuk satır\n", encoding="utf-8")
        self.assertEqual(tablo_satiri(kok, "GV-007")[4:8], ["3 / 2", "6.0", "2.0", "0.70"])
        self.assertIn("Koşuların ve incelemelerin toplamı: 8.0 dakika, 0.70 dolar.", rapor.tablo(kok, ["GV-007"]))

    def test_gecmisi_olmayan_eski_kayit_bugunku_degerleri_verir(self):
        """c) Geçmiş yoksa son koşu ve son inceleme kullanılır; Koşu hücresi boştur."""
        kok = kayit_deposu()
        sahte_kayit(kok, "GV-007", gorev_durumu("GV-007", inceleme="gecti"),
                    rapor={"sure_sn": 90, "degisen": ["a", "b"], "kullanim": {"total_cost_usd": 1.25}},
                    inceleme_rapor={"sure_sn": 30, "kullanim": {"total_cost_usd": 0.5}, "bulgular": []})
        self.assertEqual(tablo_satiri(kok, "GV-007")[3:9], ["incelendi", "—", "1.5", "0.5", "1.75", "2"])
        self.assertIn("toplamı: 2.0 dakika, 1.75 dolar.", rapor.tablo(kok, ["GV-007"]))

    def test_tur_sinirinda_kesilen_koşu_sonucu_tur_siniri(self):
        os.environ["KAYIT_MOD"] = "tur-siniri"
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "sorunlu")
        self.assertEqual(gorev.kosu_gecmisi(kayit(kok, kimlik))[-1]["sonuc"], "tur-siniri")

    def test_zaman_asimina_ugrayan_kosu_sonucu(self):
        os.environ["KAYIT_MOD"] = "yavas"
        kok = kayit_deposu(zaman_asimi_sn=1)
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        son = gorev.kosu_gecmisi(kayit(kok, kimlik))[-1]
        self.assertEqual((son["tip"], son["sonuc"], son["maliyet_usd"]), ("isci", "zaman-asimi", None))

    def test_alt_ajan_sayilari_oturumun_defterinden(self):
        os.environ["KAYIT_MOD"] = "alt-ajan"
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        son = gorev.kosu_gecmisi(kayit(kok, kimlik))[-1]
        self.assertEqual((son["alt_ajan"], son["workflow"]), (2, 1))

    def test_gecmis_elle_yazilmaz(self):
        kok = kayit_deposu()
        self.assertEqual(karar(duzenle(kok, ".harness/gorev/GV-001/kosular.jsonl")), "deny")


class KosanGorev(Ortam):
    """d) Koşan görev 'koşuyor' / 'inceleniyor' görünür; süreci ölü işaret yok sayılır ve silinir."""

    def test_kosu_ve_inceleme_sirasinda_isaret_vardir_sonra_kalkar(self):
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        for rol, tip in (("uygulayici", "isci"), ("inceleyici", "inceleme")):
            isaret = json.loads((yerel(kok, kimlik) / ("isaret-%s.json" % rol)).read_text(encoding="utf-8"))
            self.assertEqual((isaret["tip"], isaret["pid"]), (tip, os.getpid()))
        self.assertFalse((kayit(kok, kimlik) / "kosuyor.json").exists())

    def test_oturum_baslatilamasa_da_isaret_kalkar(self):
        kok = gorev_deposu(komut=[str(pathlib.Path(tempfile.mkdtemp()) / "yok-boyle-komut")])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata) as e:
            gorev.kos(kok, kimlik)
        self.assertIn("oturum başlatılamadı", str(e.exception))
        self.assertFalse((kayit(kok, kimlik) / "kosuyor.json").exists())
        self.assertEqual(gorev.kosu_gecmisi(kayit(kok, kimlik)), [])

    def test_gorev_durum_kosuyor_ve_inceleniyor_gosterir(self):
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        isaret_koy(kok, kimlik, os.getpid())
        kod, cikti = cli(kok, "gorev", "durum")
        self.assertEqual(kod, 0)
        self.assertIn("%s [koşuyor · 12 dk]" % kimlik, cikti)
        isaret_koy(kok, kimlik, os.getpid(), tip="inceleme", dakika=3)
        self.assertIn("%s [inceleniyor · 3 dk]" % kimlik, cli(kok, "gorev", "durum")[1])

    def test_sureci_olu_isaret_yok_sayilir_ve_silinir(self):
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        isaret_koy(kok, kimlik, olu_pid())
        kod, cikti = cli(kok, "gorev", "durum")
        self.assertIn("%s [bekliyor]" % kimlik, cikti)
        self.assertNotIn("koşuyor", cikti)
        self.assertFalse((kayit(kok, kimlik) / "kosuyor.json").exists())

    def test_bozuk_isaret_yok_sayilir_ve_silinir(self):
        kok = kayit_deposu()
        kimlik = dolu_kart(kok)
        (kayit(kok, kimlik) / "kosuyor.json").write_text("{bozuk", encoding="utf-8")
        self.assertIsNone(gorev.kosu_isareti(kayit(kok, kimlik)))
        self.assertFalse((kayit(kok, kimlik) / "kosuyor.json").exists())

    def test_plan_durum_ve_oturum_basi_kosani_gosterir(self):
        kok = kayit_deposu()
        plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/siparis/**"])
        plan.epic(kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
        _, kimlik = plan.task(kok, "EP-001", "İptal nedeni ekle", rol="uygulayici", hedef=HEDEF, olcut=OLCUT)
        self.assertEqual([y["gorev"] for y in plan.hazir(kok, "EP-001")], [kimlik])
        isaret_koy(kok, kimlik, os.getpid())
        self.assertEqual(plan.oku(kok, "EP-001")["tasklar"][0]["durum"], "koşuyor · 12 dk")
        self.assertEqual(plan.hazir(kok, "EP-001"), [])   # koşan yaprak yeniden koşturulabilir sayılmaz
        kod, cikti = cli(kok, "plan", "durum", "EP-001")
        self.assertEqual(kod, 0)
        self.assertIn("— %s · koşuyor · 12 dk" % kimlik, cikti)
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok), "source": "startup"}, {})
        self.assertIn("Koşan görev: %s koşuyor · 12 dk." % kimlik, baglam(c))
        isaret_koy(kok, kimlik, olu_pid())
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok), "source": "startup"}, {})
        self.assertNotIn("Koşan görev", baglam(c))
        self.assertEqual(plan.oku(kok, "EP-001")["tasklar"][0]["durum"], "bekliyor")


if __name__ == "__main__":
    unittest.main(verbosity=1)
