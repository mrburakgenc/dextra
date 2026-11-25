#!/usr/bin/env python3
"""rapor.py testleri: rapor açma, görev tablosu ve push kapısındaki raporsuz görev denetimi (Z19).

Koşum: python3 harness/test/test_rapor.py
Her test geçici bir depo kurar; gerçek bilgi tabanına ve gerçek görev kayıtlarına dokunmaz.
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
HARNESS = BURASI.parent
sys.path.insert(0, str(HARNESS))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import rapor  # noqa: E402
from test_h import BUGUN, depo, git, git_depo  # noqa: E402

DOLU = {"Kısa özet": "- GV-007 ile ödeme sınaması eklendi.",
        "Kullanıcıdan beklenenler": "- Merge onayı bekleniyor."}


def sablonlu_depo(ayar: dict | None = None) -> pathlib.Path:
    kok = depo({"harness/sablon/rapor.md": (HARNESS / "sablon" / "rapor.md").read_text(encoding="utf-8")}, ayar=ayar)
    return kok


def kayit(kok: pathlib.Path, kimlik: str, durum=None, **dosyalar) -> None:
    """Sahte görev kaydı. Değer dict ise JSON yazılır, str ise olduğu gibi (bozuk kayıt için)."""
    d = kok / ".harness" / "gorev" / kimlik
    d.mkdir(parents=True, exist_ok=True)
    for ad, veri in [("durum", durum)] + list(dosyalar.items()):
        if veri is not None:
            (d / (ad.replace("_", "-") + ".json")).write_text(
                veri if isinstance(veri, str) else json.dumps(veri, ensure_ascii=False), encoding="utf-8")


def gorev_durumu(kimlik: str, baslik: str = "İş", **ek) -> dict:
    return {"kimlik": kimlik, "baslik": baslik, "rol": "uygulayici", "durum": "tamam", "plan": None, "adim": None,
            **ek}


def dal_depo(*basliklar: str, ayar: dict | None = None) -> pathlib.Path:
    """Taban dal (main) ve ondan ayrılan `is` dalı; `is` dalında verilen başlıklarla commit'ler."""
    kok = git_depo(sablonlu_depo(ayar))
    git(kok, "checkout", "-q", "-b", "is")
    for i, baslik in enumerate(basliklar):
        (kok / "src" / ("is%d.ts" % i)).write_text("export const y = %d\n" % i, encoding="utf-8")
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", baslik)
    return kok


def bolum_doldur(metin: str, ad: str, icerik: str) -> str:
    satirlar = metin.split("\n")
    i = next(n for n, s in enumerate(satirlar) if s.startswith("## ") and ad in s)
    j = next(n for n in range(i + 1, len(satirlar)) if rapor.YER_TUTUCU.match(satirlar[n]))
    satirlar[j] = icerik
    return "\n".join(satirlar)


