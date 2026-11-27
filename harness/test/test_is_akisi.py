#!/usr/bin/env python3
"""Sunucu tarafı iş akışları (GV-171): .github/workflows/kapi.yml ve ozet.yml metin olarak sınanır.

Koşum: python3 harness/test/test_is_akisi.py
Yalnız standart kitaplık kullanılır (koşucuda YAML ayrıştırıcısı varsayılmaz); dosyalar satır satır okunur.
"""
from __future__ import annotations

import pathlib
import re
import unittest

KOK = pathlib.Path(__file__).resolve().parents[2]
KAPI = (KOK / ".github/workflows/kapi.yml").read_text(encoding="utf-8")
OZET = (KOK / ".github/workflows/ozet.yml").read_text(encoding="utf-8")

EYLEMLER = {
    "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/setup-node": "949feb2413d6458794dcd2491c4babbbce0c15c1",
    "pnpm/action-setup": "73e46992e05b19abd31f2f3c20e0e7370d762115",
    "actions/setup-python": "6d4fd22b20465ccc0f7354476588e8df7c9ca0e0",
}


def yorumsuz(metin: str) -> str:
    """Satır başı yorumları atar: aranan sözcük açıklamada geçebilir, yapılandırmada geçmemeli."""
    return "\n".join(s for s in metin.splitlines() if not s.lstrip().startswith("#"))


def blok(metin: str, anahtar: str) -> str:
    """Kök düzeydeki `anahtar:` bloğunun girintili gövdesi."""
    m = re.search(r"^%s:[^\n]*\n((?:[ \t]+[^\n]*\n|\n)*)" % re.escape(anahtar), metin, re.M)
    if not m:
        raise AssertionError("kök düzeyde %s: yok" % anahtar)
    return m.group(1)


def run_satirlari(metin: str) -> list:
    """`run:` değerleri: tek satırlık olanlar ve `run: |` altındaki girintili gövde."""
    satirlar, girinti = [], None
    for s in metin.splitlines():
        if girinti is not None:
            if not s.strip() or len(s) - len(s.lstrip()) > girinti:
                satirlar.append(s)
                continue
            girinti = None
        m = re.match(r"^(\s*)(?:- )?run:\s*(.*)$", s)
        if m:
            if m.group(2).strip() in ("|", ">", "|-", ">-"):
                girinti = len(m.group(1))
            else:
                satirlar.append(m.group(2))
    return satirlar


class KapiAkisi(unittest.TestCase):
    def test_komutlarin_hepsi_var(self):
        govde = "\n".join(run_satirlari(KAPI))
        for komut in ("python3 harness/h.py denetle --dal", "pnpm -C backend test\n", "pnpm -C backend test:e2e",
                      "pnpm -C frontend test", "docker compose up -d --wait", "harness/test/test_*.py"):
            self.assertIn(komut, govde + "\n", komut)

    def test_test_dosyalari_tek_tek_kosar_ve_kalan_adiyla_yazilir(self):
        govde = "\n".join(run_satirlari(KAPI))
        dongu = re.search(r'for (\w+) in harness/test/test_\*\.py; do', govde)
        self.assertIsNotNone(dongu)
        self.assertIn('python3 "$%s"' % dongu.group(1), govde)
        self.assertRegex(govde, r'echo "Kalan test dosyaları:\$\w+"\n\s*exit 1')

    def test_tetikler_pull_request_ve_main_push(self):
        on = blok(KAPI, "on")
        self.assertRegex(on, r"(?m)^  pull_request:\n    branches: \[main\]$")
        self.assertRegex(on, r"(?m)^  push:\n    branches: \[main\]$")
        self.assertEqual(sorted(re.findall(r"(?m)^  (\w+):", on)), ["pull_request", "push"])

    def test_yasak_sozcukler_gecmez(self):
        metin = yorumsuz(KAPI)
        for yasak in ("pull_request_target", "continue-on-error", "|| true", "write", "secrets."):
            self.assertNotIn(yasak, metin, yasak)

    def test_izin_yalniz_okuma(self):
        self.assertEqual(blok(KAPI, "permissions").strip(), "contents: read")

    def test_dort_is_var(self):
        isler = set(re.findall(r"(?m)^  ([\w-]+):$", blok(KAPI, "jobs")))
        self.assertLessEqual({"zincir", "arac-testleri", "arka-yuz", "on-yuz"}, isler)


