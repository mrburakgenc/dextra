#!/usr/bin/env python3
"""GV-125 (TS-006 Yapı 10) testleri: almanın sağlamlığı.

a) Yarıda kalan alma (çakışma ya da başka bir hata) oturum dalını, görev ağacını, görev dalını ve görevin imzasını
   alma öncesine döndürür; çakışan dosyalar bildirilir.
b) Çakışma giderildikten sonra görev yeniden koşturulmadan alınır.
c) Aynı anda başlayan iki alma sıraya girer; ikisi de biter.
d) Kilidi tutan süreç ölürse sonraki alma takılmaz; süre sınırı aşılırsa alma anlaşılır bir iletiyle durur.
e) Başarılı almanın davranışı (plan işareti, ağacın ve dalın silinmesi, çıktı satırı) değişmez.

İşçi ve inceleyici oturumu test_gorev.py'deki sahte komutla verilir; her test geçici bir git deposu kurar,
gerçek görev kayıtlarına ve gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_alma.py
"""
from __future__ import annotations

import contextlib
import io
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import gorev  # noqa: E402
import plan  # noqa: E402
from test_gorev import agac, dolu_kart, durum, gorev_deposu, kayit  # noqa: E402
from test_h import git  # noqa: E402

# Alma kilidini başka bir süreçte tutar; tuttuğunu bir satırla bildirir ve öldürülene kadar bekler.
KILIT_TUTAN = r'''
import fcntl, sys, time
f = open(sys.argv[1], "a")
fcntl.flock(f, fcntl.LOCK_EX)
print("tutuyor", flush=True)
time.sleep(120)
'''

# Almayı oturum dalına birleştirme anında süreci öldürür gibi keser: os._exit, except ve finally blokları koşmaz.
OLDUREN = r'''
import os, pathlib, subprocess, sys
sys.path.insert(0, sys.argv[1])
import gorev
gercek = subprocess.run
def olduren(komut, *a, **kw):
    if list(komut[:3]) == ["git", "merge", "--no-ff"]:
        os._exit(9)
    return gercek(komut, *a, **kw)
gorev.subprocess.run = olduren
gorev.al(pathlib.Path(sys.argv[2]), sys.argv[3])
'''


def kilit_yolu(kok):
    return h.ortak_kok(kok) / ".harness" / "alma.kilit"


def hal(kok, kimlik):
    """Almanın değiştirebileceği her şey: oturum dalının ucu ve ağacının durumu, görev dalının ucu, görev ağacının
    durumu ve dosyaları (izlenmeyenler dahil), görevin hesaplanan ve kayıtlı imzası."""
    a = agac(kok, kimlik)
    dosyalar = {}
    for p in sorted(a.rglob("*")):
        goreli = p.relative_to(a).as_posix()
        if p.is_file() and not goreli.startswith((".git", ".harness/")):
            dosyalar[goreli] = p.read_bytes()
    d = durum(kok, kimlik)
    return {"oturum_ucu": git(kok, "rev-parse", "HEAD"),
            "oturum_durumu": git(kok, "status", "--porcelain", "--untracked-files=all"),
            "gorev_ucu": git(kok, "rev-parse", "refs/heads/gorev/" + kimlik),
            "gorev_durumu": git(a, "status", "--porcelain", "--untracked-files=all"),
            "gorev_dosyalari": dosyalar,
            "imza": gorev._imza(a, d["taban"]),
            "kayitli_imza": (d.get("kosum_imza"), d.get("incelenen_imza"))}


def birlestirme_suruyor(kok):
    return subprocess.run(["git", "rev-parse", "-q", "--verify", "MERGE_HEAD"], cwd=kok,
                          capture_output=True).returncode == 0


def oturum_commit(kok, yol, icerik):
    """Oturum dalına commit ekler; icerik None ise dosyayı siler."""
    p = kok / yol
    if icerik is None:
        git(kok, "rm", "-q", yol)
    else:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(icerik, encoding="utf-8")
        git(kok, "add", "-A")
    git(kok, "commit", "-q", "-m", "oturum: " + yol)


