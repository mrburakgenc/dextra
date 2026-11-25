#!/usr/bin/env python3
"""Denetim düğümlerinin koşması ve push kapısına bağlanması (TS-006 Yapı 2).

Denetim düğümü baş bloğunda isteğe bağlı `komut` taşır; `h.py denetim kos` onu koşturur, `denetim durum` listeler.
Push kapısı (`denetle --dal`) yalnız kabul edilmiş mekanik kurala bağlı, kabul edilmiş ve komutu olan denetimi koşturur.

Koşum: python3 harness/test/test_denetim.py
Her test geçici bir depo kurar; gerçek bilgi tabanına ve gerçek görev kayıtlarına dokunmaz.
"""
from __future__ import annotations

import os
import pathlib
import shutil
import signal
import subprocess
import sys
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
from test_h import BUGUN, KURAL, depo, git, git_depo  # noqa: E402
from test_hook import gerekce, karar, komut as hook_komut  # noqa: E402
from test_rapor import cli  # noqa: E402



def setUpModule():   # testler iç içe koşum değişkeninin ortamda olup olmamasından bağımsız koşar
    os.environ.pop(h.ICICE, None)


MEKANIK = KURAL.replace("denetim_duzey: gozden-gecirme", "denetim_duzey: mekanik\ndenetim_ref: [DN-001]")
KURAL_YOLU = "kb/kural/KU-001-durum-tablodan.md"
DENETIM_YOLU = "kb/denetim/DN-001-tablo.md"


def denetim(komut: str | None = None, durum: str = "kabul", ek: str = "") -> str:
    return ("---\nkimlik: DN-001\ntur: denetim\ndurum: %s\nsurum: 1\nbaslik: Tablo denetimi\n%s%s---\n"
            "Durum tablosu dışında yazılan geçişi yakalar.\n" % (durum, "komut: %s\n" % komut if komut else "", ek))


def denetimli_depo(komut: str | None = None, durum: str = "kabul", kural: str = MEKANIK, ek: str = "",
                   ayar: dict | None = None, dal: bool = False) -> pathlib.Path:
    kok = depo({KURAL_YOLU: kural, DENETIM_YOLU: denetim(komut, durum, ek)}, ayar=ayar)
    if dal:   # push kapısı taban dala göre ölçer: main ve ondan ayrılan `is` dalı
        git_depo(kok)
        git(kok, "checkout", "-q", "-b", "is")
    return kok


