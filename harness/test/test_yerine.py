#!/usr/bin/env python3
"""GV-131 (TS-006 Yapı 17) testleri: atılan yaprağın yerine geçen görev.

a) Atılmış yaprak, yerine geçeni alınmış olunca `plan durum` çıktısında ve epic dosyasında `[x]` ve
   'yerine GV-YENİ alındı' ile görünür; epic ve kapsayıcı task satırlarındaki sayımlar değişmez.
b) Yerine geçeni olmayan atılmış yaprak işaretsizdir.
c) Koşul ihlalleri (eski görev atılmamış, yeni görev alınmamış, ikisi aynı, yeni görev atılmış) ayrı ayrı
   reddedilir ve kayıt değişmez; aynı eski görev için yeniden çağrı kaydı değiştirir.
d) `gorev at --yerine`, yeni görev alınmamışsa atmayı da yapmaz; alınmışsa ikisini yapar.
e) Plan işaretini elle koyma denemesi bugünkü gibi reddedilir ya da `plan durum` ile geri alınır; yerine geçen
   görev de elle yazılamaz (görev kaydı ölçümdür).
f) `gorev durum` satırı ve rapor tablosunun aşama hücresi 'atıldı · yerine GV-YENİ' taşır; o hücredeki kimlik
   yerine geçen görevi o rapora girmiş saymaz.

Her test geçici bir git deposu kurar (test_gorev.py'deki sahte işçi ve inceleyiciyle); gerçek görev kayıtlarına ve
gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_yerine.py
"""
from __future__ import annotations

import contextlib
import io
import os
import pathlib
import sys
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
from test_gorev import agac, durum, kayit  # noqa: E402
from test_hook import duzenle, gerekce, karar  # noqa: E402
from test_plan import alt, bitir, epic_metni, kurulu, satir, space_satiri, yaprak_task  # noqa: E402
import test_rapor  # noqa: E402


def komut(modul, kok, *arg):
    cikti = io.StringIO()
    with contextlib.redirect_stdout(cikti):
        kod = modul.komut(kok, list(arg))
    return kod, cikti.getvalue()


def epic_satiri(cikti):
    return next(s for s in cikti.split("\n") if "EP-001 — " in s)


def kayitlar(kok, *kimlikler):
    """Görevlerin durum kayıtları ve epic dosyası, bayt bayt (değişmediğini sınamak için)."""
    return [(kayit(kok, k) / "durum.json").read_bytes() for k in kimlikler] + [epic_metni(kok)]


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME", "SAHTE_ZAMAN_DIZINI"):
            os.environ.pop(ad, None)

    tearDown = setUp

    def _uc_yaprak(self):
        """Üç yaprak task: 1 (GV-001) yarıda kalıp atılacak, 2 (GV-002) işi yapıp alınacak, 3 (GV-003) bekliyor."""
        kok = kurulu()
        kimlikler = [yaprak_task(kok, baslik=b)[1] for b in ("İptal nedeni ekle", "Neden kodu", "Raporu güncelle")]
        self.assertEqual(kimlikler, ["GV-001", "GV-002", "GV-003"])
        return kok


