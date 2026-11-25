#!/usr/bin/env python3
"""GV-124 (TS-006 Yapı 6, 7, 8, 9) testleri: görev ağacını tazeleme, dosya listesini genişletme, ana oturumun notu ve
sınırda kesilen işçinin kendiliğinden sürdürülmesi.

İşçi ve inceleyici oturumu sahte bir komutla verilir (test_gorev.py düzeni); her test geçici bir git deposu kurar,
gerçek görev kayıtlarına ve gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_yasam.py
"""
from __future__ import annotations

import json
import os
import pathlib
import re
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
from test_gorev import agac, dolu_kart, durum, gorev_deposu, kayit, sorun_adlari  # noqa: E402
from test_h import git  # noqa: E402
from test_hook import gerekce, karar, komut  # noqa: E402

# Sahte oturum. YASAM_MOD işçinin davranışını seçer:
#   (boş) dosyayı değiştirir, bitiş yazar · dokunmaz: dosyaya dokunmadan bitiş yazar ·
#   kapsam-disi: kartın dışına da yazar · kesik-bir: ilk oturumda tur sınırında kesilir, sonra bitirir ·
#   kesik-hep: her oturumda kesilir · kesik-bos: dosyaya dokunmadan kesilir ·
#   kesik-sure-bir: ilk oturumda dosyayı yazıp süre sınırını aşar, sonra bitirir.
# Her oturum aldığı istemi kendi klasöründeki istemler.jsonl dosyasına ekler; oturum sayısı oradan okunur.
SAHTE = r'''
import json, os, pathlib, re, sys
kok = pathlib.Path(os.environ["HARNESS_KOK"]); gv = os.environ["HARNESS_GOREV"]
rol = os.environ.get("HARNESS_ROL", "uygulayici")
mod = os.environ.get("YASAM_MOD", "")
gd = kok / ".harness/gorev" / gv
istem = sys.argv[sys.argv.index("-p") + 1]
if rol == "inceleyici":
    kurallar = re.findall(r"^\[ \] ((?:KU)-\d{3,}@\d+) ", istem, re.M)
    (gd / "inceleme.json").write_text(json.dumps({
        "gorev": gv, "hukum": "gecti", "ozet": "incelendi", "kosulan": ["python3 -c pass"], "bulgular": [],
        "olcut": {"karsilandi": True, "kanit": "src/siparis/iptal.ts:1"},
        "kurallar": [{"kimlik": k, "hukum": "uyuyor", "kanit": "src/siparis/iptal.ts:1"} for k in kurallar]}),
        encoding="utf-8")
    print(json.dumps({"type": "result", "subtype": "success", "num_turns": 2, "total_cost_usd": 0.25}))
    sys.exit(0)
gecmis = gd / "istemler.jsonl"
sira = len(gecmis.read_text(encoding="utf-8").splitlines()) if gecmis.is_file() else 0
with gecmis.open("a", encoding="utf-8") as f:
    f.write(json.dumps(istem) + "\n")
if mod not in ("dokunmaz", "kesik-bos"):
    (kok / "src/siparis/iptal.ts").write_text("export const x = 2\n", encoding="utf-8")
if mod == "kapsam-disi":
    (kok / "src/odeme").mkdir(parents=True, exist_ok=True)
    (kok / "src/odeme/a.ts").write_text("export const y = 1\n", encoding="utf-8")
if mod == "kesik-sure-bir" and sira == 0:
    import time; time.sleep(10)
kesildi = mod in ("kesik-hep", "kesik-bos") or (mod == "kesik-bir" and sira == 0)
if not kesildi:
    kart = (gd / "kart.md").read_text(encoding="utf-8")
    kurallar = re.findall(r"^(?:\[ \] )?((?:KU)-\d{3,}@\d+) ", kart, re.M)
    (gd / "bitis.json").write_text(json.dumps({
        "gorev": gv, "durum": "tamam", "ozet": "yapıldı", "kararlar": [], "reddedilenler": [], "testler": [],
        "kalan": None, "soru": None, "denenmedi": [],
        "kurallar": [{"kimlik": k, "hukum": "uyuyor", "not": ""} for k in kurallar]}, ensure_ascii=False),
        encoding="utf-8")
print(json.dumps({"type": "result", "subtype": "error_max_turns" if kesildi else "success", "is_error": kesildi,
                  "num_turns": 4, "total_cost_usd": 0.5}))
'''


