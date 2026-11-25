#!/usr/bin/env python3
"""Taslak engeli (TS-006 Yapı 18): kabul edilmemiş karara, kurala ya da tasarım kaydına dayanan iş koşmaz.

İşe düşen taslaklar iki yoldan bulunur: kartın yollarına ve konusuna düşen taslak kurallar ile onların taslak
kararları, ve işin açıkça dayandığı düğümler (epic ve görev "dayanak" taşır; epic'in dayanağı görevlerine geçer).
Taslak varsa `gorev kos` ve `plan yurut` koşturmaz; iki çıkış vardır: kabul ya da o çağrıya özel izin (`--taslakla`).
İzin sorusunu kanca onay ayarından bağımsız her zaman sorar; izin görevin kaydına yazılır.

Koşum: python3 harness/test/test_engel.py
"""
from __future__ import annotations

import contextlib
import datetime
import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
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
from test_h import KARAR, depo, git, git_depo  # noqa: E402
from test_hook import TASLAK_KARAR, TASLAK_KURAL, gerekce, karar, komut  # noqa: E402
from test_gorev import SAHTE_ISCI  # noqa: E402

TASLAK_KURALLAR = {"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL}
TASARIM = ("---\nkimlik: TS-001\ntur: tasarim\ndurum: taslak\nsurum: 1\nbaslik: İptal akışının tasarımı\n"
           "agirlik: cift-yonlu\n---\nİptal akışı.\n\n## Sorun\nS.\n\n## Kısıtlar\nK.\n\n## Seçenekler\n### A — tek\n\n"
           "## Doğrulama\nD.\n")
TASLAK_TASARIM = {"kb/tasarim/TS-001-iptal.md": TASARIM}
HEDEF, OLCUT = "İptal isteğine neden kodu ekle.", "Neden kodu olmadan istek reddedilir."
IZIN_SORUSU = "taslaklara rağmen koşturma izni"


def deposu(ek=None, **gorev_ayari):
    """Sahte işçi ve inceleyiciyle koşturulabilen git deposu; `ek` bilgi tabanına dosya ekler."""
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "isci.py"
    sahte.write_text(SAHTE_ISCI, encoding="utf-8")
    ayar = {"gorev": dict({"komut": [sys.executable, str(sahte)], "model": "sonnet", "max_tur": 5,
                           "zaman_asimi_sn": 20, "izin_modu": "acceptEdits"}, **gorev_ayari)}
    return git_depo(depo(ek, ayar=ayar))


def sessiz(islev, *arg, **kw):
    """(dönüş, stdout) — komutun yazdığını yakalar."""
    with contextlib.redirect_stdout(io.StringIO()) as c:
        donus = islev(*arg, **kw)
    return donus, c.getvalue()


def kart_ac(kok, dayanak=None, baslik="İptal nedeni ekle"):
    kart, _ = sessiz(gorev.yeni, kok, baslik, "uygulayici", ["src/siparis/**"], [], hedef=HEDEF, olcut=OLCUT,
                     dayanak=dayanak)
    return kart.parent.name


def kabul_et(kok, *kimlikler):
    """Kullanıcının kabulü (testte onaylı çağrı) ve commit: görev ağacı commit edilmiş bilgi tabanını görür."""
    for k in h.kabul_sirasi(list(kimlikler)):
        h.kabul(kok, k, True)
    git(kok, "add", "-A")
    git(kok, "commit", "-q", "-m", "kabul")


def kayit(kok, kimlik):
    return h.ortak_kok(kok) / ".harness/gorev" / kimlik


def durum(kok, kimlik):
    return json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))