class YerineGecenIsaretler(Ortam):
    def test_yerine_gecen_alininca_atilan_yaprak_isaretli_sayim_ayni(self):
        kok = self._uc_yaprak()
        gorev.at(kok, "GV-001")
        bitir(kok, "GV-002")
        _, once = komut(plan, kok, "durum", "EP-001")
        gorev.yerine(kok, "GV-001", "GV-002")
        _, sonra = komut(plan, kok, "durum", "EP-001")
        s = satir(kok, 1)
        self.assertTrue(s.startswith("- [x] 1. İptal nedeni ekle — GV-001"), s)
        self.assertTrue(s.endswith("· atıldı · yerine GV-002 alındı"), s)
        self.assertIn("[x] 1. İptal nedeni ekle — GV-001 · atıldı · yerine GV-002 alındı", sonra)
        self.assertEqual(epic_satiri(once), epic_satiri(sonra))
        self.assertIn("1/3 iş alındı · 1 atıldı", epic_satiri(sonra))
        self.assertIn("1/3 iş alındı · 1 atıldı", space_satiri(kok))
        self.assertEqual(durum(kok, "GV-001")["yerine"], "GV-002")
        self.assertEqual(durum(kok, "GV-001")["durum"], "atildi")

    def test_yerine_geceni_olmayan_atilmis_yaprak_isaretsiz(self):
        kok = self._uc_yaprak()
        gorev.at(kok, "GV-001")
        bitir(kok, "GV-002")
        s = satir(kok, 1)
        self.assertTrue(s.startswith("- [ ] 1."), s)
        self.assertTrue(s.endswith("· atıldı"), s)
        _, cikti = komut(plan, kok, "durum", "EP-001")
        self.assertIn("[ ] 1. İptal nedeni ekle — GV-001 · atıldı\n", cikti)

    def test_yerine_gecen_yaprak_onkosulu_karsilar_ve_epici_kapatir(self):
        kok = kurulu()
        _, eski = yaprak_task(kok)
        _, yeni = yaprak_task(kok, baslik="Neden kodu")
        _, son = yaprak_task(kok, baslik="Raporu güncelle", once=[1])
        gorev.at(kok, eski)
        bitir(kok, yeni)
        self.assertEqual(plan.hazir(kok, "EP-001"), [])   # önkoşulu atılmış yaprak: bekler
        gorev.yerine(kok, eski, yeni)
        self.assertEqual([y["gorev"] for y in plan.hazir(kok, "EP-001")], [son])
        bitir(kok, son)
        self.assertTrue(plan.oku(kok, "EP-001")["isaret"])
        self.assertTrue(space_satiri(kok).startswith("- [x] EP-001"))
        self.assertIn("2/3 iş alındı · 1 atıldı", space_satiri(kok))

    def test_kapsayici_taskta_sayim_ayni_isaret_turer(self):
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        _, ilk = alt(kok, 1)
        _, ikinci = alt(kok, 1, baslik="Hata iletileri")
        _, yeni = yaprak_task(kok, baslik="Doğrulamayı başka yoldan yap")
        gorev.at(kok, ilk)
        gorev.at(kok, ikinci)
        bitir(kok, yeni)
        once = satir(kok, 1)
        self.assertTrue(once.startswith("- [ ] 1."), once)
        gorev.yerine(kok, ilk, yeni)
        gorev.yerine(kok, ikinci, yeni)
        sonra = satir(kok, 1)
        self.assertTrue(sonra.startswith("- [x] 1."), sonra)
        self.assertEqual(once[len("- [ ]"):], sonra[len("- [x]"):])   # "0/2 subtask alındı · 2 atıldı" aynı
        self.assertIn("0/2 subtask alındı · 2 atıldı", sonra)
        self.assertTrue(satir(kok, "1.1").startswith("  - [x] 1.1"))
        self.assertIn("atıldı · yerine %s alındı" % yeni, satir(kok, "1.1"))


class Kosullar(Ortam):
    def _hazir(self):
        """GV-001 atılmış, GV-002 alınmış, GV-003 bekliyor."""
        kok = self._uc_yaprak()
        gorev.at(kok, "GV-001")
        bitir(kok, "GV-002")
        return kok

    def _reddedilir(self, kok, eski, yeni, beklenen):
        once = kayitlar(kok, "GV-001", "GV-002", "GV-003")
        with self.assertRaises(h.HarnessHata) as e:
            gorev.yerine(kok, eski, yeni)
        self.assertIn(beklenen, str(e.exception))
        self.assertIn("Hiçbir şey yazılmadı", str(e.exception))
        self.assertEqual(kayitlar(kok, "GV-001", "GV-002", "GV-003"), once)
        kod, cikti = test_rapor.cli(kok, "gorev", "yerine", eski, yeni)
        self.assertNotEqual(kod, 0)
        self.assertIn(beklenen, cikti)
        self.assertEqual(kayitlar(kok, "GV-001", "GV-002", "GV-003"), once)

    def test_eski_gorev_atilmamissa_reddedilir(self):
        kok = self._hazir()
        self._reddedilir(kok, "GV-003", "GV-002", "GV-003 atılmamış (bekliyor)")

    def test_yeni_gorev_alinmamissa_reddedilir(self):
        kok = self._hazir()
        self._reddedilir(kok, "GV-001", "GV-003", "GV-003 alınmamış (bekliyor)")

    def test_ikisi_ayni_gorevse_reddedilir(self):
        kok = self._hazir()
        self._reddedilir(kok, "GV-001", "GV-001", "GV-001 kendi yerine geçemez")

    def test_yeni_gorev_atilmissa_reddedilir(self):
        kok = self._hazir()
        gorev.at(kok, "GV-003")
        self._reddedilir(kok, "GV-001", "GV-003", "GV-003 atılmış")

    def test_yeniden_cagri_kaydi_degistirir(self):
        kok = self._hazir()
        gorev.yerine(kok, "GV-001", "GV-002")
        bitir(kok, "GV-003")
        kod, cikti = test_rapor.cli(kok, "gorev", "yerine", "GV-001", "GV-003")
        self.assertEqual(kod, 0, cikti)
        self.assertIn("GV-001: yerine GV-003 kaydedildi", cikti)
        self.assertEqual(durum(kok, "GV-001")["yerine"], "GV-003")
        self.assertIn("atıldı · yerine GV-003 alındı", satir(kok, 1))


