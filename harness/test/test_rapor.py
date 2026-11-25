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
        # GV-128: 'İncelemenin önerileri' 3. bölüm oldu, sonraki bölümlerin numaraları bir kaydı
        for bolum in ("## Denetlemek için", "## 1. Kısa özet", "## 2. Görevler", "## 3. İncelemenin önerileri",
                      "## 9. Kullanıcıdan beklenenler", "## 11. Günlük", rapor.BASLA, rapor.BITIR, rapor.TABLO_BASI,
                      rapor.ONERI_BASLA, rapor.ONERI_BITIR):
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
        # GV-129 (TS-006 Yapı 15): başka raporda yalnız adı geçen görev raporlanmış sayılmaz; tablosunda kapanmış olmalı
        eski.write_text("# Eski\n\nGV-005 burada anlatıldı.\n\n%s\n| GV-005 | — | Başka raporda | alındı |\n%s\n"
                        % (rapor.BASLA, rapor.BITIR), encoding="utf-8")
        return kok

    def _satirlar(self, metin: str) -> dict:
        return {s.split(" | ")[0][2:]: [x.strip() for x in s.strip("|").split("|")]
                for s in metin.split("\n") if s.startswith("| GV-")}

    def test_tablo_satirlari_asamalar_ve_hucreler(self):
        kok = self._depo()
        metin = rapor.yeni(kok, "Gece", "2026-11-25").read_text(encoding="utf-8")
        s = self._satirlar(metin)
        # GV-129: hiç koşmamış GV-006 ('bekliyor') artık tabloya girmez
        self.assertEqual(sorted(s), ["GV-001", "GV-002", "GV-003", "GV-004", "GV-008", "GV-009", "GV-010"])
        baslik = ("Ödeme / iade " + "x" * 100)[:90]
        # GV-123: 'Koşu' kolonu eklendi (Aşama'dan sonra); bu kayıtların koşu geçmişi yok, hücre boştur
        self.assertEqual(s["GV-001"], ["GV-001", "EP-001 2.1", baslik, "alındı", "—", "1.5", "0.5", "1.75", "3",
                                       "1 engel, 2 öneri", "2"])
        self.assertEqual(s["GV-002"], ["GV-002", "—", "Sorunlu iş", "sorunlu", "—", "2.0", "—", "0.30", "1", "—", "0"])
        self.assertEqual(s["GV-003"], ["GV-003", "—", "Atılan iş", "atıldı", "—", "1.0", "—", "0.20", "0", "—", "0"])
        self.assertEqual(s["GV-004"], ["GV-004"] + ["—"] * 10)
        self.assertEqual(s["GV-008"][3], "incelemede kaldı")
        self.assertEqual(s["GV-009"][3], "incelendi")
        self.assertEqual(s["GV-010"][3], "soru")
        self.assertEqual(s["GV-010"][4:], ["—", "—", "—", "—", "—", "—", "0"])
        self.assertIn("Tabloda 7 görev var, 1 tanesi alındı. Koşuların ve incelemelerin toplamı: 5.0 dakika, "
                      "2.25 dolar.", metin)
        self.assertIn("BÜTÜN işçi koşularının ve incelemelerinin toplamıdır", metin)
        self.assertIn("elle yazılmaz", metin)
        blok = metin[metin.index(rapor.BASLA):metin.index(rapor.BITIR)]
        self.assertLess(blok.index("BÜTÜN işçi"), blok.index("Tabloda 7"))
        self.assertLess(blok.index("Tabloda 7"), blok.index("| Görev |"))

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
        git(kok, "add", "-A")   # GV-127 (TS-006 Yapı 12): kapı raporu dalın ucundaki commit'te arar
        git(kok, "commit", "-q", "-m", "Rapor")
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
        git(kok, "add", "-A")   # GV-127: kapı raporu commit'te arar; eski rapor da commit'te durmalı
        git(kok, "commit", "-q", "-m", "Eski rapor")
        self.assertEqual(z19(kok), [])

    def test_tam_sozcuk_gv_0071_gv_007_yi_tasimaz(self):
        kok = dal_depo("GV-007: Ödeme")
        (kok / "docs/rapor").mkdir(parents=True)
        (kok / "docs/rapor/2026-11-25-x.md").write_text("# X\n\n## 1. Kısa özet\nGV-0071 yapıldı.\n",
                                                        encoding="utf-8")
        git(kok, "add", "-A")   # GV-127: kapı raporu commit'te arar; GV-0071'i taşıyan rapor commit'te durmalı
        git(kok, "commit", "-q", "-m", "Rapor")
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