def isci_kosulari(kok, kimlik):
    return [s for s in gorev.kosu_gecmisi(kayit(kok, kimlik)) if s["tip"] == "isci"]


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)

    tearDown = setUp

    def hazir(self, kok=None, yeni_dosya=True, **kw):
        """Koşmuş ve incelenmiş bir görev. yeni_dosya: işçi yeni (izlenmeyen) bir dosya yazar
        (src/gv-NNN/a.ts); değilse var olan src/siparis/iptal.ts dosyasını değiştirir."""
        kok = kok or gorev_deposu(**kw)
        os.environ["SAHTE_MOD"] = "ayri" if yeni_dosya else "tamam"
        sira = len(list((h.ortak_kok(kok) / ".harness/gorev").glob("GV-*"))) + 1
        kimlik = dolu_kart(kok, yollar=["src/gv-%03d/**" % sira] if yeni_dosya else ["src/siparis/**"])
        gorev.kos(kok, kimlik)
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        return kok, kimlik


class Cakisma(Ortam):
    """a) Yarıda kalan alma hiçbir şeyi değiştirmez."""

    def test_yeni_dosyada_cakisma_her_seyi_alma_oncesinde_birakir(self):
        kok, kimlik = self.hazir()
        oturum_commit(kok, "src/gv-001/a.ts", "export const x = 9\n")
        once = hal(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, r"çakış.*src/gv-001/a\.ts"):
            gorev.al(kok, kimlik)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertFalse(birlestirme_suruyor(kok))
        self.assertFalse(durum(kok, kimlik).get("alindi"))

    def test_izlenen_dosyada_cakisma_her_seyi_alma_oncesinde_birakir(self):
        kok, kimlik = self.hazir(yeni_dosya=False)
        oturum_commit(kok, "src/siparis/iptal.ts", "export const x = 9\n")
        once = hal(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, r"çakış.*src/siparis/iptal\.ts"):
            gorev.al(kok, kimlik)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertFalse(birlestirme_suruyor(kok))

    def test_cakismasiz_baska_bir_hata_da_her_seyi_alma_oncesinde_birakir(self):
        kok, kimlik = self.hazir(yeni_dosya=False)
        (kok / "src/siparis/iptal.ts").write_text("export const x = 7\n", encoding="utf-8")   # commit'siz: git reddeder
        once = hal(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, "alınamadı"):
            gorev.al(kok, kimlik)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), "export const x = 7\n")

    def test_komut_satiri_cakisan_dosyayi_bildirir_ve_sifirdan_farkli_kodla_cikar(self):
        kok, kimlik = self.hazir()
        oturum_commit(kok, "src/gv-001/a.ts", "export const x = 9\n")
        eski, hata = os.getcwd(), io.StringIO()
        try:
            os.chdir(kok)
            with contextlib.redirect_stderr(hata), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(h.main(["h.py", "gorev", "al", kimlik]), 2)
        finally:
            os.chdir(eski)
        self.assertIn("src/gv-001/a.ts", hata.getvalue())

    def test_oturum_agacinda_suren_birlestirme_varsa_hicbir_seye_dokunmadan_durur(self):
        kok, kimlik = self.hazir()
        dal = git(kok, "rev-parse", "--abbrev-ref", "HEAD").strip()
        git(kok, "checkout", "-q", "-b", "yan")
        oturum_commit(kok, "src/siparis/iptal.ts", "export const yan = 1\n")
        git(kok, "checkout", "-q", dal)
        oturum_commit(kok, "src/siparis/iptal.ts", "export const ana = 1\n")
        self.assertNotEqual(subprocess.run(["git", "merge", "-q", "yan"], cwd=kok, capture_output=True).returncode, 0)
        cozulen = "export const ana = 1\nexport const yan = 1\n"   # kullanıcının elle çözdüğü, henüz eklenmemiş içerik
        (kok / "src/siparis/iptal.ts").write_text(cozulen, encoding="utf-8")
        once, birlesen = hal(kok, kimlik), git(kok, "rev-parse", "MERGE_HEAD")
        with self.assertRaisesRegex(h.HarnessHata, r"%s alınamadı: .*süren bir birleştirme" % kimlik):
            gorev.al(kok, kimlik)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertEqual(git(kok, "rev-parse", "MERGE_HEAD"), birlesen)
        self.assertEqual((kok / "src/siparis/iptal.ts").read_text(encoding="utf-8"), cozulen)
        self.assertFalse(durum(kok, kimlik).get("alindi"))

    def test_yarim_birlestirme_geri_alinamazsa_ileti_geri_alindi_demez(self):
        kok, kimlik = self.hazir()
        oturum_commit(kok, "src/gv-001/a.ts", "export const x = 9\n")
        once = hal(kok, kimlik)
        gercek = subprocess.run

        def abort_basarisiz(komut, *a, **kw):   # örneğin bir editörün git süreci index.lock tutuyor
            if list(komut[:3]) == ["git", "merge", "--abort"]:
                return subprocess.CompletedProcess(komut, 128, "", "fatal: Unable to create 'index.lock': File exists")
            return gercek(komut, *a, **kw)

        with mock.patch.object(gorev.subprocess, "run", abort_basarisiz), \
                self.assertRaises(h.HarnessHata) as hata:
            gorev.al(kok, kimlik)
        ileti = str(hata.exception)
        self.assertNotIn("geri alındı", ileti)
        self.assertRegex(ileti, r"geri ALINAMADI.*index\.lock.*git merge --abort")
        self.assertIn("src/gv-001/a.ts", ileti)
        self.assertTrue(birlestirme_suruyor(kok))   # ileti durumu olduğu gibi söyler
        sonra = hal(kok, kimlik)
        for ad in ("oturum_ucu", "gorev_ucu", "gorev_durumu", "gorev_dosyalari", "imza", "kayitli_imza"):
            self.assertEqual(sonra[ad], once[ad], ad)
        git(kok, "merge", "--abort")
        self.assertEqual(hal(kok, kimlik), once)

    def _kapi(self, kok, govde):
        """Depoya commit kapısı (pre-commit) bağlar; kapı, koştuğu klasörü iz dosyasına yazar."""
        klasor = pathlib.Path(tempfile.mkdtemp(prefix="harness-kapi-"))
        iz = klasor / "iz"
        (klasor / "pre-commit").write_text('#!/bin/sh\npwd > "%s"\n%s\n' % (iz, govde), encoding="utf-8")
        (klasor / "pre-commit").chmod(0o755)
        git(kok, "config", "core.hooksPath", str(klasor))
        return iz

    def test_commit_kapisi_kirmiziysa_alma_hicbir_seyi_degistirmeden_durur(self):
        kok, kimlik = self.hazir()
        iz = self._kapi(kok, "echo 'zincir kırmızı'; exit 1")
        once = hal(kok, kimlik)
        with self.assertRaisesRegex(h.HarnessHata, r"%s alınamadı: commit kapısı.*zincir kırmızı" % kimlik):
            gorev.al(kok, kimlik)
        self.assertTrue(iz.is_file())
        self.assertEqual(hal(kok, kimlik), once)
        self.assertFalse(durum(kok, kimlik).get("alindi"))

    def test_commit_kapisi_gorev_agacinda_kosar(self):
        kok, kimlik = self.hazir()
        iz = self._kapi(kok, "exit 0")
        a = agac(kok, kimlik).resolve()
        gorev.al(kok, kimlik)
        self.assertEqual(pathlib.Path(iz.read_text(encoding="utf-8").strip()).resolve(), a)
        self.assertTrue(durum(kok, kimlik)["alindi"])


