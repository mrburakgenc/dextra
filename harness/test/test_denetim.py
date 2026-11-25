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
import sys
import time
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
from test_h import BUGUN, KURAL, depo, git, git_depo  # noqa: E402
from test_rapor import cli  # noqa: E402

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


if __name__ == "__main__":
    unittest.main(verbosity=1)