class IncelemeOnerileri(unittest.TestCase):
    """GV-128 (TS-006 Yapı 13): raporun ikinci otomatik bloğu tablodaki görevlerin inceleme önerilerini listeler."""

    UZUN = "Uzun " + "y" * 300 + ". İkinci cümle."

    def _depo(self) -> pathlib.Path:
        kok = sablonlu_depo()
        kayit(kok, "GV-001", gorev_durumu("GV-001", "Önerili", alindi=True),
              inceleme_rapor={"bulgular": [
                  {"dosya": "harness/a.py", "satir": 12, "onem": "oneri",
                   "aciklama": "Sabit\n  tekrarlanıyor. İkinci cümle burada; listelenmez."},
                  {"dosya": "harness/b.py", "satir": 3, "onem": "engel", "aciklama": "Engel bulgusu. Listelenmez.",
                   "kanit": "x"},
                  {"dosya": "harness/c.py", "satir": 40, "onem": "oneri", "aciklama": self.UZUN}]})
        kayit(kok, "GV-002", gorev_durumu("GV-002", "Önerisiz", alindi=True),
              inceleme_rapor={"bulgular": [{"dosya": "harness/d.py", "satir": 1, "onem": "engel",
                                            "aciklama": "Yalnız engel.", "kanit": "x"}]})
        return kok

    def _blok(self, metin: str) -> list:
        return metin[metin.index(rapor.ONERI_BASLA) + len(rapor.ONERI_BASLA):metin.index(rapor.ONERI_BITIR)] \
            .strip("\n").split("\n")

    def test_a_iki_oneri_iki_satir_engel_listelenmez(self):
        kok = self._depo()
        metin = rapor.yeni(kok, "Öneriler", "2026-11-25").read_text(encoding="utf-8")
        self.assertEqual(self._blok(metin), [
            "- GV-001 · `harness/a.py:12` — Sabit tekrarlanıyor.",
            "- GV-001 · `harness/c.py:40` — " + self.UZUN[:rapor.ONERI_SINIRI]])
        self.assertEqual(len(self.UZUN[:rapor.ONERI_SINIRI]), 200)
        self.assertNotIn("Engel bulgusu", metin)
        self.assertNotIn("harness/d.py", metin)
        self.assertNotIn("İkinci cümle", metin)

    def test_b_onerisi_olmayan_gorevlerle_blok_oneri_yok_der(self):
        kok = sablonlu_depo()
        kayit(kok, "GV-002", gorev_durumu("GV-002", "Önerisiz", alindi=True),
              inceleme_rapor={"bulgular": [{"dosya": "x", "satir": 1, "onem": "engel", "aciklama": "E.", "kanit": "k"}]})
        kayit(kok, "GV-003", gorev_durumu("GV-003", "İncelenmemiş"))
        kayit(kok, "GV-004", "{bozuk", inceleme_rapor="[1,")
        metin = rapor.yeni(kok, "Öneriler", "2026-11-25").read_text(encoding="utf-8")
        self.assertEqual(self._blok(metin), [rapor.ONERI_YOK])
        self.assertEqual(self._blok(rapor.yeni(sablonlu_depo(), "Boş", "2026-11-25").read_text(encoding="utf-8")),
                         [rapor.ONERI_YOK])

    def test_c_uret_iki_blok_disina_dokunmaz_ve_iki_kez_ayni_ciktiyi_verir(self):
        kok = self._depo()
        yol = kok / "docs/rapor/el.md"
        bas, orta, son = "# El\n\nÖnce.\n\n", "\n\n## Öneriler\nelle | yazılan GV-0099\n\n", "\n\n## Sonra\nmetin\n"
        yol.parent.mkdir(parents=True)
        yol.write_text(bas + rapor.BASLA + "\nGV-001\n" + rapor.BITIR + orta + rapor.ONERI_BASLA + "\neski öneri\n"
                       + rapor.ONERI_BITIR + son, encoding="utf-8")
        rapor.uret(kok, yol)
        bir = yol.read_text(encoding="utf-8")
        self.assertTrue(bir.startswith(bas + rapor.BASLA + "\n"))
        self.assertIn("\n" + rapor.BITIR + orta + rapor.ONERI_BASLA + "\n- GV-001 ", bir)
        self.assertTrue(bir.endswith("\n" + rapor.ONERI_BITIR + son))
        self.assertNotIn("eski öneri", bir)
        self.assertEqual(len(self._blok(bir)), 2)
        rapor.uret(kok, yol)
        self.assertEqual(yol.read_text(encoding="utf-8"), bir)

    def test_d_ikinci_blogun_isaretleri_olmayan_eski_raporda_yalniz_tablo_yenilenir(self):
        kok = self._depo()
        yol = kok / "docs/rapor/eski.md"
        bas, son = "# Eski\n\n## 2. Görevler\n\n", "\n\n## 3. Kullanıcının verdiği kararlar\nelle\n"
        yol.parent.mkdir(parents=True)
        yol.write_text(bas + rapor.BASLA + "\nGV-001\n" + rapor.BITIR + son, encoding="utf-8")
        rapor.uret(kok, yol)
        metin = yol.read_text(encoding="utf-8")
        self.assertEqual(metin, bas + rapor.BASLA + "\n" + rapor.tablo(kok, ["GV-001", "GV-002"]) + "\n"
                         + rapor.BITIR + son)
        self.assertNotIn(rapor.ONERI_BASLA, metin)
        self.assertNotIn("harness/a.py", metin)

    def test_e_yeni_sablonda_rapor_denetimi_zorunlu_bolumleri_tanir(self):
        for doldur, bos in [((), ["Kısa özet", "Kullanıcıdan beklenenler"]),
                            (("Kısa özet",), ["Kullanıcıdan beklenenler"]),
                            (("Kullanıcıdan beklenenler",), ["Kısa özet"]),
                            (("Kısa özet", "Kullanıcıdan beklenenler"), [])]:
            kok = dal_depo("GV-007: Ödeme")
            kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", alindi=True),
                  inceleme_rapor={"bulgular": [{"dosya": "a", "satir": 1, "onem": "oneri", "aciklama": "Ö."}]})
            yol = rapor.yeni(kok, "Ödeme", "2026-11-25")
            metin = yol.read_text(encoding="utf-8")
            self.assertIn("## 9. Kullanıcıdan beklenenler", metin)
            self.assertIn("- GV-007 · `a:1` — Ö.", metin)
            for ad in doldur:
                metin = bolum_doldur(metin, ad, DOLU[ad])
            yol.write_text(metin, encoding="utf-8")
            for ad in rapor.ZORUNLU_BOLUMLER:
                self.assertEqual(rapor._bolum_bos_mu(metin, ad), ad in bos, (doldur, ad))
            git(kok, "add", "-A")
            git(kok, "commit", "-q", "-m", "Rapor")
            bulgular = [b for b in h.denetle(kok, bugun=BUGUN, taban=True) if b["kod"] == "Z19"]
            self.assertEqual([b["ad"] for b in bulgular], ["bos-rapor-bolumu"] * len(bos), doldur)
            self.assertEqual([[a for a in rapor.ZORUNLU_BOLUMLER if a in b["mesaj"]] for b in bulgular],
                             [[a] for a in bos])

    def test_f_rapor_durum_son_satiri_oneri_sayisini_yazar(self):
        kok = dal_depo("GV-001: Önerili")
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertEqual(kod, 0)
        self.assertTrue(cikti.rstrip("\n").split("\n")[-1].endswith("; tablolarda 0 inceleme önerisi"), cikti)
        self.assertIn("rapor durum: 1 raporsuz görev, 0 boş bölüm; tablolarda 0 inceleme önerisi", cikti)
        for k, n in (("GV-001", 0), ("GV-002", 2)):
            kayit(kok, k, gorev_durumu(k, "İş", alindi=True), inceleme_rapor={"bulgular": [
                {"dosya": "a", "satir": i, "onem": "oneri", "aciklama": "Ö."} for i in range(n)]
                + [{"dosya": "b", "satir": 1, "onem": "engel", "aciklama": "E.", "kanit": "k"}]})
        yol = rapor.yeni(kok, "Bir", "2026-11-25")
        metin = yol.read_text(encoding="utf-8")
        for ad in rapor.ZORUNLU_BOLUMLER:
            metin = bolum_doldur(metin, ad, DOLU[ad])
        yol.write_text(metin, encoding="utf-8")
        # aynı görev ikinci raporun tablosunda da geçse bir kez sayılır; tablosuz (işaretsiz) rapor sayılmaz
        (kok / "docs/rapor/2026-11-26-iki.md").write_text(
            "%s\n| GV-002 |\n%s\n" % (rapor.BASLA, rapor.BITIR), encoding="utf-8")
        (kok / "docs/rapor/2026-11-01-eski.md").write_text("# Eski\n\nGV-002 anlatıldı.\n", encoding="utf-8")
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "Rapor")
        self.assertEqual(rapor.oneri_sayisi(kok, h.ayar_oku(kok)), 2)
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertEqual(kod, 0)
        self.assertEqual(cikti.rstrip("\n").split("\n")[-1],
                         "rapor durum: bu dalda raporsuz görev ve boş bölümlü rapor yok; tablolarda 2 inceleme önerisi")

    def test_g_onerinin_metninde_adi_gecen_gorev_raporlanmis_sayilmaz(self):
        # GV-001 eski (bu dalın değil); önerisi bu dalda alınan GV-002'yi anar. Rapor yalnız GV-001'i taşır.
        kok = dal_depo("GV-002: İki")
        kayit(kok, "GV-001", gorev_durumu("GV-001", "Bir", alindi=True), inceleme_rapor={"bulgular": [
            {"dosya": "a", "satir": 1, "onem": "oneri", "aciklama": "GV-002 aynı dosyaya dokunuyor. Bak."}]})
        bir = rapor.yeni(kok, "Bir", "2026-11-24")
        self.assertIn("- GV-001 · `a:1` — GV-002 aynı dosyaya dokunuyor.", bir.read_text(encoding="utf-8"))
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "Rapor")
        # Z19: GV-002 raporsuzdur; GV-002'yi yalnız önerisinde anan rapor bu dalın raporu sayılıp sınanmaz
        self.assertEqual([(a, y) for a, y, _ in z19(kok)], [("raporsuz-gorev", "GV-002")])
        # sonraki 'rapor yeni' GV-002'yi tablosuna alır
        kayit(kok, "GV-002", gorev_durumu("GV-002", "İki", alindi=True))
        metin = rapor.yeni(kok, "İki", "2026-11-25").read_text(encoding="utf-8")
        self.assertIn("| GV-002 |", metin)
        self.assertNotIn("| GV-001 |", metin)

    def test_h_isaret_tasiyan_oneri_blogu_bozmaz(self):
        kok = sablonlu_depo()
        isaretler = (rapor.BASLA, rapor.BITIR, rapor.ONERI_BASLA, rapor.ONERI_BITIR)
        kayit(kok, "GV-001", gorev_durumu("GV-001", "Bir", alindi=True), inceleme_rapor={"bulgular": [
            {"dosya": "a" + rapor.ONERI_BASLA, "satir": 1, "onem": "oneri",
             "aciklama": "Bitiş %s başlangıç %s tablo %s %s işaretleri. İkinci." % tuple(reversed(isaretler))}]})
        yol = rapor.yeni(kok, "Bir", "2026-11-25")
        bir = yol.read_text(encoding="utf-8")
        for isaret in isaretler:
            self.assertEqual(bir.count(isaret), 1, isaret)
        satirlar = self._blok(bir)
        self.assertEqual(len(satirlar), 1)
        self.assertTrue(satirlar[0].startswith("- GV-001 · `a"), satirlar)
        self.assertNotIn("<!--", satirlar[0])
        rapor.uret(kok, yol)
        self.assertEqual(yol.read_text(encoding="utf-8"), bir)

    def test_i_taban_dal_olculemezse_rapor_durum_yine_oneri_sayisini_yazar(self):
        kok = dal_depo("GV-007: Ödeme", ayar={"taban_dal": "yok-boyle-dal"})
        kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", alindi=True), inceleme_rapor={"bulgular": [
            {"dosya": "a", "satir": 1, "onem": "oneri", "aciklama": "Ö."}]})
        rapor.yeni(kok, "Ödeme", "2026-11-25")
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertEqual(kod, 0)
        son = cikti.rstrip("\n").split("\n")[-1]
        self.assertTrue(son.startswith("rapor durum: Z19 ölçülemedi"), son)
        self.assertTrue(son.endswith("; tablolarda 1 inceleme önerisi"), son)