def z20(kok: pathlib.Path) -> list:
    return [(b["ad"], b["yer"], b["seviye"]) for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z20"]


class DenetimKos(unittest.TestCase):
    def test_a_true_gecer_cikis_0(self):
        kod, cikti = cli(denetimli_depo("true"), "denetim", "kos", "DN-001")
        self.assertEqual(kod, 0, cikti)
        self.assertIn("geçti  DN-001", cikti)
        self.assertIn("denetim kos: 1 geçti, 0 kaldı", cikti)

    def test_a_false_kalir_cikis_1_ve_ciktisi_yazilir(self):
        kod, cikti = cli(denetimli_depo("echo tabloyu-atlayan-gecis src/siparis/iptal.ts; false"), "denetim", "kos")
        self.assertEqual(kod, 1, cikti)
        self.assertIn("KALDI  DN-001", cikti)
        self.assertIn("çıkış kodu 1", cikti)
        self.assertIn("| tabloyu-atlayan-gecis src/siparis/iptal.ts", cikti)
        self.assertIn("denetim kos: 0 geçti, 1 kaldı", cikti)

    def test_a_elle_cagrida_taslak_denetim_de_kosar(self):
        kok = denetimli_depo("touch iz", durum="taslak")
        self.assertEqual(cli(kok, "denetim", "kos")[0], 0)
        self.assertTrue((kok / "iz").exists())

    def test_a_komut_deponun_kokunde_calisir(self):
        kok = denetimli_depo("test -f harness.json")
        self.assertEqual(cli(kok, "denetim", "kos", "DN-001")[0], 0)

    def test_b_komutsuz_denetim_kosturulamaz_ve_bunu_soyler(self):
        kod, cikti = cli(denetimli_depo(None), "denetim", "kos", "DN-001")
        self.assertEqual(kod, 2, cikti)
        self.assertIn("koşturulamaz  DN-001: komutu yok (yerleşik ya da elle)", cikti)
        kod, cikti = cli(denetimli_depo(None), "denetim", "kos")   # kimliksiz çağrı: söyler ama kırmızı değildir
        self.assertEqual(kod, 0, cikti)
        self.assertIn("koşturulamaz  DN-001", cikti)

    def test_denetim_olmayan_kimlik_olculemedi(self):
        kod, cikti = cli(denetimli_depo("true"), "denetim", "kos", "KU-001")
        self.assertEqual(kod, 2)
        self.assertIn("KU-001 bir denetim düğümü değil", cikti)


class Kapi(unittest.TestCase):
    def test_c_kabul_mekanik_kurala_bagli_kalan_denetim_kirmizidir(self):
        kok = denetimli_depo("touch iz; echo gecis-tablodan-gecmiyor; false", dal=True)
        self.assertEqual(z20(kok), [("denetim-kaldi", "DN-001", "kirmizi")])
        kod, cikti = cli(kok, "denetle", "--dal")
        self.assertEqual(kod, 1, cikti)
        self.assertIn("denetim-kaldi", cikti)
        self.assertIn("DN-001", cikti)
        self.assertIn("gecis-tablodan-gecmiyor", cikti)
        self.assertTrue((kok / "iz").exists())

    def test_c_gecen_denetim_bulgu_uretmez(self):
        kok = denetimli_depo("touch iz", dal=True)
        self.assertEqual(z20(kok), [])
        self.assertEqual(cli(kok, "denetle", "--dal")[0], 0)
        self.assertTrue((kok / "iz").exists())

    def test_c_taslak_denetim_kapida_kosmaz(self):
        kok = denetimli_depo("touch iz; false", durum="taslak", dal=True)
        self.assertEqual(z20(kok), [])
        self.assertEqual(cli(kok, "denetle", "--dal")[0], 0)
        self.assertFalse((kok / "iz").exists())

    def test_c_taslak_kurala_bagli_denetim_kapida_kosmaz(self):
        kok = denetimli_depo("touch iz; false", kural=MEKANIK.replace("durum: kabul", "durum: taslak"), dal=True)
        self.assertEqual(z20(kok), [])
        self.assertFalse((kok / "iz").exists())

    def test_c_mekanik_olmayan_kurala_bagli_denetim_kapida_kosmaz(self):
        kural = KURAL.replace("bakis: 2099-01-01", "bakis: 2099-01-01\ndenetim_ref: [DN-001]")
        kok = denetimli_depo("touch iz; false", kural=kural, dal=True)
        self.assertEqual(z20(kok), [])
        self.assertFalse((kok / "iz").exists())

    def test_d_bayraksiz_denetle_komut_kosturmaz(self):
        kok = denetimli_depo("touch iz; false", dal=True)
        self.assertEqual([b for b in h.denetle(kok, bugun=BUGUN) if b["kod"] == "Z20"], [])
        kod, cikti = cli(kok, "denetle")
        self.assertEqual((kod, cikti.strip()), (0, "denetle: temiz"))
        self.assertFalse((kok / "iz").exists())

    def test_e_sure_siniri_asilirsa_kirmizi_ve_surec_geride_kalmaz(self):
        kok = denetimli_depo("sleep 30 & echo $! > uyku.pid; wait", ayar={"denetim": {"zaman_asimi_sn": 1}}, dal=True)
        bas = time.monotonic()
        bulgular = [b for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z20"]
        self.assertLess(time.monotonic() - bas, 15)
        self.assertEqual([(b["ad"], b["yer"], b["seviye"]) for b in bulgular],
                         [("denetim-olculemedi", "DN-001", "kirmizi")])
        self.assertIn("ölçülemedi", bulgular[0]["mesaj"])
        pid = int((kok / "uyku.pid").read_text().strip())
        for _ in range(50):   # öldürülen süreç sistemce toplanana kadar kısa bekleme
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                break
            time.sleep(0.1)
        else:
            self.fail("süre sınırını aşan komutun süreci (%d) hâlâ yaşıyor" % pid)

    def test_e_sure_siniri_ayarsiz_120_saniyedir(self):
        self.assertEqual(h.ayar_oku(denetimli_depo("true"))["denetim"]["zaman_asimi_sn"], 120)


class Zincir(unittest.TestCase):
    def _bulgular(self, kok: pathlib.Path) -> list:
        return [(b["ad"], b["yer"], b["seviye"]) for b in h.denetle(kok, bugun=BUGUN)
                if b["ad"] in ("komutsuz-denetim", "gecersiz-komut")]

    def test_mekanik_kuralin_denetiminde_komut_yoksa_uyari(self):
        self.assertEqual(self._bulgular(denetimli_depo(None)), [("komutsuz-denetim", "KU-001", "uyari")])

    def test_komut_ya_da_yerlesik_isareti_varsa_uyari_yok(self):
        self.assertEqual(self._bulgular(denetimli_depo("true")), [])
        self.assertEqual(self._bulgular(denetimli_depo(None, ek="cesit: yerlesik\n")), [])

    def test_komut_metin_degilse_bulgu(self):
        for komut in ("[make, test]", "42", '""'):
            with self.subTest(komut=komut):
                self.assertIn(("gecersiz-komut", "DN-001", "kirmizi"), self._bulgular(denetimli_depo(komut)))


class Durum(unittest.TestCase):
    def test_f_kimlik_bagli_kural_ve_komut_durumu_listelenir(self):
        kod, cikti = cli(denetimli_depo("make denetim"), "denetim", "durum")
        self.assertEqual(kod, 0)
        self.assertIn("DN-001 [kabul] Tablo denetimi", cikti)
        self.assertIn("kural: KU-001 (kabul, mekanik)", cikti)
        self.assertIn("komut: `make denetim`", cikti)
        self.assertIn("denetim durum: 1 denetim, 1 komutlu, 1 push kapısında koşar", cikti)
        _, cikti = cli(denetimli_depo(None), "denetim", "durum")
        self.assertIn("komut: yok — yerleşik ya da elle", cikti)
        _, cikti = cli(denetimli_depo(None, ek="cesit: yerlesik\n"), "denetim", "durum")
        self.assertIn("komut: yok — yerleşik", cikti)


# ── Denetim koşumunun sertleştirilmesi (TS-006 Yapı 16) ──────────────────────────────

H_PY = BURASI.parent / "h.py"


def harnessli_depo(komut: str, ayar: dict | None = None) -> pathlib.Path:
    """Aracın kendisi `harness/` altında duran denetimli depo: komut `python3 harness/h.py ...` diyebilsin."""
    kok = denetimli_depo(komut, ayar=ayar)
    (kok / "harness").mkdir()
    for f in BURASI.parent.glob("*.py"):
        shutil.copy(f, kok / "harness" / f.name)
    git_depo(kok)
    git(kok, "checkout", "-q", "-b", "is")
    return kok


def bekle(kosul, sn: float = 10) -> bool:
    son = time.monotonic() + sn
    while time.monotonic() < son:
        if kosul():
            return True
        time.sleep(0.05)
    return False


def yasiyor(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


class NormatifKomut(unittest.TestCase):
    def _z12(self, kok: pathlib.Path) -> list:
        return [(b["ad"], b["yer"]) for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z12"]

    def test_a_kabul_denetimin_komutu_surum_artmadan_degisirse_bulgu(self):
        kok = denetimli_depo("true", dal=True)
        (kok / DENETIM_YOLU).write_text(denetim("echo degisti"), encoding="utf-8")
        self.assertEqual(self._z12(kok), [("surumsuz-degisiklik", "DN-001")])

    def test_a_surum_artinca_bulgu_yok(self):
        kok = denetimli_depo("true", dal=True)
        (kok / DENETIM_YOLU).write_text(denetim("echo degisti").replace("surum: 1", "surum: 2"), encoding="utf-8")
        self.assertEqual(self._z12(kok), [])


class AjanKancasi(unittest.TestCase):
    def test_b_kanca_komut_kosturmaz_git_kapisi_kosturur(self):
        kok = denetimli_depo("touch iz; false", dal=True)
        self.assertIsNone(hook_komut(kok, "git push origin is"))
        self.assertFalse((kok / "iz").exists())
        kod, cikti = cli(kok, "denetle", "--dal")
        self.assertEqual(kod, 1, cikti)
        self.assertIn("denetim-kaldi", cikti)
        self.assertTrue((kok / "iz").exists())

    def test_b_kancanin_obur_bulgulari_aynidir(self):
        kok = denetimli_depo("touch iz; false", dal=True)
        (kok / KURAL_YOLU).write_text(MEKANIK.replace("dayanak: [KR-001@1]\n", ""), encoding="utf-8")
        c = hook_komut(kok, "git push origin is")
        self.assertEqual(karar(c), "deny")
        self.assertIn("dayanaksiz", gerekce(c))
        self.assertNotIn("denetim-kaldi", gerekce(c))
        self.assertFalse((kok / "iz").exists())

    def test_b_kanca_kucuk_harfli_kanca_yolu_ayarini_reddeder(self):
        kok = denetimli_depo("true", dal=True)
        for metin in ("git -c core.hookspath=/dev/null push origin is", "git -c CORE.HOOKSPATH=x push origin is",
                      "git push --NO-VERIFY origin is", "git -c Include.Path=x push origin is"):
            with self.subTest(metin=metin):
                c = hook_komut(kok, metin)
                self.assertEqual(karar(c), "deny")
                self.assertIn("hook yolunu değiştiren", gerekce(c))


class IcIceKosum(unittest.TestCase):
    def _kapi(self, kok: pathlib.Path, *arg: str) -> subprocess.CompletedProcess:
        """Kapı ayrı süreçte koşar: denetimin komutu aracı yeniden çağırır."""
        return subprocess.run([sys.executable, "harness/h.py", *arg], cwd=kok, capture_output=True, text=True,
                              timeout=120)

    def _push_kapisi(self, kok: pathlib.Path, ortam: dict) -> subprocess.CompletedProcess:
        return subprocess.run(["sh", str(BURASI.parent / "hook/git/pre-push")], cwd=kok, capture_output=True,
                              text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1", **ortam), timeout=120)

    def test_c_araci_cagiran_denetim_tek_katman_kosar(self):
        for arg in (("denetle", "--dal"), ("denetim", "kos", "DN-001")):
            with self.subTest(arg=arg):
                kok = harnessli_depo("echo katman >> iz; python3 harness/h.py " + " ".join(arg),
                                     ayar={"denetim": {"zaman_asimi_sn": 60}})
                bas = time.monotonic()
                r = self._kapi(kok, *arg)
                self.assertLess(time.monotonic() - bas, 60)
                self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
                self.assertNotIn("denetim-olculemedi", r.stdout)
                self.assertNotIn("sure-asimi", r.stdout)
                self.assertEqual((kok / "iz").read_text().splitlines(), ["katman"])

    def test_c_degisken_varken_dogrudan_cagri_komut_kosturmaz_ve_tek_satirla_soyler(self):
        kok = denetimli_depo("touch iz; false", dal=True)
        with mock.patch.dict(os.environ, {h.ICICE: "DN-009"}):
            for arg in (("denetle", "--dal"), ("denetim", "kos", "DN-001")):
                with self.subTest(arg=arg):
                    kod, cikti = cli(kok, *arg)
                    self.assertEqual(kod, 0, cikti)
                    self.assertEqual(cikti.count("DN-009 denetiminin komutunun içinden çağrıldı"), 1, cikti)
        self.assertFalse((kok / "iz").exists())

    def test_c_elle_verilen_degisken_push_kapisini_kapatmaz(self):
        kok = harnessli_depo("touch iz; false")
        r = self._push_kapisi(kok, {h.ICICE: "DN-009"})
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("denetim-kaldi", r.stdout)
        self.assertNotIn("koşturulmadı", r.stdout)
        self.assertTrue((kok / "iz").exists())

    def test_c_taslak_denetimin_komutu_gonderme_ise_kapi_yine_komutlari_kosturur(self):
        kok = harnessli_depo("touch iz; false")
        uzak = kok.parent / (kok.name + "-uzak.git")
        git(kok.parent, "init", "-q", "--bare", str(uzak))
        git(kok, "remote", "add", "origin", str(uzak))
        git(kok, "config", "core.hooksPath", str(BURASI.parent / "hook/git"))
        (kok / "kb/denetim/DN-002-gonder.md").write_text(
            denetim("git push -q origin is", durum="taslak").replace("DN-001", "DN-002"), encoding="utf-8")
        kod, cikti = cli(kok, "denetim", "kos", "DN-002")
        self.assertEqual(kod, 1, cikti)
        self.assertIn("KALDI  DN-002", cikti)
        self.assertTrue((kok / "iz").exists(), cikti)   # push kapısı kabul edilmiş DN-001'i koşturdu
        self.assertEqual(git(uzak, "branch", "--list", "is"), "")   # gönderme geçmedi


class GerideSurec(unittest.TestCase):
    def test_d_kapi_sonlandirilinca_komutun_sureci_de_biter(self):
        kok = denetimli_depo("sleep 30 & echo $! > uyku.pid; wait", dal=True)
        ortam = {k: v for k, v in os.environ.items() if k != h.ICICE}
        kapi = subprocess.Popen([sys.executable, str(H_PY), "denetle", "--dal"], cwd=kok, env=ortam,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            self.assertTrue(bekle(lambda: (kok / "uyku.pid").is_file() and (kok / "uyku.pid").read_text().strip()))
            pid = int((kok / "uyku.pid").read_text().strip())
            self.assertTrue(yasiyor(pid))
            kapi.send_signal(signal.SIGTERM)
            self.assertNotEqual(kapi.wait(timeout=10), 0)
        finally:
            kapi.kill()
        self.assertTrue(bekle(lambda: not yasiyor(pid)), "kapı sonlandırıldı ama komutun süreci (%d) yaşıyor" % pid)


class GecersizKomut(unittest.TestCase):
    def _gecersiz(self, kok: pathlib.Path) -> list:
        return [b for b in h.denetle(kok, bugun=BUGUN) if b["ad"] == "gecersiz-komut"]

    def test_e_koseli_parantezli_komut_tirnak_ister(self):
        bulgular = self._gecersiz(denetimli_depo("[ -f harness.json ]"))
        self.assertEqual([(b["yer"], b["seviye"]) for b in bulgular], [("DN-001", "kirmizi")])
        self.assertIn("tırnak", bulgular[0]["mesaj"])

    def test_e_tirnak_icindeki_komut_calisir_ve_gecer(self):
        for komut in ('"[ -f harness.json ]"', "'[ -f harness.json ]'"):
            with self.subTest(komut=komut):
                kok = denetimli_depo(komut, dal=True)
                self.assertEqual(self._gecersiz(kok), [])
                kod, cikti = cli(kok, "denetim", "kos", "DN-001")
                self.assertEqual(kod, 0, cikti)
                self.assertIn("geçti  DN-001", cikti)
                self.assertEqual(z20(kok), [])
        kok = denetimli_depo('"[ -f yok.json ]"')   # tırnak açılınca koşan gerçekten sınamadır
        self.assertEqual(cli(kok, "denetim", "kos", "DN-001")[0], 1)

    def test_e_denetim_kos_gecersiz_komutu_ayirir_ve_1_ile_cikar(self):
        for kimlik in (["DN-001"], []):
            with self.subTest(kimlik=kimlik):
                kod, cikti = cli(denetimli_depo("[ -f harness.json ]"), "denetim", "kos", *kimlik)
                self.assertEqual(kod, 1, cikti)
                self.assertIn("GEÇERSİZ  DN-001: komutu geçersiz", cikti)
                self.assertIn("tırnak", cikti)
                self.assertNotIn("komutu yok", cikti)
                self.assertIn("denetim kos: 0 geçti, 0 kaldı, 1 geçersiz", cikti)

    def test_e_taslak_denetimde_de_gecersiz_komut_bulgusu(self):
        for komut in ("[ -f harness.json ]", '""'):
            with self.subTest(komut=komut):
                self.assertEqual([b["yer"] for b in self._gecersiz(denetimli_depo(komut, durum="taslak"))],
                                 ["DN-001"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
