#!/usr/bin/env python3
"""ozet komutu (GV-170): iki başvuru arasında kabule geçen düğümler ve kapı dosyalarındaki değişiklik.

Koşum: python3 harness/test/test_ozet.py
Her test geçici bir git deposunda taban (main) ve uç (is dalı) commit'i kurar; komut bu deponun h.py'si
ile, alt süreç olarak koşturulur (uçtaki harness/h.py hiç koşmaz).
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
H = pathlib.Path(__file__).resolve().parents[1] / "h.py"


def dugum(kimlik: str, durum: str, surum: int = 1, govde: str = "Her yol tablodan geçer.") -> str:
    tur = {"KU": "kural", "KR": "karar"}[kimlik[:2]]
    return ("---\nkimlik: %s\ntur: %s\ndurum: %s\nsurum: %d\nbaslik: %s başlığı\n---\n%s\n"
            % (kimlik, tur, durum, surum, kimlik, govde))


TABAN = {
    "harness.json": json.dumps({"bicim_surumu": 1, "taban_dal": "main", "korunan_ayar": ["araclar/bicim.toml"]}),
    "harness/h.py": "print('taban')\n",
    "backend/src/a.ts": "export const a = 1\n",
    "kb/kural/KU-001-tablo.md": dugum("KU-001", "kabul"),
}


def git(kok, *arg) -> str:
    return subprocess.run(["git", *arg], cwd=kok, check=True, capture_output=True, text=True).stdout


def yaz(kok: pathlib.Path, dosyalar: dict) -> None:
    for yol, icerik in dosyalar.items():
        p = kok / yol
        if icerik is None:
            p.unlink()
            continue
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(icerik, encoding="utf-8")


def kur(uc: dict, taban: dict | None = None) -> pathlib.Path:
    """main dalında taban commit'i, `is` dalında uç commit'i; HEAD uçtadır. None değer dosyayı siler."""
    kok = pathlib.Path(tempfile.mkdtemp(prefix="harness-ozet-"))
    git(kok, "init", "-q", "-b", "main")
    for ad, deger in (("user.name", "t"), ("user.email", "t@example.invalid"), ("commit.gpgsign", "false")):
        git(kok, "config", ad, deger)
    yaz(kok, {**TABAN, **(taban or {})})
    git(kok, "add", "-A")
    git(kok, "commit", "-q", "-m", "taban")
    git(kok, "checkout", "-q", "-b", "is")
    if uc:
        yaz(kok, uc)
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "uc")
    return kok


def ozet(kok: pathlib.Path, *arg: str) -> tuple:
    r = subprocess.run([sys.executable, str(H), "ozet", *arg], cwd=kok, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr


def bolum(cikti: str, no: int) -> str:
    """Çıktının no'ncu (1'den) `## ` bölümünün gövdesi."""
    return cikti.split("\n## ")[no].split("\n", 1)[1]


class KabuleGecen(unittest.TestCase):
    def test_tabanda_taslak_olan_dugumun_durumu_elle_kabul_yapilinca_birinci_bolumde_gorunur(self):
        kok = kur({"kb/kural/KU-900-yeni.md": dugum("KU-900", "kabul")},
                  taban={"kb/kural/KU-900-yeni.md": dugum("KU-900", "taslak")})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        satir = [s for s in bolum(cikti, 1).split("\n") if "KU-900" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("taslak → kabul", satir[0])
        self.assertIn("kural", satir[0])
        self.assertIn("KU-900 başlığı", satir[0])

    def test_ucta_kabul_durumunda_eklenen_dugum_yeni_olarak_birinci_bolumdedir(self):
        kok = kur({"kb/karar/KR-777-yeni.md": dugum("KR-777", "kabul", surum=3)})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        satir = [s for s in bolum(cikti, 1).split("\n") if "KR-777" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("yeni → kabul", satir[0])
        self.assertIn("3", satir[0])

    def test_ucta_taslak_eklenen_dugum_birinci_bolumde_gecmez(self):
        kok = kur({"kb/kural/KU-901-t.md": dugum("KU-901", "taslak")})
        kod, cikti, _ = ozet(kok)
        self.assertNotIn("KU-901", cikti)


class KabulDugumundeDegisiklik(unittest.TestCase):
    def test_govdesi_degisip_surumu_artmayan_kabul_dugumu_ikinci_bolumde_surum_artmadi_der(self):
        kok = kur({"kb/kural/KU-001-tablo.md": dugum("KU-001", "kabul", govde="Başka bir yükümlülük.")})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        satir = [s for s in bolum(cikti, 2).split("\n") if "KU-001" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("sürüm artmadı", satir[0])
        self.assertNotIn("KU-001", bolum(cikti, 1))

    def test_surumu_artan_kabul_dugumu_ikinci_bolumde_eski_ve_yeni_surumle_gecer(self):
        kok = kur({"kb/kural/KU-001-tablo.md": dugum("KU-001", "kabul", surum=2, govde="Başka.")})
        satir = [s for s in bolum(ozet(kok)[1], 2).split("\n") if "KU-001" in s]
        self.assertIn("1 → 2", satir[0])
        self.assertNotIn("artmadı", satir[0])

    def test_ucta_silinen_kabul_dugumu_ikinci_bolumdedir(self):
        kok = kur({"kb/kural/KU-001-tablo.md": None})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        satir = [s for s in bolum(cikti, 2).split("\n") if "KU-001" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("silindi", satir[0])


class KapiDosyalari(unittest.TestCase):
    def test_kapi_desenleri_ve_tabandaki_korunan_ayar_ucuncu_bolumde_kaynak_kod_hicbir_bolumde_yok(self):
        kok = kur({"harness/h.py": "print('uc')\n",
                   ".claude/settings.json": "{}\n",
                   ".github/workflows/kapi.yml": "on: push\n",
                   "backend/eslint.config.mjs": "export default []\n",
                   "araclar/bicim.toml": "x = 1\n",
                   "backend/src/a.ts": "export const a = 2\n"})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        ucuncu = bolum(cikti, 3)
        for yol, tur in (("harness/h.py", "değişti"), (".claude/settings.json", "eklendi"),
                         (".github/workflows/kapi.yml", "eklendi"), ("backend/eslint.config.mjs", "eklendi"),
                         ("araclar/bicim.toml", "eklendi")):
            satir = [s for s in ucuncu.split("\n") if yol in s]
            self.assertEqual(len(satir), 1, (yol, cikti))
            self.assertIn(tur, satir[0])
        self.assertNotIn("backend/src/a.ts", cikti)

    def test_silinen_kapi_dosyasi_silindi_diye_gecer(self):
        kok = kur({"harness/h.py": None})
        satir = [s for s in bolum(ozet(kok)[1], 3).split("\n") if "harness/h.py" in s]
        self.assertIn("silindi", satir[0])

    def test_uctaki_kod_kirik_ve_korunan_ayar_bosaltilmisken_tabandaki_desen_uygulanir(self):
        kok = kur({"harness/h.py": "def (:\n",
                   "harness.json": json.dumps({"bicim_surumu": 1, "taban_dal": "main", "korunan_ayar": []}),
                   "araclar/bicim.toml": "x = 2\n"})
        kod, cikti, hata = ozet(kok)
        self.assertEqual(kod, 0, hata)
        self.assertIn("araclar/bicim.toml", bolum(cikti, 3))
        self.assertIn("harness.json", bolum(cikti, 3))


class UcunIcerigi(unittest.TestCase):
    def test_calisma_agacindaki_commit_edilmemis_degisiklik_ciktiya_girmez(self):
        kok = kur({"kb/kural/KU-900-yeni.md": dugum("KU-900", "taslak")})
        yaz(kok, {"kb/kural/KU-900-yeni.md": dugum("KU-900", "kabul"),
                  "kb/kural/KU-001-tablo.md": dugum("KU-001", "kabul", govde="Çalışma ağacında."),
                  "harness/h.py": "print('agac')\n"})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        self.assertNotIn("KU-900", cikti)
        self.assertNotIn("KU-001", cikti)
        self.assertNotIn("harness/h.py", cikti)

    def test_calisma_agacindaki_commit_edilmemis_taban_dal_degisikligi_ciktiyi_degistirmez(self):
        kok = kur({"kb/kural/KU-900-yeni.md": dugum("KU-900", "kabul")},
                  taban={"kb/kural/KU-900-yeni.md": dugum("KU-900", "taslak")})
        once = ozet(kok)
        yaz(kok, {"harness.json": json.dumps({"bicim_surumu": 1, "taban_dal": "is", "korunan_ayar": []})})
        kod, cikti, hata = ozet(kok)
        self.assertEqual(kod, 0, hata)
        self.assertEqual(cikti, once[1])
        self.assertIn("taslak → kabul", bolum(cikti, 1))

    def test_calisma_agacindaki_harness_json_bozukken_cikis_sifir_ve_cikti_ayni(self):
        kok = kur({"kb/kural/KU-900-yeni.md": dugum("KU-900", "kabul")},
                  taban={"kb/kural/KU-900-yeni.md": dugum("KU-900", "taslak")})
        once = ozet(kok)
        yaz(kok, {"harness.json": "{bozuk"})
        kod, cikti, hata = ozet(kok)
        self.assertEqual(kod, 0, hata)
        self.assertEqual(cikti, once[1])

    def test_uc_taban_dali_baska_dala_cevirmisken_acik_taban_kullanilir(self):
        kok = kur({"kb/kural/KU-900-yeni.md": dugum("KU-900", "kabul"),
                   "harness.json": json.dumps({"bicim_surumu": 1, "taban_dal": "is", "korunan_ayar": []})},
                  taban={"kb/kural/KU-900-yeni.md": dugum("KU-900", "taslak")})
        kod, cikti, hata = ozet(kok, "--taban", "main")
        self.assertEqual(kod, 0, hata)
        self.assertIn("main → HEAD", cikti)
        self.assertIn("taslak → kabul", bolum(cikti, 1))

    def test_uc_secenegi_verilen_basvurunun_icerigini_kullanir(self):
        kok = kur({"kb/kural/KU-900-yeni.md": dugum("KU-900", "kabul")})
        git(kok, "checkout", "-q", "main")
        kod, cikti, _ = ozet(kok, "--uc", "is")
        self.assertEqual(kod, 0)
        self.assertIn("yeni → kabul", bolum(cikti, 1))
        self.assertIn("yok", ozet(kok)[1])  # HEAD main'de: fark yok


class SinirDurumlari(unittest.TestCase):
    def test_fark_yokken_uc_bolum_de_yok_yazar_ve_cikis_sifirdir(self):
        kok = kur({})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        for no in (1, 2, 3):
            self.assertEqual(bolum(cikti, no).strip(), "yok", cikti)

    def test_var_olmayan_basvuruda_cikis_sifirdan_farklidir_ve_mesaj_adini_soyler(self):
        kok = kur({})
        kod, cikti, hata = ozet(kok, "--taban", "olmayan-dal")
        self.assertNotEqual(kod, 0)
        self.assertIn("olmayan-dal", hata)
        kod, _, hata = ozet(kok, "--uc", "yok-boyle-uc")
        self.assertNotEqual(kod, 0)
        self.assertIn("yok-boyle-uc", hata)

    def test_git_deposu_olmayan_dizinde_cikis_sifirdan_farklidir(self):
        kok = pathlib.Path(tempfile.mkdtemp(prefix="harness-ozet-"))
        yaz(kok, {"harness.json": TABAN["harness.json"]})
        self.assertNotEqual(ozet(kok)[0], 0)

    def test_bas_blogu_bozuk_uc_dugumu_okunamadi_diye_listelenir(self):
        kok = kur({"kb/kural/KU-902-bozuk.md": "kimlik: KU-902\ndurum: kabul\n"})
        kod, cikti, _ = ozet(kok)
        self.assertEqual(kod, 0)
        satir = [s for s in cikti.split("\n") if "KU-902" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("okunamadı", satir[0])

    def test_bas_blogu_bozulan_kabul_dugumu_silindi_sayilmaz_okunamadi_diye_gecer(self):
        kok = kur({"kb/kural/KU-001-tablo.md": "bozuk\n"})
        cikti = ozet(kok)[1]
        satir = [s for s in cikti.split("\n") if "KU-001" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("okunamadı", satir[0])


if __name__ == "__main__":
    unittest.main(verbosity=1)
