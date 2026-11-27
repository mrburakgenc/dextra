#!/usr/bin/env python3
"""GV-173 (EP-014 bütün testi): denetim raporunun bulgularına verilen cevaplar tek bir depoda birlikte sınanır.

Geçici bir git deposunda sırayla:
1) bir dal açılır; taslak bir düğümün `durum:` satırı elle kabul yapılır, harness.json ve
   .github/workflows/kapi.yml değiştirilip commit edilir; `ozet` çıktısı düğümü 1. bölümde "taslak → kabul",
   iki dosyayı 3. bölümde gösterir (GV-170);
2) aynı depoda kanca `git commit -n -m x` ve `git push --no-veri` komutlarını reddeder (GV-168);
3) ortamında GIZLI_BELIRTEC olan üst süreçten sahte claude ile bir görev koşturulur ve incelenir: işçi oturumunun
   ortamında GIZLI_BELIRTEC yoktur; MCP sunucusu (--mcp-config) işçiye verilir, inceleyiciye verilmez (GV-169).

İşçi ve inceleyici oturumu test_gorev.py'nin sahte komutudur; ortam test_ortam.py'nin sarmalayıcısıyla yakalanır.

Koşum: python3 harness/test/test_butun_denetim_raporu.py
"""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import gorev  # noqa: E402
from test_gorev import dolu_kart, gorev_deposu  # noqa: E402
from test_h import git, git_depo  # noqa: E402
from test_hook import TASLAK_KARAR, TASLAK_KURAL, karar, komut  # noqa: E402
from test_ortam import UST_ORTAM, oturum_argv, oturum_ortami, ortam_yazan_oturum  # noqa: E402

H = BURASI.parent / "h.py"
MCP = {"belge": {"command": "belge-sunucusu"}}


def bolum(cikti: str, no: int) -> str:
    """`ozet` çıktısının no'ncu (1'den) `## ` bölümünün gövdesi."""
    return cikti.split("\n## ")[no].split("\n", 1)[1]


class DenetimRaporuBirlikte(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)
        yama = mock.patch.dict(os.environ, UST_ORTAM)   # üst süreçte GIZLI_BELIRTEC var
        yama.start()
        self.addCleanup(yama.stop)

    def test_ozet_kanca_isci_ortami_ve_mcp_ayni_depoda(self):
        kok = gorev_deposu(git_li=False, mcp=MCP)   # mcp_roller ayarda yok: varsayılan geçerli
        taslaklar = {"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL}
        for yol, metin in taslaklar.items():
            (kok / yol).write_text(metin, encoding="utf-8")
        (kok / ".github/workflows").mkdir(parents=True)
        (kok / ".github/workflows/kapi.yml").write_text("on: push\n", encoding="utf-8")
        git_depo(kok)
        ortam_yazan_oturum(kok)

        # 1) Dalda taslak karar (ve ona dayanan taslak kural; sonuçsuz kabul karar görevin zincir denetiminde
        #    sorun olurdu) elle kabul yapılır, iki kapı dosyası değişir; özet ikisini de gösterir.
        git(kok, "checkout", "-q", "-b", "is")
        for yol, metin in taslaklar.items():
            (kok / yol).write_text(metin.replace("durum: taslak", "durum: kabul"), encoding="utf-8")
        ayar = kok / "harness.json"   # yalnız biçim değişir: görev koşusunun ayarı aynı kalır
        ayar.write_text(ayar.read_text(encoding="utf-8").replace('"main"', '"main" ', 1), encoding="utf-8")
        (kok / ".github/workflows/kapi.yml").write_text("on: pull_request\n", encoding="utf-8")
        h.uret(kok)   # kabul kuralın üretilen dosyası güncel olsun
        git(kok, "add", "-A")
        git(kok, "commit", "-qm", "elle kabul ve kapı dosyaları")

        r = subprocess.run([sys.executable, str(H), "ozet"], cwd=kok, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        satir = [s for s in bolum(r.stdout, 1).split("\n") if "KR-002" in s]
        self.assertEqual(len(satir), 1, r.stdout)
        self.assertIn("taslak → kabul", satir[0])
        ucuncu = bolum(r.stdout, 3)
        for yol in ("harness.json", ".github/workflows/kapi.yml"):
            self.assertTrue(any(yol in s and "değişti" in s for s in ucuncu.split("\n")), (yol, r.stdout))

        # 2) Aynı depoda kanca kapıyı atlatan kısa seçeneği ve bayrağın kısaltmasını reddeder.
        for metin in ("git commit -n -m x", "git push --no-veri"):
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)

        # 3) Görev koşar ve incelenir: işçiye gizli değişken geçmez; MCP yalnız işçiye verilir.
        kimlik = dolu_kart(kok)
        self.assertEqual(gorev.kos(kok, kimlik)["durum"], "tamam")
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        self.assertEqual(os.environ["GIZLI_BELIRTEC"], "gizli-41")
        isci_ortami = oturum_ortami(kok, kimlik, "uygulayici")
        self.assertIn("HARNESS_GOREV", isci_ortami)   # ortam gerçekten bu oturumdan yakalandı
        self.assertNotIn("GIZLI_BELIRTEC", isci_ortami)
        self.assertIn("--mcp-config", oturum_argv(kok, kimlik, "uygulayici"))
        self.assertNotIn("--mcp-config", oturum_argv(kok, kimlik, "inceleyici"))


if __name__ == "__main__":
    unittest.main()