class AtarkenYerine(Ortam):
    def test_alinmamis_yeni_gorevle_atma_da_yapilmaz(self):
        kok = self._uc_yaprak()
        gorev.kos(kok, "GV-001")
        once = kayitlar(kok, "GV-001", "GV-002", "GV-003")
        kod, cikti = test_rapor.cli(kok, "gorev", "at", "GV-001", "--yerine", "GV-002")
        self.assertNotEqual(kod, 0)
        self.assertIn("GV-002 alınmamış", cikti)
        self.assertEqual(kayitlar(kok, "GV-001", "GV-002", "GV-003"), once)
        self.assertTrue(agac(kok, "GV-001").is_dir())   # ağaç ve dal yerinde
        self.assertNotEqual(durum(kok, "GV-001")["durum"], "atildi")

    def test_alinmis_yeni_gorevle_atar_ve_kaydeder(self):
        kok = self._uc_yaprak()
        gorev.kos(kok, "GV-001")
        bitir(kok, "GV-002")
        kod, cikti = test_rapor.cli(kok, "gorev", "at", "GV-001", "--yerine", "GV-002")
        self.assertEqual(kod, 0, cikti)
        self.assertIn("GV-001 atıldı: ağaç ve dal silindi; yerine GV-002 kaydedildi", cikti)
        self.assertFalse(agac(kok, "GV-001").is_dir())
        d = durum(kok, "GV-001")
        self.assertEqual((d["durum"], d["yerine"]), ("atildi", "GV-002"))
        self.assertTrue(satir(kok, 1).startswith("- [x] 1."))
        self.assertIn("atıldı · yerine GV-002 alındı", satir(kok, 1))

    def test_yerinesiz_atma_ciktisi_degismez(self):
        kok = self._uc_yaprak()
        kod, cikti = test_rapor.cli(kok, "gorev", "at", "GV-001")
        self.assertEqual((kod, cikti), (0, "GV-001 atıldı: ağaç ve dal silindi\n"))
        self.assertNotIn("yerine", durum(kok, "GV-001"))


class ElleIsaret(Ortam):
    def _atilmis(self):
        kok = self._uc_yaprak()
        gorev.at(kok, "GV-001")
        bitir(kok, "GV-002")
        return kok

    def test_atilmis_yapraga_elle_isaret_reddedilir(self):
        kok = self._atilmis()
        c = duzenle(kok, ".harness/plan/siparis/EP-001.md", old_string="- [ ] 1.", new_string="- [x] 1.")
        self.assertEqual(karar(c), "deny")
        self.assertIn("işaret", gerekce(c))

    def test_elle_konan_isaret_plan_durumla_geri_alinir(self):
        kok = self._atilmis()
        yol = h.ortak_kok(kok) / ".harness/plan/siparis/EP-001.md"
        yol.write_text(epic_metni(kok).replace("- [ ] 1.", "- [x] 1."), encoding="utf-8")
        komut(plan, kok, "durum", "EP-001")
        self.assertTrue(satir(kok, 1).startswith("- [ ] 1."))

    def test_yerine_gecen_gorev_kayda_elle_yazilamaz(self):
        kok = self._atilmis()
        c = duzenle(kok, ".harness/gorev/GV-001/durum.json", old_string='"durum": "atildi"',
                    new_string='"durum": "atildi", "yerine": "GV-002"')
        self.assertEqual(karar(c), "deny")


class DurumVeRapor(Ortam):
    def test_gorev_durum_satiri_yerine_gecen_gorevi_soyler(self):
        kok = self._uc_yaprak()
        gorev.at(kok, "GV-001")
        bitir(kok, "GV-002")
        gorev.at(kok, "GV-003")
        gorev.yerine(kok, "GV-001", "GV-002")
        _, cikti = komut(gorev, kok, "durum")
        satirlar = {s.split(" ")[0]: s for s in cikti.strip().split("\n")}
        self.assertTrue(satirlar["GV-001"].startswith("GV-001 [atıldı · yerine GV-002] uygulayici — "), satirlar)
        self.assertTrue(satirlar["GV-003"].startswith("GV-003 [atıldı] uygulayici — "), satirlar)

    def test_rapor_tablosu_yerine_gecen_gorevi_soyler(self):
        kok = test_rapor.sablonlu_depo()
        test_rapor.kayit(kok, "GV-001", test_rapor.gorev_durumu("GV-001", "Yarım kalan", durum="atildi",
                                                                yerine="GV-002"))
        test_rapor.kayit(kok, "GV-003", test_rapor.gorev_durumu("GV-003", "Atılan", durum="atildi"))
        ilk = rapor.yeni(kok, "İlk", "2026-11-25")
        hucreler = {s.split(" | ")[0][2:]: [x.strip() for x in s.strip("|").split("|")]
                    for s in ilk.read_text(encoding="utf-8").split("\n") if s.startswith("| GV-")}
        self.assertEqual(hucreler["GV-001"][3], "atıldı · yerine GV-002")
        self.assertEqual(hucreler["GV-003"][3], "atıldı")
        # Hücredeki "yerine GV-002" GV-002'yi ilk rapora girmiş saymaz: GV-002 sonra alınınca yeni rapora girer.
        test_rapor.kayit(kok, "GV-002", test_rapor.gorev_durumu("GV-002", "İşi yapan", alindi=True))
        ikinci = rapor.yeni(kok, "İkinci", "2026-11-26").read_text(encoding="utf-8")
        self.assertIn("| GV-002 |", ikinci)
        self.assertNotIn("| GV-001 |", ikinci)


if __name__ == "__main__":
    unittest.main()
