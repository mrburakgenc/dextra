#!/usr/bin/env python3
"""gorev.py testleri: `claude -p` yerine sahte bir işçi ve sahte bir inceleyici koşturulur.

Her görev kendi çalışma ağacında (worktree) koşar; bu yüzden örnek depolar gerçek git depolarıdır.

Koşum: python3 harness/test/test_gorev.py
"""
from __future__ import annotations

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
import h  # noqa: E402
import gorev  # noqa: E402
import ajan_hook  # noqa: E402
from test_h import agac_ac, depo, git, git_depo  # noqa: E402
from test_hook import duzenle, gerekce, karar, kesin_depo, komut  # noqa: E402

OZET_ISARETI = "OZET-ISARETI-7391"

# Sahte oturum: gerçek `claude -p` gibi çağrılır. Rolü HARNESS_ROL söyler;
# işçinin davranışı SAHTE_MOD, inceleyicinin davranışı SAHTE_INCELEME ile seçilir.
SAHTE_ISCI = r'''
import json, os, pathlib, re, sys, time
kok = pathlib.Path(os.environ["HARNESS_KOK"]); gv = os.environ["HARNESS_GOREV"]
rol = os.environ.get("HARNESS_ROL", "uygulayici")
gd = kok / ".harness/gorev" / gv
(gd / ("argv-%s.json" % rol)).write_text(json.dumps(sys.argv[1:]), encoding="utf-8")
(gd / ("girdi-%s.json" % rol)).write_text(json.dumps(os.path.samestat(os.fstat(0), os.stat(os.devnull))), encoding="utf-8")
(gd / ("ortam-%s.json" % rol)).write_text(json.dumps(sorted(k for k in os.environ if k.startswith("CLAUDE"))), encoding="utf-8")
cikti = json.dumps({"type": "result", "is_error": False, "num_turns": 3, "result": "bitti",
                    "total_cost_usd": 0.01, "usage": {"input_tokens": 1200, "output_tokens": 340}})
if rol == "inceleyici":
    mod = os.environ.get("SAHTE_INCELEME", "gecti")
    istem = sys.argv[sys.argv.index("-p") + 1]
    kurallar = re.findall(r"^\[ \] ((?:KU)-\d{3,}@\d+) ", istem, re.M)
    if mod == "dokunur":
        (kok / "src/siparis/iptal.ts").write_text("export const x = 3\n", encoding="utf-8")
    kayit = {"gorev": gv, "hukum": "kaldi" if mod in ("kaldi", "kanitsiz") else "gecti", "ozet": "incelendi",
             "kosulan": [] if mod == "kosulansiz" else ["python3 -c 'import iptal'"],
             "olcut": {"karsilandi": mod != "kaldi", "kanit": "src/siparis/iptal.ts:1"},
             "kurallar": [{"kimlik": k, "hukum": "uymuyor" if mod == "celiski" else "uyuyor",
                           "kanit": "src/siparis/iptal.ts:1"} for k in kurallar],
             "bulgular": [{"dosya": "src/siparis/iptal.ts", "satir": 1, "onem": "engel",
                           "aciklama": "neden kodu denetlenmiyor",
                           "kanit": "" if mod == "kanitsiz" else "src/siparis/iptal.ts:1 denetim yok"}]
             if mod in ("kaldi", "kanitsiz") else []}
    if mod == "kosulansiz":
        del kayit["kosulan"]
    if mod != "yok":
        (gd / "inceleme.json").write_text(json.dumps(kayit, ensure_ascii=False), encoding="utf-8")
    print(cikti)
    sys.exit(0)
mod = os.environ.get("SAHTE_MOD", "tamam")
if mod == "yavas":
    time.sleep(10)
if mod == "agac-disi":   # kendi ağacından çıkıp ana ağaca yazar
    (kok.parents[2] / "src/siparis/disarida.ts").write_text("export const y = 1\n", encoding="utf-8")
if mod != "dokunmaz":
    hedef = kok / ("src/odeme/a.ts" if mod == "kapsam-disi" else "src/siparis/iptal.ts")
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text("export const x = 2\n" + ("" if gv == "GV-001" else "// %s\n" % gv), encoding="utf-8")
kart = (gd / "kart.md").read_text(encoding="utf-8")
kurallar = re.findall(r"^(?:\[ \] )?((?:KU)-\d{3,}@\d+) ", kart, re.M)
bitis = {"gorev": gv, "durum": "tamam", "ozet": "OZET-ISARETI-7391", "dokunulan": ["src/siparis/iptal.ts"],
         "kararlar": [], "reddedilenler": [], "testler": [], "kalan": None, "soru": None, "denenmedi": [],
         "kurallar": [] if mod == "hukumsuz" else [{"kimlik": k, "hukum": "uyuyor", "not": ""} for k in kurallar]}
if mod == "denenmedisiz":
    del bitis["denenmedi"]
if mod != "sozlesmesiz":
    (gd / "bitis.json").write_text(json.dumps(bitis, ensure_ascii=False), encoding="utf-8")
print(cikti)
'''


def gorev_deposu(kesin: bool = False, git_li: bool = True, **gorev_ayari):
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "isci.py"
    sahte.write_text(SAHTE_ISCI, encoding="utf-8")
    ayar = {"gorev": dict({"komut": [sys.executable, str(sahte)], "model": "sonnet", "max_tur": 5,
                           "zaman_asimi_sn": 20, "izin_modu": "acceptEdits"}, **gorev_ayari)}
    ayar["gorev"] = {k: v for k, v in ayar["gorev"].items() if v != "VARSAYILAN"}   # ayarda hiç yazmıyormuş gibi
    kok = kesin_depo(ayar=ayar) if kesin else depo(ayar=ayar)
    return git_depo(kok) if git_li else kok


def dolu_kart(kok, **kw):
    kart = gorev.yeni(kok, kw.get("baslik", "İptal nedeni ekle"), kw.get("rol", "uygulayici"),
                      kw.get("yollar", ["src/siparis/**"]), kw.get("konular", []),
                      hedef="İptal isteğine neden kodu ekle.", olcut="Neden kodu olmadan istek reddedilir.")
    return kart.parent.name


def kayit(kok, kimlik):
    return h.ortak_kok(kok) / ".harness/gorev" / kimlik


