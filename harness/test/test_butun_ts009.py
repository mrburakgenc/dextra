#!/usr/bin/env python3
"""GV-167 (TS-009 Doğrulama): EP-013'ün davranışları tek bir görevin yaşamı boyunca birlikte sınanır.

Geçici bir depoda bir görev kartı açılır, sahte işçiyle koşturulur, sahte inceleyiciyle incelenir ve alınır; yol
boyunca sırayla:
1) kabul edilmiş bir kavram varken kart dört skill adını anar ve Sözlük bloğunu taşır;
2) ön kontrolü kalan ortamda görev koşmaz (oturum başlamaz), ön kontrol geçince koşar;
3) testler alanı olmayan bitiş kaydı geçersizdir, alanla yeniden koşan görev temizdir;
4) inceleme kaydı olcut olmadan, kosulan boşken ya da olcut.karsilandi false iken görev alınamaz; hepsi doluyken alınır;
5) incelenmiş ve alınmayı bekleyen görevin durum çıktısı ölçüt hükmünü ayrı satırda gösterir; alındıktan sonra
   o satır görünmez (GV-160; kartın "alınan görev" sözü ana oturumun cevabıyla böyle okunur);
6) söz defterine yazılmış bir ileti rapor yeni çıktısının 4. bölümünde görünür.

İşçi ve inceleyici oturumu sahte bir komutla verilir (test_gorev.py düzeni); test gerçek görev kayıtlarına ve gerçek
bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_butun_ts009.py
"""
from __future__ import annotations

import contextlib
import io
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
import rapor  # noqa: E402
from test_gorev import dolu_kart, kayit, sorun_adlari  # noqa: E402
from test_h import depo, git_depo  # noqa: E402
from test_ortam import bayrakli_kontrol  # noqa: E402
from test_soz import istem  # noqa: E402
from test_sozluk import KONUSUZ  # noqa: E402

# Sahte oturum. İşçi iptal.ts'i değiştirip bitiş kaydı yazar (BUTUN_TESTSIZ doluysa testler alanı olmadan);
# inceleyici tam bir kayıt yazar, INCELEME_EK alanları üzerine yazar, INCELEME_SIL alanları siler.
# Her oturum rolünü ana deponun görev kaydındaki oturumlar.txt dosyasına ekler.
SAHTE = r'''
import json, os, pathlib, re, sys
kok = pathlib.Path(os.environ["HARNESS_KOK"]); gv = os.environ["HARNESS_GOREV"]
rol = os.environ.get("HARNESS_ROL", "uygulayici")
gd = kok / ".harness/gorev" / gv
with (kok.parents[2] / ".harness/gorev" / gv / "oturumlar.txt").open("a", encoding="utf-8") as f:
    f.write(rol + "\n")
istem = sys.argv[sys.argv.index("-p") + 1]
print(json.dumps({"type": "result", "subtype": "success", "num_turns": 2, "total_cost_usd": 0.1}))
if rol == "inceleyici":
    kayit = {"gorev": gv, "hukum": "gecti", "ozet": "incelendi", "kosulan": ["python3 -c pass"], "bulgular": [],
             "olcut": {"karsilandi": True, "kanit": "BUTUN-OLCUT-KANITI-9161"}, "bakilmayan": [],
             "kurallar": [{"kimlik": k, "hukum": "uyuyor", "kanit": "src/siparis/iptal.ts:1"}
                          for k in re.findall(r"^\[ \] ((?:KU)-\d{3,}@\d+) ", istem, re.M)]}
    kayit.update(json.loads(os.environ.get("INCELEME_EK") or "{}"))
    for ad in json.loads(os.environ.get("INCELEME_SIL") or "[]"):
        del kayit[ad]
    (gd / "inceleme.json").write_text(json.dumps(kayit, ensure_ascii=False), encoding="utf-8")
    sys.exit(0)
(kok / "src/siparis/iptal.ts").write_text("export const x = 2\n", encoding="utf-8")
bitis = {"gorev": gv, "durum": "tamam", "ozet": "yapıldı", "kararlar": [], "reddedilenler": [], "denenmedi": [],
         "testler": [{"dosya": "test/iptal.test.ts", "kirmizi": "FAILED", "yesil": "OK"}],
         "kalan": None, "soru": None,
         "kurallar": [{"kimlik": k, "hukum": "uyuyor", "not": ""}
                      for k in re.findall(r"^(?:\[ \] )?((?:KU)-\d{3,}@\d+) ", istem, re.M)]}
if os.environ.get("BUTUN_TESTSIZ"):
    del bitis["testler"]
(gd / "bitis.json").write_text(json.dumps(bitis, ensure_ascii=False), encoding="utf-8")
'''

ORTAM_ADLARI = ("BUTUN_TESTSIZ", "INCELEME_EK", "INCELEME_SIL")
SKILLER = ("test-yaz", "hata-ayikla", "kod-tasarimi", "on-yuz-tasarimi")
SOZ = "BUTUN-SOZ-5307 iptal nedeni zorunlu olsun"


def cikti(islev, *arg) -> str:
    tampon = io.StringIO()
    with contextlib.redirect_stdout(tampon):
        islev(*arg)
    return tampon.getvalue()