class Kesilme(Ortam):
    """a) Alma kesilirse (Ctrl-C) de oturum dalı ve görev ağacı alma öncesine döner."""

    def _kesilen_al(self, kok, kimlik, birlestirdikten_sonra):
        """Almayı oturum dalına birleştirme anında KeyboardInterrupt ile keser; birlestirdikten_sonra ise git'in
        birleştirmesi koşar (çakışmada yarım birleştirme bırakır) ve kesilme ondan sonra gelir."""
        gercek = subprocess.run

        def kesen(komut, *a, **kw):
            if list(komut[:3]) == ["git", "merge", "--no-ff"]:
                if birlestirdikten_sonra:
                    gercek(komut, *a, **kw)
                raise KeyboardInterrupt
            return gercek(komut, *a, **kw)

        with mock.patch.object(gorev.subprocess, "run", kesen), self.assertRaises(KeyboardInterrupt):
            gorev.al(kok, kimlik)

    def test_committen_sonra_kesilen_alma_gorev_agacini_ve_imzayi_degistirmez(self):
        kok, kimlik = self.hazir()
        once = hal(kok, kimlik)
        self._kesilen_al(kok, kimlik, birlestirdikten_sonra=False)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertFalse(durum(kok, kimlik).get("alindi"))

    def test_birlestirme_sirasinda_kesilen_alma_yarim_birlestirme_birakmaz(self):
        kok, kimlik = self.hazir()
        oturum_commit(kok, "src/gv-001/a.ts", "export const x = 9\n")
        once = hal(kok, kimlik)
        self._kesilen_al(kok, kimlik, birlestirdikten_sonra=True)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertFalse(birlestirme_suruyor(kok))
        oturum_commit(kok, "src/gv-001/a.ts", None)
        gorev.al(kok, kimlik)   # kilit bırakılmıştır; yeniden koşmadan alınır
        self.assertTrue(durum(kok, kimlik)["alindi"])
        self.assertEqual(len(isci_kosulari(kok, kimlik)), 1)

    def test_birlestirmeden_once_oldurulen_alma_gorev_agacini_ve_imzayi_degistirmez(self):
        kok, kimlik = self.hazir()
        once = hal(kok, kimlik)
        r = subprocess.run([sys.executable, "-c", OLDUREN, str(BURASI.parent), str(kok), kimlik],
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 9, r.stderr)
        self.assertEqual(hal(kok, kimlik), once)
        self.assertFalse(durum(kok, kimlik).get("alindi"))
        gorev.al(kok, kimlik)   # 'iş değişmiş' demez; yeniden koşmadan alınır
        self.assertTrue(durum(kok, kimlik)["alindi"])
        self.assertEqual(len(isci_kosulari(kok, kimlik)), 1)