def yasam_deposu(**gorev_ayari):
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "yasam.py"
    sahte.write_text(SAHTE, encoding="utf-8")
    return gorev_deposu(komut=[sys.executable, str(sahte)], **gorev_ayari)


def istemler(kok, kimlik):
    yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "istemler.jsonl"
    return [json.loads(s) for s in yol.read_text(encoding="utf-8").splitlines()] if yol.is_file() else []


def isci_kosulari(kok, kimlik):
    return [s for s in gorev.kosu_gecmisi(kayit(kok, kimlik)) if s["tip"] == "isci"]


def oturum_dalina_ekle(kok, yol, icerik):
    """Oturum dalına (testte ana deponun dalı) yeni bir commit ekler; yeni ucu döner."""
    p = kok / yol
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(icerik, encoding="utf-8")
    git(kok, "add", "-A")
    git(kok, "commit", "-q", "-m", "oturum: " + yol)
    return git(kok, "rev-parse", "HEAD").strip()


def agac_hali(kok, kimlik):
    """Görev ağacının ve dalının ölçülebilir hâli: dalın ucu, git durumu ve izlenmeyenler dahil dosya içerikleri."""
    a = agac(kok, kimlik)
    dosyalar = {}
    for p in sorted(a.rglob("*")):
        goreli = p.relative_to(a).as_posix()
        if p.is_file() and not goreli.startswith((".git", ".harness/")):
            dosyalar[goreli] = p.read_bytes()
    return (git(kok, "rev-parse", "refs/heads/gorev/" + kimlik), git(a, "status", "--porcelain", "--untracked-files=all"),
            dosyalar)


class Ortam(unittest.TestCase):
    def setUp(self):
        os.environ.pop("YASAM_MOD", None)

    tearDown = setUp