class TekGorevinYasami(unittest.TestCase):
    def setUp(self):
        for ad in ORTAM_ADLARI:
            os.environ.pop(ad, None)

    tearDown = setUp

    def oturumlar(self, kok, kimlik) -> list:
        yol = kayit(kok, kimlik) / "oturumlar.txt"
        return yol.read_text(encoding="utf-8").split() if yol.is_file() else []

    def incele(self, kok, kimlik, ek=None, sil=None) -> dict:
        os.environ["INCELEME_EK"] = json.dumps(ek or {})
        os.environ["INCELEME_SIL"] = json.dumps(sil or [])
        return gorev.incele(kok, kimlik)

    def test_kart_kosum_inceleme_alma_durum_ve_rapor_birlikte(self):
        sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "butun.py"
        sahte.write_text(SAHTE, encoding="utf-8")
        kontrol, bayrak = bayrakli_kontrol()
        ayar = {"gorev": {"komut": [sys.executable, str(sahte)], "model": "sonnet", "max_tur": 5,
                          "zaman_asimi_sn": 20, "izin_modu": "acceptEdits", "on_kontrol": [kontrol],
                          "ortam_izinli": h.VARSAYILAN_AYAR["gorev"]["ortam_izinli"] + list(ORTAM_ADLARI)}}
        sablon = (BURASI.parent / "sablon" / "rapor.md").read_text(encoding="utf-8")
        kok = git_depo(depo(dict(KONUSUZ, **{"harness/sablon/rapor.md": sablon}), ayar=ayar))

        # 1) Kabul edilmiş kavram varken kart dört skill adını anar ve Sözlük bloğunu taşır.
        kimlik = dolu_kart(kok)
        kart = (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")
        for ad in SKILLER:
            self.assertIn("`%s`" % ad, kart)
        self.assertIn("[[KB-SOZLUK]]", kart)
        self.assertIn("- Sipariş: Müşterinin ödediği ve teslim bekleyen alım kaydı.", kart)

        # 2) Ön kontrol kalınca görev koşmaz ve oturum başlamaz; ön kontrol geçince koşar.
        bayrak.write_text("x", encoding="utf-8")
        with self.assertRaisesRegex(h.HarnessHata, "VERITABANI-KAPALI-4410"):
            gorev.kos(kok, kimlik)
        self.assertEqual(gorev.kosu_gecmisi(kayit(kok, kimlik))[-1]["sonuc"], "ortam")
        self.assertEqual(self.oturumlar(kok, kimlik), [])
        bayrak.unlink()

        # 3) Testler alanı olmayan bitiş kaydı geçersizdir; alanla yeniden koşan görev temizdir.
        os.environ["BUTUN_TESTSIZ"] = "1"
        r = gorev.kos(kok, kimlik)
        self.assertEqual(self.oturumlar(kok, kimlik), ["uygulayici"])   # ön kontrol geçti, oturum başladı
        self.assertEqual(r["durum"], "sorunlu")
        self.assertIn("eksik-alan", sorun_adlari(r))
        self.assertTrue(any("testler" in s["mesaj"] for s in r["sorunlar"]), r["sorunlar"])
        with self.assertRaisesRegex(h.HarnessHata, "incelenemez"):
            gorev.incele(kok, kimlik)
        del os.environ["BUTUN_TESTSIZ"]
        r = gorev.kos(kok, kimlik)
        self.assertEqual((r["durum"], r["sorunlar"]), ("tamam", []))

        # 4) Eksik ya da karşılanmamış ölçüt hükmüyle, koşturulmuş komutsuz geçti hükmüyle görev alınamaz.
        for ek, sil, sonuc, neden in (({}, ["olcut"], "sorunlu", "eksik-alan"),
                                      ({"kosulan": []}, [], "sorunlu", "kosulmadi"),
                                      ({"olcut": {"karsilandi": False, "kanit": "test kırmızı"}}, [], "kaldi", None)):
            r = self.incele(kok, kimlik, ek, sil)
            self.assertEqual(r["sonuc"], sonuc, (ek, sil, r["sorunlar"]))
            if neden:
                self.assertIn(neden, sorun_adlari(r))
            with self.assertRaisesRegex(h.HarnessHata, "alınamaz: inceleme"):
                gorev.al(kok, kimlik)
            self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 1\n")
        r = self.incele(kok, kimlik)
        self.assertEqual((r["sonuc"], r["sorunlar"]), ("gecti", []))

        # 5) Alınmayı bekleyen görevin durum çıktısı ölçüt hükmünü görev satırından ayrı bir satırda gösterir.
        satirlar = cikti(gorev.komut, kok, ["durum"]).splitlines()
        self.assertTrue(any(kimlik in s for s in satirlar), satirlar)
        olcut = [s for s in satirlar if "BUTUN-OLCUT-KANITI-9161" in s]
        self.assertEqual(len(olcut), 1, satirlar)
        self.assertIn("karşılandı", olcut[0])
        self.assertNotIn(kimlik, olcut[0])

        gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertEqual(self.oturumlar(kok, kimlik), ["uygulayici"] * 2 + ["inceleyici"] * 4)

        # 5, devamı) Alındıktan sonra ölçüt satırı görünmez.
        satirlar = cikti(gorev.komut, kok, ["durum"]).splitlines()
        self.assertTrue(any(kimlik in s and "alındı" in s for s in satirlar), satirlar)
        self.assertFalse(any("BUTUN-OLCUT-KANITI-9161" in s for s in satirlar), satirlar)

        # 6) Söz defterine yazılan ileti rapor yeni çıktısının 4. bölümünde görünür.
        self.assertIsNone(istem(kok, SOZ))
        metin = rapor.yeni(kok, "Bütün", "2026-11-26").read_text(encoding="utf-8")
        dorduncu = metin.split("## 4. Kullanıcının verdiği kararlar", 1)[1].split("\n## 5.", 1)[0]
        self.assertIn(SOZ, dorduncu)
        self.assertIn("| %s |" % kimlik, metin)


if __name__ == "__main__":
    unittest.main()
