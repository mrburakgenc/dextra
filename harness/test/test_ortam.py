#!/usr/bin/env python3
"""Ortam ön kontrolü ve elle başlatılan görevde kesişim denetimi (TS-009 Yapı 4 ve 5; GV-161).

`claude -p` yerine test_gorev.py'nin sahte işçisi ve sahte inceleyicisi koşar.

Koşum: python3 harness/test/test_ortam.py
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
import rapor  # noqa: E402
from test_gorev import agac, dolu_kart, gorev_deposu, kayit  # noqa: E402

YOK_KOMUT = "harness-boyle-bir-komut-yok-7731"


def cli(kok, *arg):
    return subprocess.run([sys.executable, str(pathlib.Path(h.__file__).resolve()), *arg], cwd=kok,
                          capture_output=True, text=True, stdin=subprocess.DEVNULL)


def gecmis(kok, kimlik):
    return gorev.kosu_gecmisi(kayit(kok, kimlik))


def oturum_basladi(kok, kimlik, rol="uygulayici"):
    return (agac(kok, kimlik) / ".harness/gorev" / kimlik / ("argv-%s.json" % rol)).exists()


def bayrakli_kontrol():
    """Bayrak dosyası varken kalan, yokken geçen bir ön kontrol komutu: (komut, bayrak yolu)."""
    bayrak = pathlib.Path(tempfile.mkdtemp(prefix="harness-bayrak-")) / "kapali"
    betik = "import os, sys; print('VERITABANI-KAPALI-4410') if os.path.exists(%r) else None; " \
            "sys.exit(1 if os.path.exists(%r) else 0)" % (str(bayrak), str(bayrak))
    return [sys.executable, "-c", betik], bayrak


def yerel_klasor(ad: str, govde: str) -> pathlib.Path:
    """İçinde `ad` adlı çalıştırılabilir bir kabuk betiği duran geçici klasör."""
    klasor = pathlib.Path(tempfile.mkdtemp(prefix="harness-yerel-"))
    betik = klasor / ad
    betik.write_text("#!/bin/sh\n" + govde + "\n", encoding="utf-8")
    betik.chmod(0o755)
    return klasor


def yerel_ayar(kok, yollar):
    (kok / "harness.yerel.json").write_text(json.dumps({"gorev": {"yol": yollar}}), encoding="utf-8")


class Temel(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)

    tearDown = setUp


class HazirlikYoldaYok(Temel):
    """a) Hazırlık komutu yolda yoksa döküm yok, ad ve PATH söylenir, kod sıfır değil, geçmişe 'ortam' düşer."""

    def test_komut_satirinda_dokum_vermez_ortam_kaydi_yazar(self):
        kok = gorev_deposu(hazirlik=[YOK_KOMUT, "install"])
        kimlik = dolu_kart(kok)
        r = cli(kok, "gorev", "kos", kimlik)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("Traceback", r.stderr + r.stdout)
        self.assertIn(YOK_KOMUT, r.stderr)
        self.assertIn("PATH", r.stderr)
        self.assertEqual(gecmis(kok, kimlik)[-1]["sonuc"], "ortam")
        self.assertEqual((gecmis(kok, kimlik)[-1]["tip"], gecmis(kok, kimlik)[-1]["adim"]), ("ortam", "isci"))
        self.assertFalse(oturum_basladi(kok, kimlik))

    def test_ortam_duzelince_yeniden_kosar(self):
        kontrol, bayrak = bayrakli_kontrol()
        bayrak.write_text("x", encoding="utf-8")
        kok = gorev_deposu(on_kontrol=[kontrol])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata):
            gorev.kos(kok, kimlik)
        bayrak.unlink()
        rapor = gorev.kos(kok, kimlik)
        self.assertEqual(rapor["durum"], "tamam")
        self.assertTrue(oturum_basladi(kok, kimlik))


class OnKontrol(Temel):
    """b) ve c) gorev.on_kontrol komutları oturumdan önce sırayla koşar."""

    def test_kalan_on_kontrol_isci_oturumunu_baslatmaz(self):
        kontrol, bayrak = bayrakli_kontrol()
        bayrak.write_text("x", encoding="utf-8")
        gecen = [sys.executable, "-c", "pass"]
        kok = gorev_deposu(on_kontrol=[gecen, kontrol])
        kimlik = dolu_kart(kok)
        r = cli(kok, "gorev", "kos", kimlik)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("VERITABANI-KAPALI-4410", r.stderr)   # kalan komutun çıktısı
        self.assertIn("sys.exit(1 if", r.stderr)            # kalan komutun kendisi
        self.assertEqual(gecmis(kok, kimlik)[-1]["sonuc"], "ortam")
        self.assertFalse(oturum_basladi(kok, kimlik))

    def test_yolda_olmayan_on_kontrol_komutu_dokum_vermez(self):
        kok = gorev_deposu(on_kontrol=[[YOK_KOMUT]])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata) as e:
            gorev.kos(kok, kimlik)
        self.assertIn(YOK_KOMUT, str(e.exception))
        self.assertEqual(gecmis(kok, kimlik)[-1]["sonuc"], "ortam")
        self.assertFalse(oturum_basladi(kok, kimlik))

    def test_kalan_on_kontrol_inceleme_oturumunu_baslatmaz(self):
        kontrol, bayrak = bayrakli_kontrol()
        kok = gorev_deposu(on_kontrol=[kontrol])
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "tamam")
        bayrak.write_text("x", encoding="utf-8")
        r = cli(kok, "gorev", "incele", kimlik)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("VERITABANI-KAPALI-4410", r.stderr)
        son = gecmis(kok, kimlik)[-1]
        self.assertEqual((son["tip"], son["adim"], son["sonuc"]), ("ortam", "inceleme", "ortam"))
        self.assertFalse(oturum_basladi(kok, kimlik, "inceleyici"))
        self.assertIsNone(json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))["inceleme"])

    def test_ortam_kaydi_rapor_tablosunda_kosu_sayilmaz(self):
        kontrol, bayrak = bayrakli_kontrol()
        bayrak.write_text("x", encoding="utf-8")
        kok = gorev_deposu(on_kontrol=[kontrol])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata):
            gorev.kos(kok, kimlik)
        bayrak.unlink()
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "tamam")
        bayrak.write_text("x", encoding="utf-8")
        with self.assertRaises(h.HarnessHata):
            gorev.incele(kok, kimlik)
        bayrak.unlink()
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        self.assertEqual([k["sonuc"] for k in gecmis(kok, kimlik)], ["ortam", "tamam", "ortam", "gecti"])
        hucreler = [c.strip() for c in rapor._satir(kok, kimlik)["metin"].strip("|").split("|")]
        self.assertEqual(hucreler[4], "1 / 1")   # 'Koşu' sütunu: işçi koşusu / inceleme

    def test_on_kontrol_bosken_davranis_bugunku(self):
        kok = gorev_deposu()
        self.assertEqual(h.ayar_oku(kok)["gorev"]["on_kontrol"], [])
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "tamam")
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        self.assertEqual([k["sonuc"] for k in gecmis(kok, kimlik)], ["tamam", "gecti"])

    def test_hepsi_gecerse_oturumlar_baslar_komutlar_gorev_agacinda_kosar(self):
        yer = pathlib.Path(tempfile.mkdtemp(prefix="harness-cwd-")) / "cwd.txt"
        yaz = "import os, pathlib; p = pathlib.Path(%r); p.write_text(p.read_text() + os.getcwd() + '\\n' " \
              "if p.exists() else os.getcwd() + '\\n')" % str(yer)
        kok = gorev_deposu(on_kontrol=[[sys.executable, "-c", "pass"], [sys.executable, "-c", yaz]])
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "tamam")
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        self.assertEqual([k["sonuc"] for k in gecmis(kok, kimlik)], ["tamam", "gecti"])
        satirlar = yer.read_text(encoding="utf-8").split()
        self.assertEqual(len(satirlar), 2)   # işçiden ve inceleyiciden önce birer kez
        self.assertTrue(all(pathlib.Path(s).resolve() == agac(kok, kimlik).resolve() for s in satirlar))


class YerelAyar(Temel):
    """d) harness.yerel.json içindeki gorev.yol klasörleri PATH'in başına eklenir."""

    def test_yerel_klasordeki_hazirlik_komutu_bulunur_ve_kosar(self):
        klasor = yerel_klasor("sahte-paketci", "echo hazir > hazir.txt")
        kok = gorev_deposu(hazirlik=["sahte-paketci"])
        yerel_ayar(kok, [str(klasor)])
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertTrue((agac(kok, kimlik) / "hazir.txt").is_file())
        self.assertTrue(oturum_basladi(kok, kimlik))

    def test_dosya_yokken_bulunmaz(self):
        yerel_klasor("sahte-paketci", "echo hazir > hazir.txt")
        kok = gorev_deposu(hazirlik=["sahte-paketci"])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata) as e:
            gorev.kos(kok, kimlik)
        self.assertIn("sahte-paketci", str(e.exception))
        self.assertEqual(gecmis(kok, kimlik)[-1]["sonuc"], "ortam")
        self.assertFalse(oturum_basladi(kok, kimlik))

    def test_goreli_klasor_deponun_kokune_gore_okunur(self):
        kok = gorev_deposu(hazirlik=["sahte-paketci"])
        (kok / "araclar").mkdir()
        betik = kok / "araclar" / "sahte-paketci"
        betik.write_text("#!/bin/sh\necho hazir > hazir.txt\n", encoding="utf-8")
        betik.chmod(0o755)
        yerel_ayar(kok, ["araclar"])
        kimlik = dolu_kart(kok)
        gorev.kos(kok, kimlik)
        self.assertTrue((agac(kok, kimlik) / "hazir.txt").is_file())

    def test_on_kontrol_ve_oturumlar_yerel_klasoru_yolda_gorur(self):
        kontrol = yerel_klasor("sahte-kapi", "exit 0")
        kok = gorev_deposu(on_kontrol=[["sahte-kapi"]])
        # oturum komutu da yalnız yerel klasörde durur ve gördüğü PATH'i görev kaydına yazar
        sahte = json.loads((kok / "harness.json").read_text(encoding="utf-8"))["gorev"]["komut"]
        oturum = yerel_klasor("sahte-claude", 'echo "$PATH" > "$HARNESS_KOK/.harness/gorev/$HARNESS_GOREV/'
                              'path-$HARNESS_ROL.txt"\nexec %s "$@"' % " ".join("'%s'" % a for a in sahte))
        ayar = json.loads((kok / "harness.json").read_text(encoding="utf-8"))
        ayar["gorev"]["komut"] = ["sahte-claude"]
        (kok / "harness.json").write_text(json.dumps(ayar), encoding="utf-8")
        subprocess.run(["git", "commit", "-qam", "oturum komutu"], cwd=kok, check=True, capture_output=True)
        yerel_ayar(kok, [str(kontrol), str(oturum)])
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "tamam")
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        for rol in ("uygulayici", "inceleyici"):
            yol = (agac(kok, kimlik) / ".harness/gorev" / kimlik / ("path-%s.txt" % rol)).read_text().strip()
            self.assertEqual(yol.split(os.pathsep)[:2], [str(kontrol), str(oturum)])