def z19(kok: pathlib.Path) -> list:
    return [(b["ad"], b["yer"], b["seviye"]) for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z19"]


def cli(kok: pathlib.Path, *arg: str) -> tuple:
    cikti, eski = io.StringIO(), os.getcwd()
    os.chdir(kok)
    try:
        with contextlib.redirect_stdout(cikti), contextlib.redirect_stderr(cikti):
            kod = h.main(["h.py", *arg])
    finally:
        os.chdir(eski)
    return kod, cikti.getvalue()


class RaporYeni(unittest.TestCase):
    def test_sablondan_acilir_adi_tarih_ve_konudan_gelir(self):
        kok = sablonlu_depo()
        yol = rapor.yeni(kok, "Ödeme işleri", "2026-11-25")
        self.assertEqual(yol, kok / "docs/rapor/2026-11-25-odeme-isleri.md")
        metin = yol.read_text(encoding="utf-8")
        self.assertTrue(metin.startswith("# Ödeme işleri — 2026-11-25\n"))
        for bolum in ("## Denetlemek için", "## 1. Kısa özet", "## 2. Görevler", "## 8. Kullanıcıdan beklenenler",
                      "## 10. Günlük", rapor.BASLA, rapor.BITIR, rapor.TABLO_BASI):
            self.assertIn(bolum, metin)

    def test_ikinci_cagri_uzerine_yazmaz_ve_hata_verir(self):
        kok = sablonlu_depo()
        yol = rapor.yeni(kok, "Ödeme işleri", "2026-11-25")
        yol.write_text(yol.read_text(encoding="utf-8") + "elle yazılan\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata):
            rapor.yeni(kok, "Ödeme işleri", "2026-11-25")
        self.assertTrue(yol.read_text(encoding="utf-8").endswith("elle yazılan\n"))
        kod, cikti = cli(kok, "rapor", "yeni", "Ödeme işleri", "--tarih", "2026-11-25")
        self.assertEqual(kod, 2)
        self.assertIn("zaten var", cikti)

    def test_rapor_dizini_ayardan_gelir(self):
        kok = sablonlu_depo({"rapor": {"dizin": "belge/rapor"}})
        self.assertEqual(rapor.yeni(kok, "X", "2026-11-25"), kok / "belge/rapor/2026-11-25-x.md")

    def test_sablondaki_her_elle_yazilan_bolumde_yer_tutucu_vardir(self):
        metin = (HARNESS / "sablon" / "rapor.md").read_text(encoding="utf-8")
        for bolum in ("Kısa özet", "Kullanıcının verdiği kararlar", "Ajanın verdiği kararlar", "Duruşlar ve nedenleri",
                      "Hatalar", "Araçta değişenler", "Kullanıcıdan beklenenler", "PR'lar", "Günlük"):
            self.assertTrue(rapor._bolum_bos_mu(metin, bolum), bolum)
            self.assertFalse(rapor._bolum_bos_mu(bolum_doldur(metin, bolum, "dolu"), bolum), bolum)


class OtomatikBlok(unittest.TestCase):
    def _depo(self) -> pathlib.Path:
        kok = sablonlu_depo()
        uzun = "Ödeme | iade " + "x" * 100
        kayit(kok, "GV-001", gorev_durumu("GV-001", uzun, plan="EP-001", adim="2.1", alindi=True, inceleme="gecti"),
              rapor={"sure_sn": 90, "degisen": ["a", "b", "c"], "kullanim": {"total_cost_usd": 1.25}},
              inceleme_rapor={"sure_sn": 30, "kullanim": {"total_cost_usd": 0.5},
                              "bulgular": [{"onem": "engel"}, {"onem": "oneri"}, {"onem": "oneri"}]},
              cevaplar={"cevaplar": [{"soru": "a", "cevap": "b"}, {"soru": "c", "cevap": "d"}]})
        kayit(kok, "GV-002", gorev_durumu("GV-002", "Sorunlu iş", durum="sorunlu"),
              rapor={"sure_sn": 120, "degisen": ["x"], "kullanim": {"total_cost_usd": 0.3}})
        kayit(kok, "GV-003", gorev_durumu("GV-003", "Atılan iş", durum="atildi"),
              rapor={"sure_sn": 60, "degisen": [], "kullanim": {"total_cost_usd": 0.2}})
        kayit(kok, "GV-004", "{bozuk", rapor="{bozuk", inceleme_rapor="[1,", cevaplar="bozuk")
        kayit(kok, "GV-005", gorev_durumu("GV-005", "Başka raporda"))
        kayit(kok, "GV-006", gorev_durumu("GV-006", "Bekleyen", durum="taslak"))
        kayit(kok, "GV-008", gorev_durumu("GV-008", "Kalan", inceleme="kaldi"))
        kayit(kok, "GV-009", gorev_durumu("GV-009", "İncelenen", inceleme="gecti"))
        kayit(kok, "GV-010", gorev_durumu("GV-010", "Yarım", durum="soru"))
        eski = kok / "docs/rapor/2026-11-20-eski.md"
        eski.parent.mkdir(parents=True)
        eski.write_text("# Eski\n\nGV-005 burada anlatıldı.\n", encoding="utf-8")
        return kok

    def _satirlar(self, metin: str) -> dict:
        return {s.split(" | ")[0][2:]: [x.strip() for x in s.strip("|").split("|")]
                for s in metin.split("\n") if s.startswith("| GV-")}

    def test_tablo_satirlari_asamalar_ve_hucreler(self):
        kok = self._depo()
        metin = rapor.yeni(kok, "Gece", "2026-11-25").read_text(encoding="utf-8")
        s = self._satirlar(metin)
        self.assertEqual(sorted(s), ["GV-001", "GV-002", "GV-003", "GV-004", "GV-006", "GV-008", "GV-009", "GV-010"])
        baslik = ("Ödeme / iade " + "x" * 100)[:90]
        # GV-123: 'Koşu' kolonu eklendi (Aşama'dan sonra); bu kayıtların koşu geçmişi yok, hücre boştur
        self.assertEqual(s["GV-001"], ["GV-001", "EP-001 2.1", baslik, "alındı", "—", "1.5", "0.5", "1.75", "3",
                                       "1 engel, 2 öneri", "2"])
        self.assertEqual(s["GV-002"], ["GV-002", "—", "Sorunlu iş", "sorunlu", "—", "2.0", "—", "0.30", "1", "—", "0"])
        self.assertEqual(s["GV-003"], ["GV-003", "—", "Atılan iş", "atıldı", "—", "1.0", "—", "0.20", "0", "—", "0"])
        self.assertEqual(s["GV-004"], ["GV-004"] + ["—"] * 10)
        self.assertEqual(s["GV-006"][3], "bekliyor")
        self.assertEqual(s["GV-008"][3], "incelemede kaldı")
        self.assertEqual(s["GV-009"][3], "incelendi")
        self.assertEqual(s["GV-010"][3], "soru")
        self.assertEqual(s["GV-010"][4:], ["—", "—", "—", "—", "—", "—", "0"])
        self.assertIn("Tabloda 8 görev var, 1 tanesi alındı. Koşuların ve incelemelerin toplamı: 5.0 dakika, "
                      "2.25 dolar.", metin)
        self.assertIn("BÜTÜN işçi koşularının ve incelemelerinin toplamıdır", metin)
        self.assertIn("elle yazılmaz", metin)
        blok = metin[metin.index(rapor.BASLA):metin.index(rapor.BITIR)]
        self.assertLess(blok.index("BÜTÜN işçi"), blok.index("Tabloda 8"))
        self.assertLess(blok.index("Tabloda 8"), blok.index("| Görev |"))

    def test_baska_raporda_gecen_gorev_tabloya_girmez(self):
        kok = self._depo()
        metin = rapor.yeni(kok, "Gece", "2026-11-25").read_text(encoding="utf-8")
        self.assertNotIn("GV-005", metin)

    def test_blokta_yazili_kimlik_kalir(self):
        kok = self._depo()
        yol = rapor.yeni(kok, "Gece", "2026-11-25")
        (kok / "docs/rapor/2026-11-26-sonraki.md").write_text("GV-001 ve GV-002 burada da geçiyor.\n",
                                                               encoding="utf-8")
        metin = rapor.uret(kok, yol).read_text(encoding="utf-8")
        self.assertIn("| GV-001 |", metin)
        self.assertIn("| GV-002 |", metin)

    def test_uret_blok_disina_dokunmaz_ve_iki_kez_ayni_ciktiyi_verir(self):
        kok = self._depo()
        yol = kok / "docs/rapor/el.md"
        bas = "# El yazısı\n\nÖnce | GV-005 anılır.\n\n"
        son = "\n\n## Sonra\nGV-0099 ve metin.\n"
        yol.write_text(bas + rapor.BASLA + "\neski içerik GV-010\n" + rapor.BITIR + son, encoding="utf-8")
        rapor.uret(kok, yol)
        bir = yol.read_text(encoding="utf-8")
        self.assertTrue(bir.startswith(bas + rapor.BASLA + "\n"))
        self.assertTrue(bir.endswith("\n" + rapor.BITIR + son))
        self.assertNotIn("eski içerik", bir)
        rapor.uret(kok, yol)
        self.assertEqual(yol.read_text(encoding="utf-8"), bir)

    def test_isaret_yoksa_hata_verir_ve_dosyaya_dokunmaz(self):
        kok = self._depo()
        yol = kok / "docs/rapor/isaretsiz.md"
        yol.write_text("# Rapor\n", encoding="utf-8")
        with self.assertRaises(h.HarnessHata):
            rapor.uret(kok, yol)
        self.assertEqual(yol.read_text(encoding="utf-8"), "# Rapor\n")
        kod, _ = cli(kok, "rapor", "uret", "docs/rapor/isaretsiz.md")
        self.assertEqual(kod, 2)


class Z19RaporsuzGorev(unittest.TestCase):
    def _rapor(self, kok: pathlib.Path, doldur=("Kısa özet", "Kullanıcıdan beklenenler")) -> pathlib.Path:
        kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", alindi=True))
        yol = rapor.yeni(kok, "Ödeme", "2026-11-25")
        metin = yol.read_text(encoding="utf-8")
        for ad in doldur:
            metin = bolum_doldur(metin, ad, DOLU[ad])
        yol.write_text(metin, encoding="utf-8")
        return yol

    def test_raporsuz_gorev_kirmizidir_ve_push_kapisi_1_doner(self):
        kok = dal_depo("GV-007: Ödeme", "Bilgi tabanı: not")
        self.assertEqual(z19(kok), [("raporsuz-gorev", "GV-007", "kirmizi")])
        kod, cikti = cli(kok, "denetle", "--dal")
        self.assertEqual(kod, 1)
        self.assertIn("raporsuz-gorev", cikti)
        self.assertIn("GV-007", cikti)
        self.assertIn("h.py rapor yeni", cikti)

    def test_gorevi_tasiyan_ve_bolumleri_dolu_rapor_varsa_bulgu_yoktur(self):
        kok = dal_depo("GV-007: Ödeme")
        self.assertIn("| GV-007 |", self._rapor(kok).read_text(encoding="utf-8"))
        self.assertEqual(z19(kok), [])
        self.assertEqual(cli(kok, "denetle", "--dal")[0], 0)

    def test_kisa_ozet_yer_tutucuyla_durursa_bos_bolum_bulgusu(self):
        kok = dal_depo("GV-007: Ödeme")
        self._rapor(kok, doldur=("Kullanıcıdan beklenenler",))
        self.assertEqual(z19(kok), [("bos-rapor-bolumu", "docs/rapor/2026-11-25-odeme.md", "kirmizi")])
        self.assertIn("Kısa özet", [b for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z19"][0]["mesaj"])

    def test_kullanicidan_beklenenler_yer_tutucuyla_durursa_bos_bolum_bulgusu(self):
        kok = dal_depo("GV-007: Ödeme")
        self._rapor(kok, doldur=("Kısa özet",))
        bulgular = [b for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z19"]
        self.assertEqual([b["ad"] for b in bulgular], ["bos-rapor-bolumu"])
        self.assertIn("Kullanıcıdan beklenenler", bulgular[0]["mesaj"])

    def test_bu_dalin_gorevini_tasimayan_eski_rapor_sinanmaz(self):
        kok = dal_depo("GV-007: Ödeme")
        self._rapor(kok)
        (kok / "docs/rapor/2026-11-01-eski.md").write_text("# Eski\n\nGV-003 anlatıldı.\n", encoding="utf-8")
        self.assertEqual(z19(kok), [])

    def test_tam_sozcuk_gv_0071_gv_007_yi_tasimaz(self):
        kok = dal_depo("GV-007: Ödeme")
        (kok / "docs/rapor").mkdir(parents=True)
        (kok / "docs/rapor/2026-11-25-x.md").write_text("# X\n\n## 1. Kısa özet\nGV-0071 yapıldı.\n",
                                                        encoding="utf-8")
        self.assertEqual(z19(kok), [("raporsuz-gorev", "GV-007", "kirmizi")])

    def test_bayraksiz_denetle_ve_commit_kapisi_z19_calistirmaz(self):
        kok = dal_depo("GV-007: Ödeme")
        self.assertEqual([b for b in h.denetle(kok, bugun=BUGUN) if b["kod"] == "Z19"], [])
        kod, cikti = cli(kok, "denetle")
        self.assertEqual((kod, cikti.strip()), (0, "denetle: temiz"))
        for ad in ("h.py", "rapor.py", "gorev.py"):   # kapıları gerçek git hook'uyla koştur
            (kok / "harness" / ad).write_text((HARNESS / ad).read_text(encoding="utf-8"), encoding="utf-8")
        ortam = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
        on_commit = subprocess.run(["sh", str(HARNESS / "hook/git/pre-commit")], cwd=kok, capture_output=True,
                                   text=True, env=ortam)
        self.assertEqual(on_commit.returncode, 0, on_commit.stdout + on_commit.stderr)
        on_push = subprocess.run(["sh", str(HARNESS / "hook/git/pre-push")], cwd=kok, capture_output=True,
                                 text=True, env=ortam)
        self.assertEqual(on_push.returncode, 1, on_push.stdout + on_push.stderr)
        self.assertIn("raporsuz-gorev", on_push.stdout)

    def test_rapor_zorunlu_degilse_z19_calismaz(self):
        kok = dal_depo("GV-007: Ödeme", ayar={"rapor": {"zorunlu": False}})
        self.assertEqual(z19(kok), [])
        self.assertEqual(cli(kok, "denetle", "--dal")[0], 0)

    def test_taban_dal_yoksa_olculemedi(self):
        kok = dal_depo("GV-007: Ödeme", ayar={"taban_dal": "yok-boyle-dal"})
        with self.assertRaises(h.HarnessHata) as e:
            rapor.dal_bulgulari(kok, h.ayar_oku(kok))
        self.assertIn("Z19 ölçülemedi", str(e.exception))
        self.assertEqual(cli(kok, "denetle", "--dal")[0], 2)

    def test_rapor_durum_raporsuz_gorevi_listeler_ve_0_doner(self):
        kok = dal_depo("GV-007: Ödeme")
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertEqual(kod, 0)
        self.assertIn("raporsuz-gorev GV-007", cikti)
        self._rapor(kok, doldur=())
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertEqual(kod, 0)
        self.assertNotIn("raporsuz-gorev", cikti)
        self.assertEqual(cikti.count("bos-rapor-bolumu"), 2)


if __name__ == "__main__":
    unittest.main(verbosity=1)