def agac(kok, kimlik):
    return h.ortak_kok(kok) / ".harness/agac" / kimlik


def durum(kok, kimlik):
    return json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))


def sorun_adlari(rapor):
    return {s["ad"] for s in rapor["sorunlar"]}


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)

    tearDown = setUp


class Kart(Ortam):
    def test_yeni_kart_sirali_kimlik_baslik_ve_paketi_tasir(self):
        kok = gorev_deposu()
        ilk = gorev.yeni(kok, "Birinci iş", "uygulayici", ["src/siparis/**"], [])
        ikinci = gorev.yeni(kok, "İkinci iş", "uygulayici", ["src/siparis/**"], [])
        self.assertEqual((ilk.parent.name, ikinci.parent.name), ("GV-001", "GV-002"))
        metin = ilk.read_text(encoding="utf-8")
        self.assertIn("[gorev] rol=uygulayici yol=src/siparis/**", metin)
        self.assertIn("KU-001@1", metin)
        self.assertIn("bitis.json", metin)

    def test_kart_basarisizlikta_hata_ayiklama_skillini_ve_durma_sinirini_soyler(self):
        kok = gorev_deposu()
        metin = gorev.yeni(kok, "İş", "uygulayici", ["src/siparis/**"], []).read_text(encoding="utf-8")
        self.assertIn("hata-ayikla", metin)
        self.assertIn("üç denemede çözemezsen", metin)
        self.assertIn("ne denediğini anlat", metin)

    def test_hedefi_doldurulmamis_kart_kosturulmaz(self):
        kok = gorev_deposu()
        kimlik = gorev.yeni(kok, "Boş iş", "uygulayici", ["src/siparis/**"], []).parent.name
        with self.assertRaises(h.HarnessHata):
            gorev.kos(kok, kimlik)

    def test_hedef_ve_olcut_verilirse_karta_yazilir(self):
        kok = gorev_deposu()
        metin = gorev.yeni(kok, "İş", "uygulayici", ["src/siparis/**"], [],
                           hedef="HEDEF-METNI", olcut="OLCUT-METNI").read_text(encoding="utf-8")
        self.assertIn("HEDEF-METNI", metin)
        self.assertIn("OLCUT-METNI", metin)
        self.assertNotIn(gorev.HEDEF_YERTUTUCU, metin)
        self.assertNotIn(gorev.OLCUT_YERTUTUCU, metin)

    def test_bagli_agactan_acilan_kart_ana_agacta_durur(self):
        kok = gorev_deposu()
        kart = gorev.yeni(agac_ac(kok, "a"), "İş", "uygulayici", ["src/siparis/**"], [])
        self.assertEqual(kart.resolve(), (kok / ".harness/gorev/GV-001/kart.md").resolve())