class Kesisim(Temel):
    """e) Elle başlatılan görev, işareti canlı ve yolları kesişen başka bir görev varken başlamaz."""

    def setUp(self):
        super().setUp()
        self.surecler = []

    def tearDown(self):
        for s in self.surecler:
            s.kill()
            s.wait()
        super().tearDown()

    def _canli_pid(self):
        s = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        self.surecler.append(s)
        return s.pid

    @staticmethod
    def _olu_pid():
        s = subprocess.Popen([sys.executable, "-c", "pass"])
        s.wait()
        return s.pid

    @staticmethod
    def _isaret(kok, kimlik, pid):
        (kayit(kok, kimlik) / "kosuyor.json").write_text(json.dumps(
            {"tip": "isci", "pid": pid, "basla": datetime.datetime.now().isoformat(timespec="seconds")}),
            encoding="utf-8")

    def test_canli_ve_kesisen_gorev_varken_reddeder(self):
        kok = gorev_deposu()
        kosan, yeni = dolu_kart(kok), dolu_kart(kok, yollar=["src/siparis/iptal.ts"])
        self._isaret(kok, kosan, self._canli_pid())
        r = cli(kok, "gorev", "kos", yeni)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn(kosan, r.stderr)
        self.assertFalse(agac(kok, yeni).exists())   # kesişim reddinde çalışma ağacı açılmaz
        self.assertEqual(gecmis(kok, yeni), [])

    def test_isareti_koyan_surec_olmusse_kosar(self):
        kok = gorev_deposu()
        kosan, yeni = dolu_kart(kok), dolu_kart(kok)
        self._isaret(kok, kosan, self._olu_pid())
        self.assertEqual(gorev.kos(kok, yeni)["durum"], "tamam")

    def test_yollar_kesismiyorsa_kosar(self):
        kok = gorev_deposu()
        kosan, yeni = dolu_kart(kok, yollar=["src/odeme/**"]), dolu_kart(kok)
        self._isaret(kok, kosan, self._canli_pid())
        self.assertEqual(gorev.kos(kok, yeni)["durum"], "tamam")

    def test_ayni_anda_baslayan_kesisen_iki_gorevden_yalniz_biri_kosar(self):
        # uzun hazırlık, denetim ile işaret arasındaki aralığı açar; iki ayrı süreç aynı anda başlatılır
        kok = gorev_deposu(hazirlik=[sys.executable, "-c", "import time; time.sleep(3)"])
        kimlikler = [dolu_kart(kok), dolu_kart(kok, yollar=["src/siparis/iptal.ts"])]
        betik = os.path.abspath(h.__file__)
        surecler = [subprocess.Popen([sys.executable, betik, "gorev", "kos", k], cwd=kok, stdin=subprocess.DEVNULL,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for k in kimlikler]
        sonuclar = [s.communicate(timeout=120) + (s.returncode,) for s in surecler]
        kodlar = [s[2] for s in sonuclar]
        self.assertEqual(sorted(k == 0 for k in kodlar), [False, True], sonuclar)
        kosan, reddedilen = (0, 1) if kodlar[0] == 0 else (1, 0)
        self.assertTrue(oturum_basladi(kok, kimlikler[kosan]))
        self.assertIn(kimlikler[kosan], sonuclar[reddedilen][1])
        self.assertNotIn("Traceback", sonuclar[reddedilen][1])
        self.assertFalse(agac(kok, kimlikler[reddedilen]).exists())   # reddedilenin ağacı açılmaz
        self.assertEqual(gecmis(kok, kimlikler[reddedilen]), [])

    def test_hazirlikta_kalan_gorevin_isareti_kalkar(self):
        # işaret hazırlıktan önce konur; hazırlık kalınca aynı süreç sürse de (plan yurut) işaret kalkar
        kok = gorev_deposu(hazirlik=[YOK_KOMUT])
        kimlik = dolu_kart(kok)
        with self.assertRaises(h.HarnessHata):
            gorev.kos(kok, kimlik)
        self.assertFalse((kayit(kok, kimlik) / "kosuyor.json").exists())


class PlanYurutme(Temel):
    """Plan yürütmesi, incelemede kalan ön kontrolde yapılandırılmış biçimde durur; temiz biten yaprak alınır."""

    def test_incelemede_kalan_on_kontrol_yurutmeyi_durdurur_temiz_yaprak_alinir(self):
        import plan
        os.environ["SAHTE_MOD"] = "ayri"
        sayac = pathlib.Path(tempfile.mkdtemp(prefix="harness-sayac-"))
        # GV-002'nin ikinci ön kontrolü (incelemeden önceki) kalır; GV-001'inkiler geçer
        betik = ("import os, pathlib, sys; ad = pathlib.Path(os.getcwd()).name; f = pathlib.Path(%r) / ad; "
                 "kal = ad == 'GV-002' and f.exists(); f.touch(); print('DOCKER-KAPALI-5521') if kal else None; "
                 "sys.exit(1 if kal else 0)" % str(sayac))
        kok = gorev_deposu(paralel=2, on_kontrol=[[sys.executable, "-c", betik]])
        plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/siparis/**"])
        plan.epic(kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
        for baslik, yollar in (("Bir", ["src/gv-001/**"]), ("İki", ["src/gv-002/**"])):
            plan.task(kok, "EP-001", baslik, rol="uygulayici", yollar=yollar, hedef="H.", olcut="Ö.")
        sonuc = plan.yurut(kok, "EP-001")
        self.assertEqual(sonuc["alinan"], ["GV-001"])
        self.assertEqual((sonuc["duran"]["gorev"], sonuc["duran"]["asama"]), ("GV-002", "inceleme"))
        self.assertIn("DOCKER-KAPALI-5521", sonuc["duran"]["neden"])
        self.assertFalse(oturum_basladi(kok, "GV-002", "inceleyici"))


class Gitignore(unittest.TestCase):
    """f) Yerel ayar dosyası depoya girmez."""

    def test_gitignore_yerel_ayari_tasir(self):
        satirlar = (BURASI.parent.parent / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("harness.yerel.json", satirlar)


if __name__ == "__main__":
    unittest.main()