class OzetAkisi(unittest.TestCase):
    def test_tetik_pull_request_target(self):
        on = blok(OZET, "on")
        self.assertEqual(re.findall(r"(?m)^  (\w+):", on), ["pull_request_target"])
        self.assertIn("branches: [main]", on)

    def test_izinler(self):
        izinler = sorted(s.strip() for s in blok(OZET, "permissions").splitlines() if s.strip())
        self.assertEqual(izinler, ["contents: read", "pull-requests: write"])

    def test_is_duzeyinde_de_baska_izin_yok(self):
        # Yazma yetkili belirteç: kök dışında (iş düzeyinde) da yalnız bu iki izin verilebilir.
        metin = yorumsuz(OZET)
        self.assertNotIn("write-all", metin)
        satirlar = metin.splitlines()
        for i, s in enumerate(satirlar):
            m = re.match(r"^(\s*)permissions:\s*(.*)$", s)
            if not m:
                continue
            self.assertEqual(m.group(2).strip(), "", s)
            for alt in satirlar[i + 1:]:
                if alt.strip() and len(alt) - len(alt.lstrip()) <= len(m.group(1)):
                    break
                if alt.strip():
                    self.assertIn(alt.strip(), ("contents: read", "pull-requests: write"), alt)

    def test_cekme_adimi_pr_ucunu_cekmez(self):
        metin = yorumsuz(OZET)
        for uc in ("pull_request.head.sha", "pull_request.head.ref", "github.head_ref", "refs/pull/",
                   "merge_commit_sha"):
            for ref in re.findall(r"(?m)^\s*ref:\s*(.*)$", metin):
                self.assertNotIn(uc, ref)
        # Çatalın deposu da çalışma ağacına gelmez.
        for depo in re.findall(r"(?m)^\s*repository:\s*(.*)$", metin):
            self.assertNotIn("head", depo)
        # PR'ın ucu yalnız git nesnesi olarak gelir: çalışma ağacına geçilmez.
        self.assertRegex(metin, r'git fetch --no-tags origin "refs/pull/\$(\w+)/head:refs/remotes/pr/\$\1"')
        for gecis in ("git checkout", "git switch", "git worktree", "git reset", "git merge"):
            self.assertNotIn(gecis, metin)

    def test_pr_metni_kabuga_dogrudan_girmez(self):
        govde = "\n".join(run_satirlari(OZET))
        for ifade in ("${{ github.event.pull_request.title }}", "${{ github.head_ref }}",
                      "${{ github.event.pull_request.head.ref }}"):
            self.assertNotIn(ifade, govde)
        self.assertNotIn("${{", govde)

    def test_ozet_tabandaki_koddan_uretilir(self):
        govde = "\n".join(run_satirlari(OZET))
        self.assertRegex(govde, r'python3 harness/h\.py ozet --taban "origin/\$\w+" --uc "pr/\$\w+"')


class Eylemler(unittest.TestCase):
    def test_her_uses_sabit_ozete_bagli_ve_izinli(self):
        for ad, metin in (("kapi.yml", KAPI), ("ozet.yml", OZET)):
            satirlar = re.findall(r"(?m)^\s*(?:- )?uses:\s*(\S+)", metin)
            self.assertTrue(satirlar, ad)
            for deger in satirlar:
                eylem, _, ozet = deger.partition("@")
                self.assertRegex(ozet, r"^[0-9a-f]{40}$", "%s: %s" % (ad, deger))
                self.assertEqual(EYLEMLER.get(eylem), ozet, "%s: %s" % (ad, deger))


if __name__ == "__main__":
    unittest.main()