class Kosum(Ortam):
    def test_kapsaminda_kalan_ve_sozlesmesini_yazan_isci_temiz_rapor_alir(self):
        kok = gorev_deposu()
        rapor = gorev.kos(kok, dolu_kart(kok))
        self.assertEqual((rapor["durum"], rapor["sorunlar"]), ("tamam", []))
        self.assertEqual(rapor["degisen"], ["src/siparis/iptal.ts"])
        self.assertEqual(rapor["kullanim"]["output_tokens"], 340)

    def test_git_deposu_olmayan_yerde_gorev_kosmaz(self):
        kok = gorev_deposu(git_li=False)
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.kos(kok, dolu_kart(kok))
        self.assertIn("çalışma ağac", str(hata.exception))

    def test_isci_kendi_agacinda_calisir_ana_agac_degismez(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        rapor = gorev.kos(kok, kimlik)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 1\n")
        self.assertEqual((agac(kok, kimlik) / "src/siparis/iptal.ts").read_text(encoding="utf-8"),
                         "export const x = 2\n")
        self.assertEqual((rapor["agac"], rapor["dal"]), (".harness/agac/" + kimlik, "gorev/" + kimlik))
        self.assertIn("gorev/" + kimlik, git(kok, "branch", "--list", "gorev/" + kimlik))
        self.assertEqual(h.agac_turu(agac(kok, kimlik)), "bagli")

    def test_gorevin_dosyalarinda_commit_edilmemis_degisiklik_varsa_kosmaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        (kok / "src/siparis/iptal.ts").write_text("export const x = 5\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.kos(kok, kimlik)
        self.assertIn("src/siparis/iptal.ts", str(hata.exception))

    def test_bilgi_tabaninda_commit_edilmemis_degisiklik_varsa_kosmaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata):
            gorev.kos(kok, kimlik)

    def test_iskeleti_commit_edilmemis_depoda_gorev_kosmaz_ve_iz_birakmaz(self):
        kok = gorev_deposu()
        git(kok, "rm", "-q", "--cached", "harness.json")
        git(kok, "commit", "-q", "-m", "iskelet git dışında")
        (kok / ".git/info/exclude").write_text("harness.json\n", encoding="utf-8")
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.kos(kok, kimlik)
        self.assertIn("harness.json", str(hata.exception))
        self.assertFalse(agac(kok, kimlik).exists())
        self.assertEqual(git(kok, "branch", "--list", "gorev/" + kimlik).strip(), "")

    def test_iki_gorev_ayri_agaclarda_kosar_ve_birbirini_gormez(self):
        kok = gorev_deposu()
        ilk, ikinci = dolu_kart(kok), dolu_kart(kok, baslik="İkinci iş")
        raporlar = [gorev.kos(kok, ilk), gorev.kos(kok, ikinci)]
        self.assertEqual([r["durum"] for r in raporlar], ["tamam", "tamam"])
        self.assertEqual([r["degisen"] for r in raporlar], [["src/siparis/iptal.ts"]] * 2)
        self.assertNotEqual(agac(kok, ilk), agac(kok, ikinci))
        self.assertTrue(agac(kok, ilk).is_dir() and agac(kok, ikinci).is_dir())

    def test_kapsam_disi_dosyaya_dokunan_isci_yakalanir(self):
        os.environ["SAHTE_MOD"] = "kapsam-disi"
        kok = gorev_deposu()
        rapor = gorev.kos(kok, dolu_kart(kok))
        self.assertIn("kapsam-disi", sorun_adlari(rapor))
        self.assertEqual(rapor["durum"], "sorunlu")

    def test_bitis_kaydi_yazmayan_isci_yakalanir(self):
        os.environ["SAHTE_MOD"] = "sozlesmesiz"
        kok = gorev_deposu()
        self.assertIn("sozlesmesiz", sorun_adlari(gorev.kos(kok, dolu_kart(kok))))

    def test_paketteki_kurala_hukum_vermeyen_bitis_kaydi_reddedilir(self):
        os.environ["SAHTE_MOD"] = "hukumsuz"
        kok = gorev_deposu()
        self.assertIn("hukumsuz-kural", sorun_adlari(gorev.kos(kok, dolu_kart(kok))))

    def test_neyi_denemedigini_bildirmeyen_bitis_kaydi_reddedilir(self):
        os.environ["SAHTE_MOD"] = "denenmedisiz"
        kok = gorev_deposu()
        rapor = gorev.kos(kok, dolu_kart(kok))
        self.assertIn("eksik-alan", sorun_adlari(rapor))
        self.assertIn("denenmedi", " ".join(s["mesaj"] for s in rapor["sorunlar"]))

    def test_zaman_asimina_ugrayan_isci_durdurulur_ve_raporlanir(self):
        os.environ["SAHTE_MOD"] = "yavas"
        kok = gorev_deposu(zaman_asimi_sn=1)
        self.assertEqual(gorev.kos(kok, dolu_kart(kok))["durum"], "zaman-asimi")

    def test_beyan_ettigi_dosyaya_dokunmayan_isci_yakalanir(self):
        os.environ["SAHTE_MOD"] = "dokunmaz"
        kok = gorev_deposu()
        self.assertIn("beyan-uyusmuyor", sorun_adlari(gorev.kos(kok, dolu_kart(kok))))

    def test_agacinin_disina_yazan_isci_raporda_uyari_olur(self):
        os.environ["SAHTE_MOD"] = "agac-disi"
        kok = gorev_deposu()
        rapor = gorev.kos(kok, dolu_kart(kok))
        uyari = [u for u in rapor["uyarilar"] if u["ad"] == "agac-disi"]
        self.assertEqual(len(uyari), 1)
        self.assertIn("src/siparis/disarida.ts", uyari[0]["mesaj"])

    def test_agacinda_kalan_isci_uyari_almaz(self):
        kok = gorev_deposu()
        self.assertEqual(gorev.kos(kok, dolu_kart(kok))["uyarilar"], [])

    def test_kosum_raporu_ve_durumu_diske_yazilir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertEqual(durum(kok, kimlik)["durum"], "tamam")
        self.assertTrue((kayit(kok, kimlik) / "rapor.json").is_file())

    def test_isci_bitis_kaydi_agactan_ortak_kayda_tasinir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertTrue((kayit(kok, kimlik) / "bitis.json").is_file())
        self.assertFalse((agac(kok, kimlik) / ".harness/gorev" / kimlik / "bitis.json").exists())

    def test_bayat_paketli_kart_kosmadan_once_tazelenir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8").replace("surum: 1", "surum: 2"), encoding="utf-8")
        h.uret(kok)
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "kural sürümü")
        gorev.kos(kok, kimlik)
        self.assertIn("KU-001@2", (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8"))


class IsciKomutu(Ortam):
    """İşçiye geçen bayraklar: sınırlar ayardan gelir, ayarda olmayan sınır komuta girmez."""

    def _argv(self, **gorev_ayari):
        kok = gorev_deposu(**gorev_ayari)
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "argv-uygulayici.json"
        return json.loads(yol.read_text(encoding="utf-8"))

    def _deger(self, argv, bayrak):
        return argv[argv.index(bayrak) + 1]

    def test_isci_karti_tur_sinirini_modeli_ve_izin_modunu_alir(self):
        argv = self._argv()
        self.assertIn("## Hedef", self._deger(argv, "-p"))
        self.assertEqual(self._deger(argv, "--max-turns"), "5")
        self.assertEqual(self._deger(argv, "--model"), "sonnet")
        self.assertEqual(self._deger(argv, "--permission-mode"), "acceptEdits")
        self.assertEqual(self._deger(argv, "--output-format"), "json")

    def test_maliyet_tavani_verilmisse_isciye_gecer(self):
        self.assertEqual(self._deger(self._argv(butce_usd=2), "--max-budget-usd"), "2")

    def test_maliyet_tavani_verilmemisse_bayrak_komuta_girmez(self):
        self.assertNotIn("--max-budget-usd", self._argv())

    def test_izinli_araclar_verilmisse_isciye_gecer(self):
        argv = self._argv(izinli_araclar=["Read", "Bash(python3 harness/h.py sor:*)"])
        i = argv.index("--allowedTools")
        self.assertEqual(argv[i + 1:i + 3], ["Read", "Bash(python3 harness/h.py sor:*)"])

    def test_izinli_arac_yoksa_bayrak_komuta_girmez(self):
        self.assertNotIn("--allowedTools", self._argv())

    def _kum(self, argv):
        return json.loads(self._deger(argv, "--settings"))["sandbox"]

    def test_isci_kisisel_ayarlardan_ve_mcp_sunucularindan_yalitilir(self):
        argv = self._argv()
        self.assertEqual(self._deger(argv, "--setting-sources"), "project,local")
        self.assertIn("--strict-mcp-config", argv)

    def test_yalitim_kapatilirsa_bayraklar_komuta_girmez(self):
        argv = self._argv(yalitim="yok")
        self.assertNotIn("--setting-sources", argv)
        self.assertNotIn("--strict-mcp-config", argv)

    def test_isci_kum_havuzunda_kosar_ve_disina_cikamaz(self):
        kum = self._kum(self._argv())
        self.assertEqual((kum["enabled"], kum["autoAllowBashIfSandboxed"], kum["allowUnsandboxedCommands"],
                          kum["failIfUnavailable"]), (True, True, False, True))

    def test_kum_havuzu_kapatilirsa_kum_havuzu_ayari_komuta_girmez(self):
        self.assertNotIn("sandbox", json.loads(self._deger(self._argv(kum_havuzu=False), "--settings")))

    def test_yalitim_ve_kum_havuzu_kapaliysa_ek_ayar_komuta_girmez(self):
        self.assertNotIn("--settings", self._argv(kum_havuzu=False, yalitim="yok", okunmaz=[]))

    def test_isci_ust_klasorlerdeki_talimat_dosyalarini_yuklemez(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev_agaci = agac(kok, kimlik)
        argv = json.loads((gorev_agaci / ".harness/gorev" / kimlik / "argv-uygulayici.json").read_text(encoding="utf-8"))
        haric = json.loads(self._deger(argv, "--settings"))["claudeMdExcludes"]
        ana = kok.resolve()
        for yol in (ana / "CLAUDE.md", ana / ".claude/CLAUDE.md", ana.parent / ".claude/CLAUDE.md"):
            self.assertIn(str(yol), haric)          # ana ağaç ve üstündeki her klasör
        for yol in (gorev_agaci.resolve() / "CLAUDE.md", gorev_agaci.resolve() / ".claude/CLAUDE.md"):
            self.assertNotIn(str(yol), haric)       # işçinin kendi ağacındaki kurallar yüklenir

    def test_yalitim_kapatilirsa_talimat_dosyalari_haric_tutulmaz(self):
        argv = self._argv(yalitim="yok")
        self.assertNotIn("claudeMdExcludes", json.loads(self._deger(argv, "--settings")))

    def test_izinli_ag_alanlari_kum_havuzu_ayarina_girer(self):
        self.assertEqual(self._kum(self._argv(ag_izinli=["pypi.org"]))["network"]["allowedDomains"], ["pypi.org"])

    def test_liste_disi_adresler_her_izin_modunda_reddedilir(self):
        # Boş liste tek başına ağı kapatmaz: soru sormayan modda liste dışı adres sormadan açılır.
        self.assertEqual(self._kum(self._argv())["network"], {"allowedDomains": [], "strictAllowlist": True})
        self.assertTrue(self._kum(self._argv(ag_izinli=["pypi.org"]))["network"]["strictAllowlist"])

    def test_dosya_araclari_agacin_disina_yazamaz(self):
        izinler = json.loads(self._deger(self._argv(), "--settings"))["permissions"]
        self.assertTrue(izinler["blockWritesOutsideWorkingDirectories"])
        self.assertNotIn("permissions", json.loads(self._deger(self._argv(kum_havuzu=False, okunmaz=[]), "--settings")))

    def test_yerel_ag_izni_kum_havuzu_ayarina_girer(self):
        ag = self._kum(self._argv(yerel_ag=True))["network"]
        self.assertEqual(ag, {"allowedDomains": [], "strictAllowlist": True, "allowLocalBinding": True})
        self.assertNotIn("allowLocalBinding", self._kum(self._argv())["network"])

    def test_hazirlik_komutu_agacta_oturumdan_once_kosar(self):
        yaz = "import pathlib; pathlib.Path('hazir.txt').write_text('x')"
        kok = gorev_deposu(hazirlik=[sys.executable, "-c", yaz])
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertTrue((agac(kok, kimlik) / "hazir.txt").is_file())

    def test_hazirlik_komutu_basarisizsa_oturum_baslamaz(self):
        kok = gorev_deposu(hazirlik=[sys.executable, "-c", "import sys; sys.exit(3)"])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata):
            gorev.kos(kok, kimlik)
        self.assertFalse((agac(kok, kimlik) / ".harness/gorev" / kimlik / "argv-uygulayici.json").exists())

    def test_isci_girdi_beklemez(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        oku, yaz = os.pipe()          # üst sürecin girdisi açık bir boru olsa bile işçi onu devralmamalı
        asil = os.dup(0)
        os.dup2(oku, 0)
        try:
            gorev.kos(kok, kimlik)
        finally:
            os.dup2(asil, 0)
            for fd in (asil, oku, yaz):
                os.close(fd)
        yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "girdi-uygulayici.json"
        self.assertIs(json.loads(yol.read_text(encoding="utf-8")), True)

    def test_inceleyici_de_yalitilir_ve_kum_havuzunda_kosar(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        argv = json.loads((agac(kok, kimlik) / ".harness/gorev" / kimlik / "argv-inceleyici.json")
                          .read_text(encoding="utf-8"))
        self.assertEqual(self._deger(argv, "--setting-sources"), "project,local")
        self.assertTrue(self._kum(argv)["enabled"])

    def test_onay_ozeti_izin_modunu_ve_kum_havuzunu_soyler(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        self.assertIn("acceptEdits", gorev.ozet(kok, kimlik))
        self.assertIn("kum havuzu açık", gorev.ozet(kok, kimlik))
        kok = gorev_deposu(kum_havuzu=False, izin_modu="bypassPermissions")
        ozet = gorev.ozet(kok, dolu_kart(kok))
        self.assertIn("bypassPermissions", ozet)
        self.assertIn("KUM HAVUZU KAPALI", ozet)

    def test_varsayilan_izin_modu_soru_sormayan_moddur_ve_kum_havuzu_aciktir(self):
        argv = self._argv(izin_modu="VARSAYILAN")
        self.assertEqual(self._deger(argv, "--permission-mode"), "bypassPermissions")
        self.assertTrue(self._kum(argv)["enabled"])
        self.assertFalse(self._kum(argv)["allowUnsandboxedCommands"])

    def test_isci_web_araclari_olmadan_ve_gizli_yollari_okuyamadan_baslar(self):
        argv = self._argv()
        i = argv.index("--disallowedTools")
        kapali = argv[i + 1:i + 6]
        for arac in ("WebFetch", "WebSearch", "Agent", "Task", "Workflow"):   # web yok, alt ajan yok
            self.assertIn(arac, kapali)
        yasak = json.loads(self._deger(argv, "--settings"))["permissions"]["deny"]
        for yol in ("Read(~/.ssh/**)", "Read(~/.claude.json)", "Read(~/.claude/CLAUDE.md)",
                    "Read(~/.claude/projects/**)", "Read(**/.env)"):
            self.assertIn(yol, yasak)

    def test_web_araclari_ve_okunmaz_yollar_ayardan_degistirilir(self):
        argv = self._argv(ag_araclari=True, okunmaz=["~/ozel/**"])
        i = argv.index("--disallowedTools")
        self.assertEqual(sorted(argv[i + 1:i + 4]), ["Agent", "Task", "Workflow"])   # web açılır, alt ajan yine kapalı
        self.assertEqual(json.loads(self._deger(argv, "--settings"))["permissions"]["deny"], ["Read(~/ozel/**)"])

    def _yasaklar(self, argv):
        i = argv.index("--disallowedTools") + 1
        j = next((k for k in range(i, len(argv)) if argv[k].startswith("--")), len(argv))
        return sorted(argv[i:j])

    def test_orkestrasyon_acilirsa_alt_ajan_ve_is_akisi_yasagi_kalkar(self):
        self.assertEqual(self._yasaklar(self._argv()), ["Agent", "Task", "WebFetch", "WebSearch", "Workflow"])
        self.assertEqual(self._yasaklar(self._argv(orkestrasyon=True)), ["WebFetch", "WebSearch"])
        self.assertNotIn("--disallowedTools", self._argv(orkestrasyon=True, ag_araclari=True))

    def test_efor_ayari_isciye_bayrakla_gecer(self):
        self.assertEqual(self._deger(self._argv(efor="xhigh"), "--effort"), "xhigh")
        self.assertNotIn("--effort", self._argv())

    def test_inceleyici_orkestrasyon_yapamaz_ve_kendi_eforunu_alir(self):
        kok = gorev_deposu(orkestrasyon=True, efor="xhigh", inceleme_efor="high")
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "argv-inceleyici.json"
        argv = json.loads(yol.read_text(encoding="utf-8"))
        self.assertEqual(self._yasaklar(argv), ["Agent", "Task", "WebFetch", "WebSearch", "Workflow"])
        self.assertEqual(self._deger(argv, "--effort"), "high")

    def test_isci_ust_oturumun_ortamini_devralmaz(self):
        ust = {"CLAUDE_CODE_SESSION_ID": "ust-oturum", "CLAUDE_EFFORT": "high", "CLAUDECODE": "1",
               "CLAUDE_PROJECT_DIR": "/baska/yer"}
        os.environ.update(ust)
        try:
            kok = gorev_deposu()
            kimlik = dolu_kart(kok)
            gorev.kos(kok, kimlik)
        finally:
            for ad in ust:
                os.environ.pop(ad, None)
        yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "ortam-uygulayici.json"
        self.assertEqual(json.loads(yol.read_text(encoding="utf-8")), [])

    def test_onay_ozeti_maliyet_tavanini_ve_agaci_soyler(self):
        kok = gorev_deposu(butce_usd=2)
        kimlik = dolu_kart(kok)
        ozet = gorev.ozet(kok, kimlik)
        self.assertIn("2 USD", ozet)
        self.assertIn(".harness/agac/" + kimlik, ozet)


class Inceleme(Ortam):
    """Görevi yapmayan ikinci bir oturum, sonucu bağımsız olarak denetler."""

    def _kosmus(self, **kw):
        kok = gorev_deposu(**kw)
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        return kok, kimlik

    def _inceleyici_argv(self, kok, kimlik):
        yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "argv-inceleyici.json"
        return json.loads(yol.read_text(encoding="utf-8"))

    def test_gecen_inceleme_goreve_islenir(self):
        kok, kimlik = self._kosmus()
        rapor = gorev.incele(kok, kimlik)
        self.assertEqual((rapor["sonuc"], rapor["sorunlar"]), ("gecti", []))
        self.assertEqual(durum(kok, kimlik)["inceleme"], "gecti")
        self.assertTrue((kayit(kok, kimlik) / "inceleme-rapor.json").is_file())

    def test_kosmamis_gorev_incelenmez(self):
        kok = gorev_deposu()
        with self.assertRaises(h.HarnessHata):
            gorev.incele(kok, dolu_kart(kok))

    def test_sorunlu_kosum_incelenmez(self):
        os.environ["SAHTE_MOD"] = "kapsam-disi"
        kok, kimlik = self._kosmus()
        with self.assertRaises(h.HarnessHata):
            gorev.incele(kok, kimlik)

    def test_dosyaya_dokunan_inceleyici_yakalanir(self):
        kok, kimlik = self._kosmus()
        os.environ["SAHTE_INCELEME"] = "dokunur"
        rapor = gorev.incele(kok, kimlik)
        self.assertIn("inceleyici-dokundu", sorun_adlari(rapor))
        self.assertEqual(rapor["sonuc"], "sorunlu")

    def test_inceleme_kaydi_yazmayan_inceleyici_yakalanir(self):
        kok, kimlik = self._kosmus()
        os.environ["SAHTE_INCELEME"] = "yok"
        rapor = gorev.incele(kok, kimlik)
        self.assertIn("incelemesiz", sorun_adlari(rapor))
        self.assertEqual(durum(kok, kimlik)["inceleme"], "sorunlu")

    def test_engel_bulan_inceleme_kalir_ve_bulguyu_tasir(self):
        kok, kimlik = self._kosmus()
        os.environ["SAHTE_INCELEME"] = "kaldi"
        rapor = gorev.incele(kok, kimlik)
        self.assertEqual(rapor["sonuc"], "kaldi")
        self.assertEqual(rapor["bulgular"][0]["onem"], "engel")

    def _isci_istemi(self, kok, kimlik):
        yol = agac(kok, kimlik) / ".harness/gorev" / kimlik / "argv-uygulayici.json"
        argv = json.loads(yol.read_text(encoding="utf-8"))
        return argv[argv.index("-p") + 1]

    def test_incelemede_kalan_gorev_yeniden_kosunca_isci_bulgulari_gorur(self):
        kok, kimlik = self._kosmus()
        self.assertNotIn("Önceki incelemenin bulguları", self._isci_istemi(kok, kimlik))
        os.environ["SAHTE_INCELEME"] = "kaldi"
        gorev.incele(kok, kimlik)
        gorev.kos(kok, kimlik)
        istem = self._isci_istemi(kok, kimlik)
        self.assertIn("Önceki incelemenin bulguları", istem)
        self.assertIn("[engel] src/siparis/iptal.ts:1 — neden kodu denetlenmiyor", istem)

    def test_gecen_incelemeden_sonra_yeniden_kosan_isciye_bulgu_gitmez(self):
        kok, kimlik = self._kosmus()
        gorev.incele(kok, kimlik)
        gorev.kos(kok, kimlik)
        self.assertNotIn("Önceki incelemenin bulguları", self._isci_istemi(kok, kimlik))

    def test_iscinin_hukmuyle_celisen_inceleme_celiskiyi_listeler(self):
        kok, kimlik = self._kosmus(kesin=True)
        os.environ["SAHTE_INCELEME"] = "celiski"
        rapor = gorev.incele(kok, kimlik)
        self.assertEqual(rapor["celiskiler"], [{"kimlik": "KU-001@1", "isci": "uyuyor", "inceleyici": "uymuyor"}])
        self.assertEqual(rapor["sonuc"], "kaldi")

    def test_inceleyici_farki_gorur_ama_iscinin_oz_degerlendirmesini_gormez(self):
        kok, kimlik = self._kosmus()
        gorev.incele(kok, kimlik)
        argv = self._inceleyici_argv(kok, kimlik)
        istem = argv[argv.index("-p") + 1]
        self.assertIn("export const x = 2", istem)
        self.assertIn("Neden kodu olmadan istek reddedilir.", istem)
        self.assertNotIn(OZET_ISARETI, istem)
        self.assertFalse((agac(kok, kimlik) / ".harness/gorev" / kimlik / "bitis.json").exists())

    def test_inceleyicinin_modeli_ayardan_gelir(self):
        kok, kimlik = self._kosmus(inceleme_model="opus")
        gorev.incele(kok, kimlik)
        argv = self._inceleyici_argv(kok, kimlik)
        self.assertEqual(argv[argv.index("--model") + 1], "opus")

    def test_inceleyiciye_sadelik_ve_cerrahi_degisiklik_sorulari_sorulur(self):
        kok, kimlik = self._kosmus()
        gorev.incele(kok, kimlik)
        argv = self._inceleyici_argv(kok, kimlik)
        istem = argv[argv.index("-p") + 1]
        self.assertIn("Değişen her satır hedefe bağlanıyor mu", istem)
        self.assertIn("gereğinden karmaşık", istem)

    def test_kosumdan_sonra_degisen_is_incelenmez(self):
        kok, kimlik = self._kosmus()
        (agac(kok, kimlik) / "src/siparis/iptal.ts").write_text("export const x = 7\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.incele(kok, kimlik)
        self.assertIn("koşumdan sonra", str(hata.exception))

    def test_kabul_olcutu_kosumdan_sonra_degisirse_is_incelenmez(self):
        kok, kimlik = self._kosmus()
        kart = kayit(kok, kimlik) / "kart.md"
        kart.write_text(kart.read_text(encoding="utf-8").replace("Neden kodu olmadan istek reddedilir.",
                                                                 "Dosya vardır."), encoding="utf-8")
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.incele(kok, kimlik)
        self.assertIn("ölçüt", str(hata.exception))

    def test_kanitsiz_engel_bulgusu_incelemeyi_gecersiz_kilar(self):
        kok, kimlik = self._kosmus()
        os.environ["SAHTE_INCELEME"] = "kanitsiz"
        rapor = gorev.incele(kok, kimlik)
        self.assertEqual(rapor["sonuc"], "sorunlu")
        self.assertIn("kanıt", " ".join(s["mesaj"] for s in rapor["sorunlar"]))

    def test_ne_kosturdugunu_bildirmeyen_inceleme_gecersizdir(self):
        kok, kimlik = self._kosmus()
        os.environ["SAHTE_INCELEME"] = "kosulansiz"
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "sorunlu")

    def test_inceleme_raporu_inceleyicinin_kosturduklarini_tasir(self):
        kok, kimlik = self._kosmus()
        self.assertEqual(gorev.incele(kok, kimlik)["kosulan"], ["python3 -c 'import iptal'"])

    def test_inceleyiciye_fark_guvenilmeyen_veri_olarak_verilir(self):
        kok, kimlik = self._kosmus()
        gorev.incele(kok, kimlik)
        argv = self._inceleyici_argv(kok, kimlik)
        istem = argv[argv.index("-p") + 1]
        self.assertIn("güvenilmeyen veri", istem)
        self.assertLess(istem.index("güvenilmeyen veri"), istem.index("export const x = 2"))
        self.assertIn("sessiz", istem.lower())

    def test_inceleyiciye_inceleme_paketi_gider(self):
        kok, kimlik = self._kosmus(kesin=True)
        gorev.incele(kok, kimlik)
        argv = self._inceleyici_argv(kok, kimlik)
        self.assertIn("[ ] KU-001@1", argv[argv.index("-p") + 1])


class Alma(Ortam):
    """Temiz koşan ve incelenen iş orchestrator'ın dalına alınır; ağaç ve dal temizlenir."""

    def _hazir(self, **kw):
        kok = gorev_deposu(**kw)
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        return kok, kimlik

    def test_incelenmemis_gorev_alinmaz(self):
        kok, kimlik = self._hazir()
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.al(kok, kimlik)
        self.assertIn("incele", str(hata.exception))

    def test_incelemede_kalan_gorev_alinmaz(self):
        kok, kimlik = self._hazir()
        os.environ["SAHTE_INCELEME"] = "kaldi"
        gorev.incele(kok, kimlik)
        with self.assertRaises(h.HarnessHata):
            gorev.al(kok, kimlik)

    def test_sorunlu_gorev_alinmaz(self):
        os.environ["SAHTE_MOD"] = "kapsam-disi"
        kok, kimlik = self._hazir(inceleme="istege-bagli")
        with self.assertRaises(h.HarnessHata):
            gorev.al(kok, kimlik)

    def test_temiz_ve_incelenmis_gorev_alininca_degisiklik_orchestratorun_dalina_gelir(self):
        kok, kimlik = self._hazir()
        gorev.incele(kok, kimlik)
        gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertIn(kimlik, git(kok, "log", "--format=%s"))
        self.assertTrue(durum(kok, kimlik)["alindi"])

    def test_alinan_gorevin_agaci_ve_dali_temizlenir(self):
        kok, kimlik = self._hazir()
        gorev.incele(kok, kimlik)
        gorev.al(kok, kimlik)
        self.assertFalse(agac(kok, kimlik).exists())
        self.assertEqual(git(kok, "branch", "--list", "gorev/" + kimlik).strip(), "")

    def test_inceleme_istege_bagliysa_incelenmeden_alinir(self):
        kok, kimlik = self._hazir(inceleme="istege-bagli")
        gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 2\n")

    def test_incelemeden_sonra_degisen_is_alinmaz(self):
        kok, kimlik = self._hazir()
        gorev.incele(kok, kimlik)
        (agac(kok, kimlik) / "src/siparis/iptal.ts").write_text("export const x = 8\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.al(kok, kimlik)
        self.assertIn("incelemeden sonra", str(hata.exception))
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 1\n")

    def test_inceleme_istege_bagliyken_kosumdan_sonra_degisen_is_alinmaz(self):
        kok, kimlik = self._hazir(inceleme="istege-bagli")
        (agac(kok, kimlik) / "src/siparis/iptal.ts").write_text("export const x = 8\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata):
            gorev.al(kok, kimlik)

    def test_cakisan_gorev_alinmaz_ve_birlestirme_geri_alinir(self):
        kok, kimlik = self._hazir(inceleme="istege-bagli")
        (kok / "src/siparis/iptal.ts").write_text("export const x = 9\n", encoding="utf-8")
        git(kok, "commit", "-q", "-am", "ana ağaçta başka değişiklik")
        with self.assertRaises(h.HarnessHata):
            gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 9\n")
        self.assertEqual(git(kok, "status", "--porcelain", "--untracked-files=no").strip(), "")
        self.assertTrue(agac(kok, kimlik).is_dir())
        self.assertFalse(durum(kok, kimlik).get("alindi"))

    def test_atilan_gorevin_agaci_ve_dali_silinir_ana_agac_degismez(self):
        kok, kimlik = self._hazir()
        gorev.at(kok, kimlik)
        self.assertFalse(agac(kok, kimlik).exists())
        self.assertEqual(git(kok, "branch", "--list", "gorev/" + kimlik).strip(), "")
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 1\n")
        self.assertEqual(durum(kok, kimlik)["durum"], "atildi")

    def test_bagli_agactaki_orchestrator_gorevi_kendi_dalina_alir(self):
        kok = gorev_deposu()
        oturum = agac_ac(kok, "a")
        kimlik = dolu_kart(oturum)
        gorev.kos(oturum, kimlik)
        gorev.incele(oturum, kimlik)
        gorev.al(oturum, kimlik)
        self.assertEqual((oturum / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 1\n")


class HookIleBirlikte(Ortam):
    def test_kosturma_komutu_kullaniciya_sorulur_ve_karti_ozetler(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        c = komut(kok, "python3 harness/h.py gorev kos " + kimlik)
        self.assertEqual(karar(c), "ask")
        self.assertIn("İptal nedeni ekle", gerekce(c))
        self.assertIn("src/siparis/**", gerekce(c))

    def _sorulanlar(self, **gorev_ayari):
        kok = gorev_deposu(**gorev_ayari)
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        return {islem: karar(komut(kok, "python3 harness/h.py gorev %s %s" % (islem, kimlik)))
                for islem in ("kos", "incele", "al", "at")}

    def test_varsayilan_onayda_baslatma_alma_ve_atma_sorulur_inceleme_sorulmaz(self):
        self.assertEqual(self._sorulanlar(), {"kos": "ask", "incele": None, "al": "ask", "at": "ask"})

    def test_onay_kapaliysa_yalniz_atma_sorulur(self):
        self.assertEqual(self._sorulanlar(onay="yok"), {"kos": None, "incele": None, "al": None, "at": "ask"})

    def test_her_adim_onayinda_dort_islem_de_sorulur(self):
        kok = gorev_deposu(onay="her-adim")
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        for islem in ("incele", "al", "at"):
            c = komut(kok, "python3 harness/h.py gorev %s %s" % (islem, kimlik))
            self.assertEqual(karar(c), "ask", islem)
            self.assertIn(kimlik, gerekce(c))

    def test_baska_klasore_gecip_verilen_gorev_komutu_o_deponun_kartiyla_sorulur(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        baska = pathlib.Path(tempfile.mkdtemp(prefix="harness-baska-"))
        for metin in ('cd "%s" && python3 harness/h.py gorev kos %s' % (kok, kimlik),
                      "cd %s; python3 harness/h.py gorev kos %s" % (kok, kimlik)):
            c = ajan_hook.isle("komut-oncesi", {"session_id": "s1", "cwd": str(baska), "tool_name": "Bash",
                                                "tool_input": {"command": metin}}, {})
            self.assertEqual(karar(c), "ask", metin)
            self.assertIn("İptal nedeni ekle", gerekce(c))

    def test_atma_onayi_silinecek_degisikligi_soyler(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertIn("1 dosya", gerekce(komut(kok, "python3 harness/h.py gorev at " + kimlik)))

    def test_isci_baska_bir_isci_kosturamaz_inceleyemez_alamaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        for islem in ("kos", "incele", "al", "at"):
            c = komut(kok, "python3 harness/h.py gorev %s %s" % (islem, kimlik), ortam={"HARNESS_GOREV": kimlik})
            self.assertEqual(karar(c), "deny", islem)

    def test_isci_ve_inceleyici_git_gecmisine_dokunamaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        for rol in ("uygulayici", "inceleyici"):
            ortam = {"HARNESS_GOREV": kimlik, "HARNESS_ROL": rol}
            for metin in ("git commit -m x", "git add -A && git commit -m x", "git push origin main",
                          "git checkout -b baska", "git switch main", "git merge main", "git reset --hard HEAD~1",
                          "git rebase main", "git worktree add ../z", "git stash", "git branch -D main",
                          "git -C .. commit -m x"):
                self.assertEqual(karar(komut(kok, metin, ortam=ortam)), "deny", "%s: %s" % (rol, metin))

    def test_gorev_oturumu_dosyayi_komutla_yazamaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        for rol in ("uygulayici", "inceleyici"):
            ortam = {"HARNESS_GOREV": kimlik, "HARNESS_ROL": rol}
            for metin in ("echo x > src/siparis/iptal.ts", "echo x >> src/siparis/iptal.ts",
                          "cat > src/siparis/yeni.ts <<'EOF'\nexport const y = 1\nEOF",
                          "ls src; mkdir -p src && cat > src/a.ts << EOF\nx\nEOF",
                          "printf x | tee src/siparis/iptal.ts", "printf x | tee -a src/siparis/iptal.ts",
                          "sed -i '' 's/1/2/' src/siparis/iptal.ts", "perl -pi -e 's/1/2/' src/siparis/iptal.ts",
                          "python3 uret.py &> cikti.txt", "python3 uret.py 2> hata.txt",
                          'echo x > "src/siparis/bosluklu ad.ts"'):
                c = komut(kok, metin, ortam=ortam)
                self.assertEqual(karar(c), "deny", "%s: %s" % (rol, metin))
                self.assertIn("Write", gerekce(c))

    def test_gorev_oturumu_dosya_yazmayan_komutlari_kosabilir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        for metin in ("python3 -c \"print(1 > 0)\"", "python3 -m pytest -q 2>&1 | tail -5",
                      "python3 -m pytest -q > /dev/null 2>&1", "ls src 2>/dev/null", "echo hata >&2",
                      "python3 -c 'print(\"a -> b\")'", "git diff > /tmp/claude/fark.txt",
                      "python3 uret.py > $TMPDIR/cikti.txt", "grep -n '=>' src/siparis/iptal.ts",
                      "cat src/siparis/iptal.ts", "node -e 'console.log(2 >= 1)'"):
            self.assertIsNone(komut(kok, metin, ortam={"HARNESS_GOREV": kimlik}), metin)

    def test_ana_oturumun_komutla_yazmasi_bu_kapiya_takilmaz(self):
        kok = gorev_deposu()
        self.assertIsNone(komut(kok, "echo x > not.txt"))

    def test_isci_git_gecmisini_okuyabilir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        for metin in ("git status --short", "git diff", "git log --oneline -5", "git show HEAD --stat",
                      "git branch --show-current"):
            self.assertIsNone(komut(kok, metin, ortam={"HARNESS_GOREV": kimlik}), metin)

    def test_ana_oturumun_commit_i_bu_kapiya_takilmaz(self):
        kok = gorev_deposu()
        self.assertIsNone(komut(kok, "git commit -m x"))

    def test_gorev_oturumu_kapi_ayarini_degistiremez(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok, yollar=["**"])
        gorev.kos(kok, kimlik)          # işçinin kendi ağacı: ana ağaç kapısı burada devrede değil
        for yol in ("harness.json", ".claude/settings.json"):
            c = duzenle(agac(kok, kimlik), yol, ortam={"HARNESS_GOREV": kimlik, "HARNESS_ROL": "uygulayici"})
            self.assertEqual(karar(c), "deny", yol)
            self.assertIn("ayar", gerekce(c))

    def test_isci_gorevin_dosyalari_disina_yazamaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        c = duzenle(kok, "src/odeme/a.ts", ortam={"HARNESS_GOREV": kimlik})
        self.assertEqual(karar(c), "deny")
        self.assertIn(kimlik, gerekce(c))

    def test_isci_kendi_agacinda_gorevin_dosyasina_yazabilir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        ortam = {"HARNESS_GOREV": kimlik, "HARNESS_ROL": "uygulayici"}
        ilk = duzenle(agac(kok, kimlik), "src/siparis/iptal.ts", ortam=ortam)
        self.assertNotIn(kimlik, gerekce(ilk))          # ilk ret yalnız kuralları gösterir
        self.assertNotIn("EnterWorktree", gerekce(ilk))
        self.assertIsNone(duzenle(agac(kok, kimlik), "src/siparis/iptal.ts", ortam=ortam))

    def test_isci_kendi_bitis_kaydini_yazabilir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        yol = ".harness/gorev/%s/bitis.json" % kimlik
        self.assertIsNone(duzenle(kok, yol, ortam={"HARNESS_GOREV": kimlik}))

    def test_isci_kendi_kapsam_kaydini_degistiremez(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok, yollar=["**"])
        c = duzenle(kok, ".harness/gorev/%s/durum.json" % kimlik, ortam={"HARNESS_GOREV": kimlik})
        self.assertEqual(karar(c), "deny")

    def test_isci_bilgi_tabanina_yazamaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok, yollar=["**"])
        self.assertEqual(karar(duzenle(kok, "kb/kural/KU-009-x.md", ortam={"HARNESS_GOREV": kimlik})), "deny")

    def test_isci_bitis_kaydi_olmadan_duramaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        c = ajan_hook.isle("durus", {"session_id": "w1", "cwd": str(kok), "stop_hook_active": False},
                           {"HARNESS_GOREV": kimlik})
        self.assertEqual(c["decision"], "block")
        self.assertIn("bitis.json", c["reason"])

    def test_inceleyici_hicbir_kod_dosyasina_yazamaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        ortam = {"HARNESS_GOREV": kimlik, "HARNESS_ROL": "inceleyici"}
        c = duzenle(kok, "src/siparis/iptal.ts", ortam=ortam)
        self.assertEqual(karar(c), "deny")
        self.assertIn("nceleyici", gerekce(c))
        self.assertEqual(karar(duzenle(kok, ".harness/gorev/%s/bitis.json" % kimlik, ortam=ortam)), "deny")

    def test_inceleyici_yalniz_kendi_inceleme_kaydini_yazabilir(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        ortam = {"HARNESS_GOREV": kimlik, "HARNESS_ROL": "inceleyici"}
        self.assertIsNone(duzenle(kok, ".harness/gorev/%s/inceleme.json" % kimlik, ortam=ortam))

    def test_inceleyici_inceleme_kaydi_olmadan_duramaz(self):
        kok = gorev_deposu()
        kimlik = dolu_kart(kok)
        c = ajan_hook.isle("durus", {"session_id": "w2", "cwd": str(kok), "stop_hook_active": False},
                           {"HARNESS_GOREV": kimlik, "HARNESS_ROL": "inceleyici"})
        self.assertEqual(c["decision"], "block")
        self.assertIn("inceleme.json", c["reason"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