class Tazele(Ortam):
    """a, b, c) Ağaç oturum dalının ucuna gelir; işçinin işi korunur; çakışmada hiçbir şey değişmez."""

    def test_degisiklik_yoksa_agac_oturum_dalinin_ucuna_gelir(self):
        os.environ["YASAM_MOD"] = "dokunmaz"
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        uc = oturum_dalina_ekle(kok, "src/siparis/yeni.ts", "export const yeni = 1\n")
        self.assertFalse((agac(kok, kimlik) / "src/siparis/yeni.ts").exists())
        gorev.tazele(kok, kimlik)
        self.assertEqual(git(agac(kok, kimlik), "rev-parse", "HEAD").strip(), uc)
        self.assertTrue((agac(kok, kimlik) / "src/siparis/yeni.ts").is_file())
        self.assertEqual(durum(kok, kimlik)["taban"], uc)

    def test_degisiklik_varsa_isci_isi_durur_ve_yeni_dosya_gelir(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        (agac(kok, kimlik) / "src/siparis/taslak.ts").write_text("export const t = 1\n", encoding="utf-8")
        uc = oturum_dalina_ekle(kok, "src/siparis/yeni.ts", "export const yeni = 1\n")
        sonuc = gorev.tazele(kok, kimlik)
        a = agac(kok, kimlik)
        self.assertEqual((a / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertEqual((a / "src/siparis/taslak.ts").read_text(encoding="utf-8"), "export const t = 1\n")
        self.assertEqual((a / "src/siparis/yeni.ts").read_text(encoding="utf-8"), "export const yeni = 1\n")
        self.assertEqual(git(a, "rev-parse", "HEAD").strip(), uc)       # dal uçta, iş commit'siz değişiklik
        self.assertEqual(sonuc["degisen"], ["src/siparis/iptal.ts", "src/siparis/taslak.ts"])
        self.assertEqual(durum(kok, kimlik)["taban"], uc)

    def test_tazelenen_is_degismis_sayilmaz_ama_yeniden_inceleme_ister(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        oturum_dalina_ekle(kok, "src/siparis/yeni.ts", "export const yeni = 1\n")
        gorev.tazele(kok, kimlik)
        self.assertIsNone(durum(kok, kimlik)["inceleme"])
        with self.assertRaisesRegex(h.HarnessHata, "inceleme yapılmadı"):
            gorev.al(kok, kimlik)
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")   # 'iş değişmiş' diye durmaz
        gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertTrue((kok / "src/siparis/yeni.ts").is_file())

    def test_kosumdan_sonra_degisen_is_tazelemeyle_aklanmaz(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        (agac(kok, kimlik) / "src/siparis/iptal.ts").write_text("export const x = 5\n", encoding="utf-8")
        oturum_dalina_ekle(kok, "src/siparis/yeni.ts", "export const yeni = 1\n")
        gorev.tazele(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, "değişmiş"):
            gorev.incele(kok, kimlik)

    def test_cakismada_cakisan_dosya_bildirilir_agac_ve_dal_aynen_kalir(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        (agac(kok, kimlik) / "src/siparis/taslak.ts").write_text("export const t = 1\n", encoding="utf-8")
        oturum_dalina_ekle(kok, "src/siparis/iptal.ts", "export const x = 9\n")
        once, kayit_once = agac_hali(kok, kimlik), (kayit(kok, kimlik) / "durum.json").read_bytes()
        with self.assertRaisesRegex(h.HarnessHata, r"çakışıyor.*src/siparis/iptal\.ts"):
            gorev.tazele(kok, kimlik)
        self.assertEqual(agac_hali(kok, kimlik), once)
        self.assertEqual((kayit(kok, kimlik) / "durum.json").read_bytes(), kayit_once)

    def test_komut_satiri_cakismada_sifirdan_farkli_kodla_cikar(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        oturum_dalina_ekle(kok, "src/siparis/iptal.ts", "export const x = 9\n")
        eski = os.getcwd()
        try:
            os.chdir(kok)
            self.assertEqual(h.main(["h.py", "gorev", "tazele", kimlik]), 2)
        finally:
            os.chdir(eski)

    def test_gorevin_acildigi_daldan_baska_dalda_tazelenmez(self):
        os.environ["YASAM_MOD"] = "dokunmaz"
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        git(kok, "checkout", "-q", "-b", "baska")
        oturum_dalina_ekle(kok, "src/siparis/yeni.ts", "export const yeni = 1\n")
        once = agac_hali(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, "`main` dalından açıldı, bu oturum `baska` dalında"):
            gorev.tazele(kok, kimlik)
        self.assertEqual(agac_hali(kok, kimlik), once)

    def test_tazeleme_raporun_dosya_listesini_yeni_tabana_gore_yeniler(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertEqual(gorev._json_oku(kayit(kok, kimlik) / "rapor.json")["degisen"], ["src/siparis/iptal.ts"])
        uc = oturum_dalina_ekle(kok, "src/siparis/iptal.ts", "export const x = 2\n")   # oturum dalı aynı değişikliği aldı
        gorev.tazele(kok, kimlik)
        rapor = gorev._json_oku(kayit(kok, kimlik) / "rapor.json")
        self.assertEqual((rapor["degisen"], rapor["taban"]), ([], uc[:8]))
        self.assertIn("0 dosyalık değişiklik", gorev.ozet(kok, kimlik, "al"))


class KapanmisGorev(Ortam):
    """d) Alınmış ya da atılmış görev tazelenemez ve genişletilemez."""

    def _dener(self, kok, kimlik):
        with self.assertRaisesRegex(h.HarnessHata, "kapanmış"):
            gorev.tazele(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, "kapanmış"):
            gorev.genislet(kok, kimlik, ["src/odeme/**"])

    def test_alinmis_gorev(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        gorev.al(kok, kimlik)
        self._dener(kok, kimlik)

    def test_atilmis_gorev(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.at(kok, kimlik)
        self._dener(kok, kimlik)
        self.assertEqual(durum(kok, kimlik)["yollar"], ["src/siparis/**"])


class Genislet(Ortam):
    """e) Yeni desen kayıtta ve kartta; eklenen yoldaki değişiklik kapsam dışı sayılmaz; kartta tarihli satır."""

    def test_eklenen_yol_kayitta_kartta_ve_tarihli_satirda(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.komut(kok, ["genislet", kimlik, "--yol", "src/odeme/**"]), 0)
        self.assertEqual(durum(kok, kimlik)["yollar"], ["src/siparis/**", "src/odeme/**"])
        kart = (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")
        self.assertEqual(gorev._bolum(kart, "Dosyalar"), "- src/siparis/**\n- src/odeme/**")
        self.assertIn("yol=src/siparis/**,src/odeme/**", kart)
        self.assertRegex(kart, r"Kapsam değişikliği \(\d{4}-\d{2}-\d{2}T[\d:]+, `main` dalındaki oturum.*`src/odeme/\*\*`")

    def test_eklenen_yoldaki_degisiklik_artik_kapsam_disi_sayilmaz(self):
        os.environ["YASAM_MOD"] = "kapsam-disi"
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        self.assertIn("kapsam-disi", sorun_adlari(gorev.kos(kok, kimlik)))
        gorev.genislet(kok, kimlik, ["src/odeme/**"])
        r = gorev.kos(kok, kimlik)
        self.assertEqual((r["durum"], r["sorunlar"]), ("tamam", []))
        self.assertIn("src/odeme/a.ts", r["degisen"])

    def test_listede_olan_yol_yeniden_eklenmez(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        with self.assertRaisesRegex(h.HarnessHata, "zaten listede"):
            gorev.genislet(kok, kimlik, ["src/siparis/**"])

    def test_genisletme_kosturma_ve_alma_gibi_sorulur(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        c = komut(kok, "python3 harness/h.py gorev genislet %s --yol 'src/odeme/**'" % kimlik)
        self.assertEqual(karar(c), "ask")
        self.assertIn("eklenecek: src/odeme/**", gerekce(c))
        self.assertIsNone(komut(yasam_deposu(onay="yok"), "python3 harness/h.py gorev genislet GV-001 --yol x/**"))

    def test_ozet_yalniz_komut_satirinin_okudugu_yollari_gosterir(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        c = komut(kok, "python3 harness/h.py gorev genislet %s --yol a/** --yol=b/** && "
                       "python3 harness/h.py paket --rol uygulayici --yol c/**" % kimlik)
        self.assertIn("eklenecek: a/**\n", gerekce(c) + "\n")

    def test_isci_kendi_kapsamini_genisletemez_ve_tazeleyemez(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        for islem in ("genislet %s --yol src/**" % kimlik, "tazele " + kimlik):
            c = komut(kok, "python3 harness/h.py gorev " + islem, ortam={"HARNESS_GOREV": kimlik})
            self.assertEqual(karar(c), "deny", islem)


class Not(Ortam):
    """f) --not ile verilen metin o koşunun ve sonraki koşunun isteminde vardır; kayıtta saklanır."""

    def test_not_bu_ve_sonraki_kosunun_isteminde(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertNotIn("Ana oturumun notları", istemler(kok, kimlik)[0])
        self.assertEqual(gorev.komut(kok, ["kos", kimlik, "--not", "NOT-ISARETI-4417: B yolunu seç"]), 0)
        gorev.kos(kok, kimlik)
        for istem in istemler(kok, kimlik)[1:]:
            self.assertIn("## Ana oturumun notları", istem)
            self.assertIn("NOT-ISARETI-4417: B yolunu seç", istem)
        notlar = json.loads((kayit(kok, kimlik) / "notlar.json").read_text(encoding="utf-8"))["notlar"]
        self.assertEqual([n["not"] for n in notlar], ["NOT-ISARETI-4417: B yolunu seç"])

    def test_not_ve_cevap_birlikte_verilebilir(self):
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        b = json.loads((kayit(kok, kimlik) / "bitis.json").read_text(encoding="utf-8"))
        b.update(durum="soru", soru="hangisi?")
        (kayit(kok, kimlik) / "bitis.json").write_text(json.dumps(b), encoding="utf-8")
        gorev.kos(kok, kimlik, cevap="CEVAP-1", notu="NOT-2")
        istem = istemler(kok, kimlik)[-1]
        self.assertIn("Cevap: CEVAP-1", istem)
        self.assertIn("NOT-2", istem)


class Devam(Ortam):
    """g, h) Sınırda kesilen işçi bir kez kendiliğinden sürdürülür; ikinci kesilmede ya da ayar 0 iken durur;
    ağaçta değişiklik yoksa sürdürülmez."""

    def test_bir_kez_kesilen_isci_ayni_cagrida_tamamlanir_iki_kosu_kaydi(self):
        os.environ["YASAM_MOD"] = "kesik-bir"
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        r = gorev.kos(kok, kimlik)
        self.assertEqual((r["durum"], r["sorunlar"]), ("tamam", []))
        self.assertEqual([s["sonuc"] for s in isci_kosulari(kok, kimlik)], ["tur-siniri", "tamam"])
        ist = istemler(kok, kimlik)
        self.assertEqual(len(ist), 2)
        self.assertNotIn("sınırda kesildi", ist[0])
        self.assertIn("## Önceki oturum sınırda kesildi", ist[1])
        self.assertIn("Önce ağacın durumunu ölç", ist[1])

    def test_sure_sinirinda_kesilen_isci_de_surdurulur(self):
        os.environ["YASAM_MOD"] = "kesik-sure-bir"
        kok = yasam_deposu(zaman_asimi_sn=2)
        kimlik = dolu_kart(kok)
        r = gorev.kos(kok, kimlik)
        self.assertEqual((r["durum"], r["sorunlar"]), ("tamam", []))
        self.assertEqual([s["sonuc"] for s in isci_kosulari(kok, kimlik)], ["zaman-asimi", "tamam"])
        self.assertIn("süre sınırında kesildi", istemler(kok, kimlik)[1])

    def test_iki_kez_kesilirse_durur_ve_sorunu_bildirir(self):
        os.environ["YASAM_MOD"] = "kesik-hep"
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        r = gorev.kos(kok, kimlik)
        self.assertEqual(r["durum"], "sorunlu")
        self.assertIn("sozlesmesiz", sorun_adlari(r))
        self.assertEqual(len(istemler(kok, kimlik)), 2)
        self.assertEqual([s["sonuc"] for s in isci_kosulari(kok, kimlik)], ["tur-siniri", "tur-siniri"])

    def test_ayar_sifirken_surdurulmez(self):
        os.environ["YASAM_MOD"] = "kesik-bir"
        kok = yasam_deposu(kendiliginden_devam=0)
        kimlik = dolu_kart(kok)
        r = gorev.kos(kok, kimlik)
        self.assertEqual(r["durum"], "sorunlu")
        self.assertEqual(len(istemler(kok, kimlik)), 1)
        self.assertEqual(len(isci_kosulari(kok, kimlik)), 1)

    def test_agacta_degisiklik_yokken_kesilen_oturum_surdurulmez(self):
        os.environ["YASAM_MOD"] = "kesik-bos"
        kok = yasam_deposu()
        kimlik = dolu_kart(kok)
        r = gorev.kos(kok, kimlik)
        self.assertEqual(r["durum"], "sorunlu")
        self.assertEqual(len(istemler(kok, kimlik)), 1)

    def test_varsayilan_bir_kezdir_ve_onay_ozetinde_soylenir(self):
        kok = yasam_deposu(kendiliginden_devam="VARSAYILAN")
        self.assertEqual(h.ayar_oku(kok)["gorev"]["kendiliginden_devam"], 1)
        self.assertIn("en çok 1 kez kendiliğinden sürdürülür", gorev.ozet(kok, dolu_kart(kok)))


if __name__ == "__main__":
    unittest.main(verbosity=1)