class Temizlik(Ortam):
    """a) Başarılı birleştirme kesinleşme noktasıdır: ağacın ve dalın silinmesi yarıda kalırsa alma geçerli kalır."""

    def _temizlik_bozuk(self, kesilme):
        gercek = h._git

        def bozan(kok, *arg):
            if arg[:2] == ("worktree", "remove"):
                if kesilme:
                    raise KeyboardInterrupt
                raise h.HarnessHata("git worktree remove başarısız: dosya kullanımda")
            return gercek(kok, *arg)

        return mock.patch.object(gorev.h, "_git", bozan)

    def _komut(self, kok, kimlik):
        eski, cikti = os.getcwd(), io.StringIO()
        try:
            os.chdir(kok)
            with contextlib.redirect_stdout(cikti):
                kod = h.main(["h.py", "gorev", "al", kimlik])
        finally:
            os.chdir(eski)
        return kod, cikti.getvalue().strip()

    def _alinmis(self, kok, kimlik):
        d = durum(kok, kimlik)
        self.assertTrue(d["alindi"])
        self.assertEqual(d["alindi_sha"], git(kok, "rev-parse", "HEAD").strip())
        self.assertEqual(git(kok, "log", "-1", "--format=%s").strip(), "%s: İptal nedeni ekle" % kimlik)

    def test_temizlik_hata_verirse_alma_basarili_sayilir_ve_yeniden_calistirinca_kalan_temizlenir(self):
        kok, kimlik = self.hazir()
        with self._temizlik_bozuk(kesilme=False):
            kod, cikti = self._komut(kok, kimlik)
        self.assertEqual(kod, 0)
        self.assertRegex(cikti, r"^%s alındı: `main` dalına birleştirildi \([0-9a-f]{8}\), 1 dosya; ağaç ve dal "
                                r"silinemedi \(.*dosya kullanımda\)\. Kalanı silmek için yeniden çalıştır: "
                                r"python3 harness/h\.py gorev al %s$" % (kimlik, kimlik))
        self._alinmis(kok, kimlik)
        self.assertTrue(agac(kok, kimlik).is_dir())
        uc = git(kok, "rev-parse", "HEAD")
        kod, cikti = self._komut(kok, kimlik)
        self.assertEqual(kod, 0)
        self.assertRegex(cikti, r"^%s zaten alınmıştı: `main` dalına birleştirilmişti \([0-9a-f]{8}\), 1 dosya; "
                                r"ağaç ve dal silindi$" % kimlik)
        self.assertEqual(git(kok, "rev-parse", "HEAD"), uc)   # yeniden birleştirmez
        self.assertFalse(agac(kok, kimlik).exists())
        self.assertEqual(git(kok, "branch", "--list", "gorev/" + kimlik).strip(), "")
        with self.assertRaisesRegex(h.HarnessHata, "zaten alınmış"):
            gorev.al(kok, kimlik)

    def test_temizlik_sirasinda_kesilen_alma_alinmis_kalir(self):
        kok, kimlik = self.hazir()
        with self._temizlik_bozuk(kesilme=True), self.assertRaises(KeyboardInterrupt):
            gorev.al(kok, kimlik)
        self._alinmis(kok, kimlik)
        self.assertIsNone(gorev.al(kok, kimlik)["uyari"])
        self.assertFalse(agac(kok, kimlik).exists())

    def test_temizlik_hatasi_plan_isaretini_engellemez(self):
        kok = gorev_deposu()
        plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/**"])
        plan.epic(kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
        _, kimlik = plan.task(kok, "EP-001", "İptal nedeni ekle", rol="uygulayici", yollar=["src/gv-001/**"],
                              hedef="İptal isteğine neden kodu ekle.", olcut="Neden kodu olmadan istek reddedilir.")
        os.environ["SAHTE_MOD"] = "ayri"
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        with self._temizlik_bozuk(kesilme=False):
            self.assertIn("dosya kullanımda", gorev.al(kok, kimlik)["uyari"])
        self.assertTrue(plan.oku(kok, "EP-001")["isaret"])
        self._alinmis(kok, kimlik)


class CakismaGiderilince(Ortam):
    """b) Çakışma giderilince görev yeniden koşturulmadan alınır."""

    def test_oturum_dalinda_giderilen_cakismadan_sonra_yeniden_kosmadan_alinir(self):
        kok, kimlik = self.hazir()
        oturum_commit(kok, "src/gv-001/a.ts", "export const x = 9\n")
        with self.assertRaises(h.HarnessHata):
            gorev.al(kok, kimlik)
        oturum_commit(kok, "src/gv-001/a.ts", None)
        gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/gv-001/a.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertTrue(durum(kok, kimlik)["alindi"])
        self.assertEqual(len(isci_kosulari(kok, kimlik)), 1)

    def test_tazelemeyle_giderilen_cakismadan_sonra_yeniden_kosmadan_alinir(self):
        kok, kimlik = self.hazir()
        oturum_commit(kok, "src/gv-001/a.ts", "export const x = 9\n")
        with self.assertRaises(h.HarnessHata):
            gorev.al(kok, kimlik)
        oturum_commit(kok, "src/gv-001/a.ts", None)
        oturum_commit(kok, "src/gv-001/b.ts", "export const b = 1\n")
        gorev.tazele(kok, kimlik)   # 'iş değişmiş' diye durmaz; yalnız yeniden inceleme ister
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        gorev.al(kok, kimlik)
        self.assertEqual((kok / "src/gv-001/a.ts").read_text(encoding="utf-8"), "export const x = 2\n")
        self.assertEqual(len(isci_kosulari(kok, kimlik)), 1)


class Sira(Ortam):
    """c, d) Yan yana gelen almalar sıraya girer; ölü sürecin kilidi bırakılır; bekleme süre sınırlıdır."""

    def _kilidi_tut(self, kok):
        kilit_yolu(kok).parent.mkdir(parents=True, exist_ok=True)
        p = subprocess.Popen([sys.executable, "-c", KILIT_TUTAN, str(kilit_yolu(kok))], stdout=subprocess.PIPE,
                             text=True)
        self.addCleanup(p.wait)
        self.addCleanup(p.kill)
        self.assertEqual(p.stdout.readline().strip(), "tutuyor")
        p.stdout.close()
        return p

    def test_eszamanli_iki_alma_ikisi_de_biter(self):
        kok, ilk = self.hazir()
        _, ikinci = self.hazir(kok)
        engel = threading.Barrier(2)
        hatalar = []

        def al(kimlik):
            engel.wait()
            try:
                gorev.al(kok, kimlik)
            except Exception as e:   # noqa: BLE001 — iş parçacığındaki hata teste taşınır
                hatalar.append(e)

        isler = [threading.Thread(target=al, args=(k,)) for k in (ilk, ikinci)]
        for t in isler:
            t.start()
        for t in isler:
            t.join(60)
        self.assertEqual(hatalar, [])
        self.assertTrue(durum(kok, ilk)["alindi"] and durum(kok, ikinci)["alindi"])
        konular = git(kok, "log", "--merges", "--format=%s").split("\n")
        self.assertEqual(sorted(k.split(":")[0] for k in konular if k), sorted([ilk, ikinci]))
        self.assertTrue((kok / "src/gv-001/a.ts").is_file() and (kok / "src/gv-002/a.ts").is_file())

    def test_iki_surecteki_almalar_da_sirayla_biter(self):
        kok, ilk = self.hazir()
        _, ikinci = self.hazir(kok)
        komut = [sys.executable, str(BURASI.parent / "h.py"), "gorev", "al"]
        surecler = [subprocess.Popen(komut + [k], cwd=kok, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    for k in (ilk, ikinci)]
        ciktilar = [p.communicate(timeout=60) for p in surecler]
        self.assertEqual([p.returncode for p in surecler], [0, 0], ciktilar)
        self.assertEqual(len([k for k in git(kok, "log", "--merges", "--format=%s").split("\n") if k]), 2)

    def test_kilit_tutulurken_alma_bekler_birakilinca_biter(self):
        kok, kimlik = self.hazir()
        tutan = self._kilidi_tut(kok)
        threading.Timer(1.0, tutan.kill).start()
        basla = time.monotonic()
        gorev.al(kok, kimlik)
        self.assertGreaterEqual(time.monotonic() - basla, 0.9)
        self.assertTrue(durum(kok, kimlik)["alindi"])

    def test_kilidi_tutan_surec_olurse_sonraki_alma_takilmaz(self):
        kok, kimlik = self.hazir()
        tutan = self._kilidi_tut(kok)
        tutan.kill()
        tutan.wait()
        self.assertTrue(kilit_yolu(kok).is_file())   # dosya kalır; kilidi tutan süreçtir
        basla = time.monotonic()
        gorev.al(kok, kimlik)
        self.assertLess(time.monotonic() - basla, 10)
        self.assertTrue(durum(kok, kimlik)["alindi"])

    def test_sure_siniri_asilirsa_anlasilir_iletiyle_durur_ve_hicbir_sey_degismez(self):
        kok, kimlik = self.hazir(alma_bekleme_sn=1)
        self._kilidi_tut(kok)
        once = hal(kok, kimlik)
        basla = time.monotonic()
        with self.assertRaisesRegex(h.HarnessHata, r"başka bir alma.*1 sn"):
            gorev.al(kok, kimlik)
        self.assertLess(time.monotonic() - basla, 10)
        self.assertEqual(hal(kok, kimlik), once)

    def test_bekleme_siniri_varsayilani_kodda_durur(self):
        kok = gorev_deposu(alma_bekleme_sn="VARSAYILAN")
        self.assertEqual(h.ayar_oku(kok)["gorev"]["alma_bekleme_sn"], 600)


class BasariliAlma(Ortam):
    """e) Başarılı almanın bugünkü davranışı değişmez."""

    def test_plan_isareti_agac_dal_ve_cikti_satiri(self):
        kok = gorev_deposu()
        plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/**"])
        plan.epic(kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
        _, kimlik = plan.task(kok, "EP-001", "İptal nedeni ekle", rol="uygulayici", yollar=["src/gv-001/**"],
                              hedef="İptal isteğine neden kodu ekle.", olcut="Neden kodu olmadan istek reddedilir.")
        os.environ["SAHTE_MOD"] = "ayri"
        gorev.kos(kok, kimlik)
        gorev.incele(kok, kimlik)
        eski, cikti = os.getcwd(), io.StringIO()
        try:
            os.chdir(kok)
            with contextlib.redirect_stdout(cikti):
                self.assertEqual(h.main(["h.py", "gorev", "al", kimlik]), 0)
        finally:
            os.chdir(eski)
        self.assertRegex(cikti.getvalue().strip(),
                         r"^%s alındı: `main` dalına birleştirildi \([0-9a-f]{8}\), 1 dosya; ağaç ve dal silindi$"
                         % kimlik)
        self.assertTrue(plan.oku(kok, "EP-001")["isaret"])
        self.assertFalse(agac(kok, kimlik).exists())
        self.assertEqual(git(kok, "branch", "--list", "gorev/" + kimlik).strip(), "")
        self.assertEqual(git(kok, "log", "-1", "--format=%s").strip(), "%s: İptal nedeni ekle" % kimlik)
        self.assertEqual(re.sub(r"\s", "", git(kok, "status", "--porcelain")), "")


if __name__ == "__main__":
    unittest.main(verbosity=1)