def kart(kok, kimlik):
    return (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")


def agac_var(kok, kimlik):
    return (h.ortak_kok(kok) / ".harness/agac" / kimlik).exists() or gorev._dal_var(kok, "gorev/" + kimlik)


def plan_kur(kok, dayanak=None):
    sessiz(plan.space, kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/siparis/**"])
    sessiz(plan.epic, kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.", dayanak=dayanak)


def yaprak(kok, baslik="İptal nedeni ekle", dayanak=None):
    (_, kimlik), _ = sessiz(plan.task, kok, "EP-001", baslik, hedef=HEDEF, olcut=OLCUT, dayanak=dayanak)
    return kimlik


def epic_metni(kok):
    return (h.ortak_kok(kok) / ".harness/plan/siparis/EP-001.md").read_text(encoding="utf-8")


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)

    tearDown = setUp

    def engel(self, kok, kimlik, *parcalar):
        """`gorev kos` taslak engeline takılır: ileti taslakları ve iki çıkışı taşır, ağaç açılmaz, kayıt değişmez."""
        once = durum(kok, kimlik)
        with self.assertRaises(h.HarnessHata) as e:
            sessiz(gorev.kos, kok, kimlik)
        for parca in parcalar + ("python3 harness/h.py kabul ", "python3 harness/h.py gorev kos %s --taslakla" % kimlik):
            self.assertIn(parca, str(e.exception))
        self.assertFalse(agac_var(kok, kimlik))
        self.assertEqual(durum(kok, kimlik), once)
        return str(e.exception)


class YoldanDusenTaslak(Ortam):
    """a) Yoluna taslak kural düşen görev koşmaz; kural kabul edilince koşar."""

    def test_yoluna_taslak_kural_dusen_gorev_kosmaz_kabul_edilince_kosar(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        ileti = self.engel(kok, kimlik, "2 taslak", "KU-002 İptal nedeni zorunludur",
                           "KR-002 Sipariş iptali nedensiz olmaz")
        self.assertIn("kabul KR-002 KU-002", ileti)   # karar önce: kural kabul edilmemiş karara dayanamaz
        kabul_et(kok, "KR-002", "KU-002")
        rapor, cikti = sessiz(gorev.kos, kok, kimlik)
        self.assertEqual((rapor["durum"], rapor["sorunlar"]), ("tamam", []))
        self.assertNotIn("taslak_izinleri", durum(kok, kimlik))
        self.assertNotIn("taslağa rağmen", cikti)

    def test_komut_satirinda_cikis_kodu_2_ve_ileti(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        r = subprocess.run([sys.executable, str(BURASI.parent / "h.py"), "gorev", "kos", kimlik], cwd=kok,
                           capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        for parca in ("KU-002", "KR-002", "python3 harness/h.py kabul KR-002 KU-002", "--taslakla"):
            self.assertIn(parca, r.stderr)
        self.assertFalse(agac_var(kok, kimlik))

    def test_kart_acilirken_uyari_satiri_kalir(self):
        kok = deposu(TASLAK_KURALLAR)
        _, cikti = sessiz(gorev.komut, kok, ["yeni", "İş", "--yol", "src/siparis/**"])
        self.assertIn("KU-002, KR-002 — kabul edilmeden bağlayıcı gitmez", cikti)


class Dayanak(Ortam):
    """b) Dayanağı taslak olan iş koşmaz; dayanak kabul edilince koşar; dayanaksız ve taslaksız iş bugünkü gibi koşar."""

    def test_dayanagi_taslak_tasarim_olan_epicin_gorevi_kosmaz_kabul_edilince_kosar(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok, dayanak=["TS-001"])
        self.assertIn("\nSpace: siparis\nDayanak: TS-001\n", epic_metni(kok))
        kimlik = yaprak(kok)
        self.assertEqual(durum(kok, kimlik)["dayanak"], ["TS-001"])   # epic'in dayanağı göreve geçti
        self.assertRegex(kart(kok, kimlik), r"\nYer: .*\nDayanak: TS-001\n\nSen bu görevin işçisisin")
        self.engel(kok, kimlik, "1 taslak", "TS-001 İptal akışının tasarımı")
        kabul_et(kok, "TS-001")
        rapor, _ = sessiz(gorev.kos, kok, kimlik)
        self.assertEqual((rapor["durum"], rapor["sorunlar"]), ("tamam", []))

    def test_dayanaksiz_ve_taslaksiz_gorev_bugunku_gibi_kosar(self):
        kok = deposu()
        kimlik = kart_ac(kok)
        self.assertNotIn("dayanak", durum(kok, kimlik))
        self.assertNotIn("Dayanak:", kart(kok, kimlik))
        rapor, cikti = sessiz(gorev.kos, kok, kimlik)
        self.assertEqual((rapor["durum"], rapor["sorunlar"]), ("tamam", []))
        self.assertNotIn("taslak", cikti)
        self.assertNotIn("taslak_izinleri", durum(kok, kimlik))

    def test_kabul_edilmis_dayanak_engel_degildir(self):
        kok = deposu(TASLAK_TASARIM)
        kod, _ = sessiz(gorev.komut, kok, ["yeni", "İş", "--yol", "src/siparis/**", "--hedef", HEDEF,
                                           "--olcut", OLCUT, "--dayanak", "KR-001", "--dayanak", "KU-001"])
        self.assertEqual(kod, 0)
        self.assertEqual(durum(kok, "GV-001")["dayanak"], ["KR-001", "KU-001"])
        self.assertIn("\n[gorev] rol=uygulayici yol=src/siparis/**\n\nDayanak: KR-001, KU-001\n\nSen bu",
                      kart(kok, "GV-001"))
        rapor, _ = sessiz(gorev.kos, kok, "GV-001")
        self.assertEqual(rapor["durum"], "tamam")

    def test_taskin_kendi_dayanagi_ve_epicinki_birlesir(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok, dayanak=["KR-001"])
        kimlik = yaprak(kok, dayanak=["TS-001", "KR-001"])
        self.assertEqual(durum(kok, kimlik)["dayanak"], ["KR-001", "TS-001"])
        self.engel(kok, kimlik, "TS-001")


class Izin(Ortam):
    """c, e) `--taslakla` ile koşar; izin kaydı görevin kaydındadır; taslak bloğu işçiye ve inceleyiciye yine gider."""

    def test_taslakla_ile_kosar_izin_kaydi_kayittadir(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        self.assertEqual(karar(komut(kok, "python3 harness/h.py gorev kos %s --taslakla" % kimlik)), "ask")
        kod, cikti = sessiz(gorev.komut, kok, ["kos", kimlik, "--taslakla"])   # kancanın bıraktığı işaretle
        self.assertEqual(kod, 0, cikti)
        self.assertIn("kullanıcının izniyle 2 taslağa rağmen koşuyor: KU-002, KR-002", cikti)
        izinler = durum(kok, kimlik)["taslak_izinleri"]
        self.assertEqual([i["taslaklar"] for i in izinler], [["KU-002", "KR-002"]])
        datetime.datetime.fromisoformat(izinler[0]["zaman"])
        sessiz(gorev.kos, kok, kimlik, taslakla=True)   # her izin o çağrıya özeldir: ayrı satır
        self.assertEqual(len(durum(kok, kimlik)["taslak_izinleri"]), 2)
        # e) paketteki taslak bloğu aynen kalır: işçinin kartında ve inceleyicinin isteminde
        yerel = h.ortak_kok(kok) / ".harness/agac" / kimlik / ".harness/gorev" / kimlik / "kart.md"
        self.assertIn("[[KB-TASLAK]]", yerel.read_text(encoding="utf-8"))
        inc, _ = sessiz(gorev.incele, kok, kimlik)
        self.assertEqual(inc["sonuc"], "gecti")
        istem = (kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        self.assertIn("- KU-002@1 ", istem)

    def test_taslak_yokken_bayrak_izin_kaydi_birakmaz(self):
        kok = deposu()
        kimlik = kart_ac(kok)
        rapor, cikti = sessiz(gorev.kos, kok, kimlik, taslakla=True)
        self.assertEqual(rapor["durum"], "tamam")
        self.assertNotIn("taslak_izinleri", durum(kok, kimlik))
        self.assertNotIn("taslağa rağmen", cikti)


class Kanca(Ortam):
    """d) `--taslakla` taşıyan komut onay ayarından bağımsız her zaman sorulur; bayraksız komutta kanca değişmedi."""

    def test_taslakla_gorev_kos_onay_yok_iken_de_sorulur_ve_taslaklari_sayar(self):
        kok = deposu(TASLAK_KURALLAR, onay="yok")
        kimlik = kart_ac(kok)
        c = komut(kok, "python3 harness/h.py gorev kos %s --taslakla" % kimlik)
        self.assertEqual(karar(c), "ask")
        for parca in (IZIN_SORUSU, kimlik + " — İptal nedeni ekle", "2 taslak", "KU-002 İptal nedeni zorunludur",
                      "KR-002 Sipariş iptali nedensiz olmaz", "görevin kaydına yazılır"):
            self.assertIn(parca, gerekce(c))

    def test_taslakla_plan_yurut_onay_yok_iken_de_sorulur_ve_taslaklari_sayar(self):
        kok = deposu(TASLAK_TASARIM, onay="yok")
        plan_kur(kok)
        yaprak(kok, baslik="Birinci")
        ikinci = yaprak(kok, baslik="İkinci", dayanak=["TS-001"])
        c = komut(kok, "python3 harness/h.py plan yurut EP-001 --taslakla")
        self.assertEqual(karar(c), "ask")
        for parca in (IZIN_SORUSU, "EP-001 — İptal nedenleri", "taslak düşen 1 yaprak",
                      "2 İkinci (%s): TS-001 İptal akışının tasarımı" % ikinci):
            self.assertIn(parca, gerekce(c))
        self.assertNotIn("1 Birinci (GV-001):", gerekce(c))

    def test_bayraksiz_taslaksiz_komutta_kancanin_davranisi_degismedi(self):
        # GV-140 incelemesi: "bugünkü davranış" yalnız taslaksız iş için geçerlidir; taslaklı işi kanca reddeder
        kok = deposu(onay="yok")
        kimlik = kart_ac(kok)
        plan_kur(kok)
        yaprak(kok)
        self.assertIsNone(komut(kok, "python3 harness/h.py gorev kos " + kimlik))
        self.assertIsNone(komut(kok, "python3 harness/h.py plan yurut EP-001"))
        kok = deposu()   # varsayılan onay: koşturma sorulur, sorusu bugünkü özettir
        kimlik = kart_ac(kok)
        c = komut(kok, "python3 harness/h.py gorev kos " + kimlik)
        self.assertEqual(karar(c), "ask")
        self.assertNotIn(IZIN_SORUSU, gerekce(c))
        self.assertTrue(gerekce(c).startswith("[harness] " + ajan_hook.GOREV_SORUSU["kos"]))

    def test_bayraksiz_taslakli_iste_kanca_aracin_reddini_verir(self):
        for onay in ("yok", "baslangic", "her-adim"):
            kok = deposu(TASLAK_TASARIM, onay=onay)
            kimlik = kart_ac(kok, dayanak=["TS-001"])
            c = komut(kok, "python3 harness/h.py gorev kos " + kimlik)
            self.assertEqual(karar(c), "deny", onay)
            with self.assertRaises(h.HarnessHata) as e:
                sessiz(gorev.kos, kok, kimlik)
            self.assertEqual(gerekce(c), "[harness] " + str(e.exception))   # aynı ileti
            plan_kur(kok)
            ilk = yaprak(kok, dayanak=["TS-001"])
            c = komut(kok, "python3 harness/h.py plan yurut EP-001")
            self.assertEqual(karar(c), "deny", onay)
            for parca in (ilk + " koşturulmadı", "TS-001 İptal akışının tasarımı (taslak)",
                          "python3 harness/h.py plan yurut EP-001 --taslakla"):
                self.assertIn(parca, gerekce(c))

    def test_yurutmede_ilk_hazir_yaprak_temizse_kanca_bugunku_gibidir(self):
        kok = deposu(TASLAK_TASARIM, onay="yok")
        plan_kur(kok)
        yaprak(kok, baslik="Birinci")
        yaprak(kok, baslik="İkinci", dayanak=["TS-001"])   # araç birinciyi alır, ikincide durur
        self.assertIsNone(komut(kok, "python3 harness/h.py plan yurut EP-001"))

    def test_bayrak_komutun_her_yerinde_ve_her_biciminde_sorulur(self):
        kok = deposu(TASLAK_KURALLAR, onay="yok")
        kimlik = kart_ac(kok)
        bas = "python3 harness/h.py gorev kos %s" % kimlik
        for metin in (bas + ' --not "önce testleri koş; sonra rapor" --taslakla',
                      bas + ' --not "a & b | c" --taslakla',
                      bas + " \\\n  --taslakla",
                      bas + ' "--taslakla"',
                      bas + " '--taslakla'",
                      bas + "; echo --taslakla"):   # fazladan sormak zararsızdır
            c = komut(kok, metin)
            self.assertEqual(karar(c), "ask", metin)
            self.assertIn(IZIN_SORUSU, gerekce(c), metin)
        plan_kur(kok)
        yaprak(kok)
        c = komut(kok, "python3 harness/h.py plan yurut EP-001 --en-cok 1 \\\n  '--taslakla' | tee $TMPDIR/k.txt")
        self.assertEqual(karar(c), "ask")
        self.assertIn(IZIN_SORUSU, gerekce(c))

    def test_isci_oturumu_bayrakla_baska_gorev_kosturamaz(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        for metin in ("python3 harness/h.py gorev kos %s --taslakla" % kimlik,
                      "python3 harness/h.py plan yurut EP-001 --taslakla"):
            self.assertEqual(karar(komut(kok, metin, ortam={"HARNESS_GOREV": "GV-009"})), "deny")

    def test_soru_gostermeyen_izin_modunda_reddedilir(self):
        kok = deposu(TASLAK_KURALLAR, onay="yok")
        kimlik = kart_ac(kok)
        c = ajan_hook.isle("komut-oncesi", {"session_id": "s1", "cwd": str(kok), "tool_name": "Bash",
                                            "permission_mode": "bypassPermissions",
                                            "tool_input": {"command": "python3 harness/h.py gorev kos %s --taslakla"
                                                           % kimlik}}, {})
        self.assertEqual(karar(c), "deny")
        self.assertIn("kendi terminalinde", gerekce(c))


class IzinIsareti(Ortam):
    """Araç `--taslakla` iznini kendisi doğrular: kancanın bıraktığı taze işaret tüketilir; yoksa kullanıcının uçbiriminde
    sorulur; o da yoksa koşturmaz (kancanın tanımadığı komut biçimi izinsiz koşmaz)."""

    def cli(self, kok, *arg):
        return subprocess.run([sys.executable, str(BURASI.parent / "h.py")] + list(arg), cwd=kok, capture_output=True,
                              text=True, encoding="utf-8", stdin=subprocess.DEVNULL)

    def isaret(self, kok, hedef):
        return gorev._izin_isareti(kok, hedef)

    def reddedilir(self, kok, kimlik):
        once = durum(kok, kimlik)
        r = self.cli(kok, "gorev", "kos", kimlik, "--taslakla")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("izin sorusu sorulmadan --taslakla kullanılamaz", r.stderr)
        self.assertEqual(durum(kok, kimlik), once)
        self.assertFalse(self.isaret(kok, kimlik).exists())

    def test_isaret_yokken_ve_ucbirim_degilken_arac_reddeder(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        self.reddedilir(kok, kimlik)
        self.assertFalse(agac_var(kok, kimlik))
        self.assertNotIn("taslak_izinleri", durum(kok, kimlik))
        plan_kur(kok)
        ilk = yaprak(kok)
        r = self.cli(kok, "plan", "yurut", "EP-001", "--taslakla")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("EP-001 koşturulmadı: izin sorusu sorulmadan --taslakla kullanılamaz", r.stderr)
        self.assertFalse(agac_var(kok, ilk))

    def test_isaret_tek_kullanimliktir(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        komut(kok, "python3 harness/h.py gorev kos %s --taslakla" % kimlik)
        self.assertEqual(json.loads(self.isaret(kok, kimlik).read_text(encoding="utf-8"))["taslaklar"],
                         ["KU-002", "KR-002"])
        kod, _ = sessiz(gorev.komut, kok, ["kos", kimlik, "--taslakla"])
        self.assertEqual(kod, 0)
        self.assertFalse(self.isaret(kok, kimlik).exists())
        self.reddedilir(kok, kimlik)   # aynı işaret ikinci kez kullanılamaz
        self.assertEqual(len(durum(kok, kimlik)["taslak_izinleri"]), 1)

    def test_isaret_suresi_gecince_gecmez(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        gorev.taslak_izni_yaz(kok, kimlik, ["KU-002", "KR-002"], simdi=time.time() - gorev.TASLAK_IZNI_SURESI_SN - 5)
        self.reddedilir(kok, kimlik)
        self.assertFalse(agac_var(kok, kimlik))

    def test_baska_hedefin_isareti_gecmez(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik, baska = kart_ac(kok), kart_ac(kok, baslik="Başka")
        komut(kok, "python3 harness/h.py gorev kos %s --taslakla" % baska)
        self.reddedilir(kok, kimlik)
        self.assertTrue(self.isaret(kok, baska).exists())

    def test_ucbirimde_kullaniciya_sorar(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        ucbirim = mock.Mock()
        ucbirim.stdin.isatty.return_value = ucbirim.stdout.isatty.return_value = True
        with mock.patch.object(gorev, "sys", ucbirim), mock.patch("builtins.input", return_value="hayır"):
            with self.assertRaisesRegex(h.HarnessHata, "kullanıcı taslaklara rağmen koşturmaya izin vermedi"):
                sessiz(gorev.komut, kok, ["kos", kimlik, "--taslakla"])
        self.assertFalse(agac_var(kok, kimlik))
        with mock.patch.object(gorev, "sys", ucbirim), mock.patch("builtins.input", return_value="evet"):
            kod, cikti = sessiz(gorev.komut, kok, ["kos", kimlik, "--taslakla"])
        self.assertEqual(kod, 0)
        self.assertIn("KU-002 İptal nedeni zorunludur (taslak)", cikti)   # soru taslakları sayar
        self.assertEqual(len(durum(kok, kimlik)["taslak_izinleri"]), 1)

    def test_taslaksiz_iste_bayrak_izin_istemez(self):
        kok = deposu()
        kimlik = kart_ac(kok)
        r = self.cli(kok, "gorev", "kos", kimlik, "--taslakla")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("taslak_izinleri", durum(kok, kimlik))

    def test_plan_yurut_kancanin_isaretiyle_surer(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok, dayanak=["TS-001"])
        ilk = yaprak(kok)
        self.assertEqual(karar(komut(kok, "python3 harness/h.py plan yurut EP-001 --taslakla")), "ask")
        kod, cikti = sessiz(plan.komut, kok, ["yurut", "EP-001", "--taslakla"])
        self.assertEqual(kod, 0, cikti)
        self.assertEqual([i["taslaklar"] for i in durum(kok, ilk)["taslak_izinleri"]], [["TS-001"]])
        self.assertFalse(self.isaret(kok, "EP-001").exists())


class KabulOlmayanDayanak(Ortam):
    """Durumu kabul olmayan her dayanak engeldir (taslak, ezildi, emekli); ileti durumu yazar."""

    def test_ezilmis_ve_emekli_dayanak_engeldir(self):
        eski = (KARAR.replace("KR-001", "KR-003").replace("durum: kabul", "durum: ezildi\nyerine: KR-001")
                .replace("baslik: Durum tek tablodan yönetilir", "baslik: Eski iptal kararı"))
        emekli = (KARAR.replace("KR-001", "KR-004").replace("durum: kabul", "durum: emekli")
                  .replace("baslik: Durum tek tablodan yönetilir", "baslik: Emekli karar"))
        kok = deposu(dict(TASLAK_TASARIM, **{"kb/karar/KR-003-eski.md": eski, "kb/karar/KR-004-emekli.md": emekli}))
        kimlik = kart_ac(kok, dayanak=["KR-003", "KR-004"])
        with self.assertRaises(h.HarnessHata) as e:
            sessiz(gorev.kos, kok, kimlik)
        for parca in ("2 taslak", "KR-003 Eski iptal kararı (ezildi)", "KR-004 Emekli karar (emekli)",
                      "ezilmiş ya da emekli dayanak kabulle açılmaz", "gorev kos %s --taslakla" % kimlik):
            self.assertIn(parca, str(e.exception))
        self.assertNotIn("harness/h.py kabul", str(e.exception))   # ezilmiş düğüm kabul edilemez
        self.assertFalse(agac_var(kok, kimlik))
        sessiz(gorev.dayanak, kok, kimlik, ["TS-001"])
        with self.assertRaises(h.HarnessHata) as e:
            sessiz(gorev.kos, kok, kimlik)
        self.assertIn("python3 harness/h.py kabul TS-001; ezilmiş ya da emekli", str(e.exception))
        self.assertIn("TS-001 İptal akışının tasarımı (taslak)", str(e.exception))


class Yurutme(Ortam):
    """e) `plan yurut` taslaklı yaprakta durur, önceki yaprakları almış olur; iletisi taslakları sayar."""

    def test_taslakli_yaprakta_durur_oncekini_almis_olur_izinle_surer(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok)
        birinci = yaprak(kok, baslik="Birinci")
        ikinci = yaprak(kok, baslik="İkinci", dayanak=["TS-001"])
        kod, cikti = sessiz(plan.komut, kok, ["yurut", "EP-001"])
        self.assertEqual(kod, 1)
        self.assertIn("EP-001: 1 yaprak alındı", cikti)
        self.assertIn("DURDU: EP-001 2 (%s) — taslak aşamasında" % ikinci, cikti)
        for parca in ("1 taslak", "TS-001 İptal akışının tasarımı", "python3 harness/h.py kabul TS-001",
                      "python3 harness/h.py plan yurut EP-001 --taslakla"):
            self.assertIn(parca, cikti)
        self.assertTrue(durum(kok, birinci).get("alindi"))
        self.assertFalse(agac_var(kok, ikinci))
        self.assertNotIn("kosuldu", durum(kok, ikinci))
        sonuc, _ = sessiz(plan.yurut, kok, "EP-001", taslakla=True)
        self.assertEqual((sonuc["alinan"], sonuc["duran"], sonuc["bitti"]), ([ikinci], None, True))
        self.assertEqual([i["taslaklar"] for i in durum(kok, ikinci)["taslak_izinleri"]], [["TS-001"]])


class VarOlmayanDayanak(Ortam):
    """f) Var olmayan (ya da karar, kural, tasarım olmayan) kimlikle `--dayanak` hiçbir şey yazmaz."""

    def gorevler(self, kok):
        return sorted(p.name for p in (h.ortak_kok(kok) / ".harness/gorev").glob("GV-*"))

    def test_gorev_yeni(self):
        kok = deposu()
        for yanlis in ("KR-999", "YP-001"):   # YP-001 var ama yapı düğümüdür
            with self.assertRaisesRegex(h.HarnessHata, yanlis + " var olan bir karar, kural ya da tasarım"):
                sessiz(gorev.komut, kok, ["yeni", "İş", "--yol", "src/siparis/**", "--dayanak", "KR-001",
                                          "--dayanak", yanlis])
        self.assertEqual(self.gorevler(kok), [])

    def test_plan_epic_task_subtask(self):
        kok = deposu()
        sessiz(plan.space, kok, "Sipariş", amac="A.", yollar=["src/siparis/**"])
        space = (h.ortak_kok(kok) / ".harness/plan/siparis/space.md").read_text(encoding="utf-8")
        with self.assertRaisesRegex(h.HarnessHata, "KR-999"):
            sessiz(plan.komut, kok, ["epic", "siparis", "İptal", "--dayanak", "KR-999"])
        self.assertEqual(sorted(p.name for p in (h.ortak_kok(kok) / ".harness/plan").rglob("EP-*")), [])
        self.assertEqual((h.ortak_kok(kok) / ".harness/plan/siparis/space.md").read_text(encoding="utf-8"), space)
        sessiz(plan.epic, kok, "siparis", "İptal nedenleri", hedef="H.")
        yaprak(kok)
        once = epic_metni(kok)
        with self.assertRaisesRegex(h.HarnessHata, "KR-999"):
            sessiz(plan.komut, kok, ["task", "EP-001", "İş", "--hedef", HEDEF, "--olcut", OLCUT, "--dayanak", "KR-999"])
        with self.assertRaisesRegex(h.HarnessHata, "KR-999"):   # bölünecek yaprak atılmaz
            sessiz(plan.komut, kok, ["subtask", "EP-001", "1", "Alt", "--hedef", HEDEF, "--olcut", OLCUT,
                                     "--dayanak", "KR-999"])
        self.assertEqual(epic_metni(kok), once)
        self.assertEqual(self.gorevler(kok), ["GV-001"])
        self.assertEqual(durum(kok, "GV-001")["durum"], "taslak")

    def test_plan_dayanak_ve_gorev_dayanak(self):
        kok = deposu()
        plan_kur(kok)
        kimlik = yaprak(kok)
        once = (epic_metni(kok), durum(kok, kimlik), kart(kok, kimlik))
        with self.assertRaisesRegex(h.HarnessHata, "KR-999"):
            sessiz(plan.komut, kok, ["dayanak", "EP-001", "KR-001", "KR-999"])
        with self.assertRaisesRegex(h.HarnessHata, "KR-999"):
            sessiz(gorev.komut, kok, ["dayanak", kimlik, "KR-999"])
        self.assertEqual((epic_metni(kok), durum(kok, kimlik), kart(kok, kimlik)), once)

    def test_kapsayici_taska_dayanak_verilmez(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok)
        once = epic_metni(kok)
        with self.assertRaisesRegex(h.HarnessHata, "kapsayıcı"):
            sessiz(plan.task, kok, "EP-001", "Kapsayıcı", dayanak=["TS-001"])
        self.assertEqual(epic_metni(kok), once)

    def test_kendi_dayanagini_tasiyan_yaprak_dayanagi_dusurerek_bolunmez(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok)
        kimlik = yaprak(kok, dayanak=["TS-001"])
        with self.assertRaisesRegex(h.HarnessHata, "kendi dayanağını taşıyor \\(TS-001\\)"):
            sessiz(plan.subtask, kok, "EP-001", 1, "Alt", hedef=HEDEF, olcut=OLCUT)
        self.assertEqual(durum(kok, kimlik)["durum"], "taslak")
        (_, alt_gorev), _ = sessiz(plan.subtask, kok, "EP-001", 1, "Alt", hedef=HEDEF, olcut=OLCUT,
                                   dayanak=["TS-001"])
        self.assertEqual(durum(kok, alt_gorev)["dayanak"], ["TS-001"])


class SonradanEkleme(Ortam):
    """g) `plan dayanak` ve `gorev dayanak` var olan kayda ekler; alınmış göreve eklenemez."""

    def test_gorev_dayanak_kayda_ve_karta_ekler(self):
        kok = deposu(TASLAK_TASARIM)
        kimlik = kart_ac(kok)
        kod, cikti = sessiz(gorev.komut, kok, ["dayanak", kimlik, "TS-001"])
        self.assertEqual((kod, cikti), (0, "%s dayanak: TS-001\n" % kimlik))
        self.assertEqual(durum(kok, kimlik)["dayanak"], ["TS-001"])
        self.assertIn("\n[gorev] rol=uygulayici yol=src/siparis/**\n\nDayanak: TS-001\n\nSen bu", kart(kok, kimlik))
        self.engel(kok, kimlik, "TS-001 İptal akışının tasarımı")
        sessiz(gorev.dayanak, kok, kimlik, ["KR-001", "TS-001"])
        self.assertEqual(durum(kok, kimlik)["dayanak"], ["TS-001", "KR-001"])
        self.assertEqual(kart(kok, kimlik).count("Dayanak: "), 1)
        self.assertIn("\nDayanak: TS-001, KR-001\n", kart(kok, kimlik))

    def test_alinmis_goreve_eklenemez(self):
        kok = deposu(TASLAK_TASARIM)
        kimlik = kart_ac(kok)
        sessiz(gorev.kos, kok, kimlik)
        sessiz(gorev.incele, kok, kimlik)
        sessiz(gorev.al, kok, kimlik)
        once = (durum(kok, kimlik), kart(kok, kimlik))
        with self.assertRaisesRegex(h.HarnessHata, "kapanmış \\(alındı\\); dayanak eklenemez"):
            sessiz(gorev.komut, kok, ["dayanak", kimlik, "TS-001"])
        self.assertEqual((durum(kok, kimlik), kart(kok, kimlik)), once)

    def test_plan_dayanak_epice_ve_acik_yapraklarina_ekler(self):
        kok = deposu(TASLAK_TASARIM)
        plan_kur(kok)
        alinan = yaprak(kok, baslik="Birinci")
        sessiz(plan.yurut, kok, "EP-001")
        self.assertTrue(durum(kok, alinan).get("alindi"))
        acik = yaprak(kok, baslik="İkinci")
        alinan_once = (durum(kok, alinan), kart(kok, alinan))
        kod, cikti = sessiz(plan.komut, kok, ["dayanak", "EP-001", "TS-001"])
        self.assertEqual(kod, 0)
        self.assertIn("EP-001 dayanak: TS-001 · görevlerine geçti: %s" % acik, cikti)
        self.assertIn("\nSpace: siparis\nDayanak: TS-001\nAçıldı: ", epic_metni(kok))
        self.assertEqual(durum(kok, acik)["dayanak"], ["TS-001"])
        self.assertRegex(kart(kok, acik), r"\nYer: .*\nDayanak: TS-001\n")
        self.assertEqual((durum(kok, alinan), kart(kok, alinan)), alinan_once)
        self.engel(kok, acik, "TS-001")
        sonraki = yaprak(kok, baslik="Üçüncü")   # sonradan açılan yaprak epic'in dayanağını alır
        self.assertEqual(durum(kok, sonraki)["dayanak"], ["TS-001"])
        sessiz(plan.dayanak, kok, "EP-001", ["KR-001"])
        self.assertIn("\nDayanak: TS-001, KR-001\n", epic_metni(kok))
        self.assertEqual(durum(kok, acik)["dayanak"], ["TS-001", "KR-001"])


class EngellenmeyenIslemler(Ortam):
    """h) İncele, al, at ve tazele taslaklı işte engellenmez (iş çoktan yapılmıştır)."""

    def test_incele_al_at_tazele_taslakli_iste_calisir(self):
        kok = deposu(TASLAK_KURALLAR)
        kimlik = kart_ac(kok)
        sessiz(gorev.kos, kok, kimlik, taslakla=True)
        self.assertTrue(gorev.is_taslaklari(kok, durum(kok, kimlik)))   # taslaklar hâlâ kabul edilmedi
        sessiz(gorev.tazele, kok, kimlik)
        inc, _ = sessiz(gorev.incele, kok, kimlik)
        self.assertEqual(inc["sonuc"], "gecti")
        sessiz(gorev.al, kok, kimlik)
        self.assertTrue(durum(kok, kimlik)["alindi"])
        ikinci = kart_ac(kok, baslik="İkinci")
        sessiz(gorev.kos, kok, ikinci, taslakla=True)
        sessiz(gorev.at, kok, ikinci)
        self.assertEqual(durum(kok, ikinci)["durum"], "atildi")


if __name__ == "__main__":
    unittest.main(verbosity=1)