class KapanmamisGorev(unittest.TestCase):
    """GV-129 (TS-006 Yapı 15): görev bir raporda ancak tablosundaki satırı 'alındı' ya da 'atıldı' ise kapanmıştır;
    hiç koşmamış görev tabloya girmez."""

    def _asamalar(self, yol: pathlib.Path) -> dict:
        return rapor._tablo_asamalari(yol.read_text(encoding="utf-8"))

    def _eski_tablolu(self, kok: pathlib.Path, kimlikler, tarih="2026-11-24") -> pathlib.Path:
        """Eski aracın yazdığı gibi rapor: tabloda verilen görevlerin bugünkü satırları (koşmamışsa 'bekliyor')."""
        yol = rapor.yeni(kok, "Eski", tarih)
        metin = yol.read_text(encoding="utf-8")
        bas, son = rapor._blok(metin, yol)
        metin = metin[:bas] + "\n" + rapor.tablo(kok, kimlikler) + "\n" + metin[son:]
        for ad in rapor.ZORUNLU_BOLUMLER:
            metin = bolum_doldur(metin, ad, DOLU[ad])
        yol.write_text(metin, encoding="utf-8")
        return yol

    def _commit(self, kok: pathlib.Path) -> None:
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "Rapor")

    def test_a_bekliyor_satiri_alininca_raporsuzdur_uret_alindi_yapar_ve_denetim_gecer(self):
        kok = dal_depo("GV-007: Ödeme")
        kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", durum="taslak"))
        eski = self._eski_tablolu(kok, ["GV-007"])
        self.assertEqual(self._asamalar(eski), {"GV-007": "bekliyor"})
        self._commit(kok)
        kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", alindi=True))
        self.assertEqual(z19(kok), [("raporsuz-gorev", "GV-007", "kirmizi")])
        kod, cikti = cli(kok, "denetle", "--dal")
        self.assertEqual(kod, 1)
        self.assertIn("raporun tablosunu yenile: rapor uret", cikti)
        kod, cikti = cli(kok, "rapor", "durum")   # rapor durum aynı kuralı kullanır
        self.assertEqual(kod, 0)
        self.assertIn("raporsuz-gorev GV-007", cikti)
        rapor.uret(kok, eski)
        self.assertEqual(self._asamalar(eski), {"GV-007": "alındı"})
        self._commit(kok)
        self.assertEqual(z19(kok), [])
        self.assertEqual(cli(kok, "denetle", "--dal")[0], 0)
        self.assertNotIn("raporsuz-gorev", cli(kok, "rapor", "durum")[1])

    def test_b_yeni_rapor_eskide_bekliyor_olani_alir_alindi_olani_almaz(self):
        kok = sablonlu_depo()
        kayit(kok, "GV-001", gorev_durumu("GV-001", "Bir", alindi=True))
        kayit(kok, "GV-002", gorev_durumu("GV-002", "İki", durum="taslak"))
        eski = self._eski_tablolu(kok, ["GV-001", "GV-002"])
        self.assertEqual(self._asamalar(eski), {"GV-001": "alındı", "GV-002": "bekliyor"})
        kayit(kok, "GV-002", gorev_durumu("GV-002", "İki", alindi=True))
        yeni = rapor.yeni(kok, "Yeni", "2026-11-25")
        self.assertEqual(self._asamalar(yeni), {"GV-002": "alındı"})
        # eski raporu yenilemek, yeni raporda kapanmış satırı eskiden çıkarır
        rapor.uret(kok, eski)
        self.assertEqual(self._asamalar(eski), {"GV-001": "alındı"})
        rapor.uret(kok, yeni)
        self.assertEqual(self._asamalar(yeni), {"GV-002": "alındı"})

    def test_b_atilmis_gorev_kapanmistir_baska_rapora_girmez(self):
        kok = sablonlu_depo()
        kayit(kok, "GV-001", gorev_durumu("GV-001", "Bir", durum="atildi", yerine="GV-002"))
        eski = rapor.yeni(kok, "Eski", "2026-11-24")
        self.assertEqual(self._asamalar(eski), {"GV-001": "atıldı"})
        self.assertEqual(self._asamalar(rapor.yeni(kok, "Yeni", "2026-11-25")), {})

    def test_c_hic_kosmamis_gorev_tabloya_girmez_uret_var_olan_satirini_cikarir(self):
        kok = sablonlu_depo()
        kayit(kok, "GV-001", gorev_durumu("GV-001", "Bir", alindi=True))
        kayit(kok, "GV-003", gorev_durumu("GV-003", "Koşmamış", durum="taslak"))
        yeni = rapor.yeni(kok, "Yeni", "2026-11-25")
        self.assertEqual(self._asamalar(yeni), {"GV-001": "alındı"})
        eski = self._eski_tablolu(kok, ["GV-003"], "2026-11-24")
        self.assertEqual(self._asamalar(eski), {"GV-003": "bekliyor"})
        rapor.uret(kok, eski)
        self.assertEqual(self._asamalar(eski), {})
        self.assertNotIn("| GV-003 |", eski.read_text(encoding="utf-8"))

    def test_d_kimligi_yalniz_serbest_metinde_gecen_alinmis_gorev_raporsuzdur(self):
        kok = dal_depo("GV-007: Ödeme")
        yol = rapor.yeni(kok, "Ödeme", "2026-11-25")   # GV-007'nin kaydı henüz yok: tablo boş
        metin = yol.read_text(encoding="utf-8")
        for ad in rapor.ZORUNLU_BOLUMLER:
            metin = bolum_doldur(metin, ad, DOLU[ad])   # kısa özet GV-007'yi anar
        metin += "\n## Duruşlar\n\n| Görev | Plan | Başlık | Aşama |\n|---|---|---|---|\n| GV-007 | — | Ödeme | alındı |\n"
        yol.write_text(metin, encoding="utf-8")
        self._commit(kok)
        kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", alindi=True))
        self.assertIn("GV-007", rapor._onerisiz(yol.read_text(encoding="utf-8")))
        self.assertEqual(z19(kok), [("raporsuz-gorev", "GV-007", "kirmizi")])


if __name__ == "__main__":
    unittest.main(verbosity=1)
