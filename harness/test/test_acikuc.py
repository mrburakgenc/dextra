#!/usr/bin/env python3
"""Açık uç (TS-006 Yapı 19): düğümün karara bağlanmamış noktaları adlı ve sayılıdır; iş o noktaya gelince soru
kullanıcıya gider.

Biçim: düğümün `## Açık uçlar` bölümünde `- AU-<n>: <metin>`; kapanan uç `## Kapanan uçlar` bölümüne tarih ve kararla
geçer. `h.py acik-uc` listeler, `ekle` ekler, `kapat` kapatır (kanca her zaman sorar). Paket işe düşen düğümlerin açık
uçlarını ayrı blokta verir; açık uca dayanan sorunun cevabını (`gorev kos --cevap`) kanca her zaman kullanıcıya sorar.
Kancanın onay işareti gördüğü komutun özetine bağlıdır: reddedilmiş sorunun işaretiyle farklı biçimli komut koşmaz.

Koşum: python3 harness/test/test_acikuc.py
"""
from __future__ import annotations

import datetime
import json
import os
import pathlib
import subprocess
import sys
import tempfile
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
import ajan_hook  # noqa: E402
from test_h import KARAR, depo, git, git_depo  # noqa: E402
from test_hook import TASLAK_KARAR, TASLAK_KURAL, baglam, duzenle, gerekce, karar, komut  # noqa: E402
from test_gorev import SAHTE_ISCI  # noqa: E402
from test_engel import TASARIM, HEDEF, OLCUT, plan_kur, sessiz, yaprak  # noqa: E402

H_PY = str(BURASI.parent / "h.py")
SORU_KIPI = 'soru="SORU-ISARETI-5521"'
assert SORU_KIPI in SAHTE_ISCI
SAHTE = SAHTE_ISCI.replace(SORU_KIPI, 'soru=os.environ.get("SAHTE_SORU", "SORU-ISARETI-5521")')
YONERGE = ("bu noktalardan birinde seçim yapman gerekirse seçme: soruyla dur ve sorunda açık ucun kimliğini yaz "
           "(örnek KR-010/AU-1)")
BUGUN = datetime.date.today().isoformat()


def uclu(metin: str, *satirlar: str) -> str:
    """Düğüm metninin sonuna açık uç bölümü ekler."""
    return metin.rstrip("\n") + "\n\n## Açık uçlar\n" + "".join(s + "\n" for s in satirlar)


KR_UCLU = uclu(KARAR, "- AU-1: Tablonun adı ne olacak?")                       # KU-001'in (yoldan) kararı
KU_TASLAK_UCLU = uclu(TASLAK_KURAL, "- AU-1: Neden kodları kaç haneli?")       # yola düşen taslak kural
TS_UCLU = uclu(TASARIM, "- AU-1: İptal geri alınabilir mi?", "- AU-2: Kısmi iptal var mı?")   # dayanak
ILGISIZ = uclu(KARAR.replace("KR-001", "KR-009").replace("baslik: Durum tek tablodan yönetilir",
                                                         "baslik: Başka bir konu"), "- AU-1: İLGİSİZ-UC")


def deposu(ek=None, git_li=True, **gorev_ayari):
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "isci.py"
    sahte.write_text(SAHTE, encoding="utf-8")
    ayar = {"gorev": dict({"komut": [sys.executable, str(sahte)], "model": "sonnet", "max_tur": 5,
                           "zaman_asimi_sn": 20, "izin_modu": "acceptEdits",
                           "ortam_izinli": h.VARSAYILAN_AYAR["gorev"]["ortam_izinli"] + ["SAHTE_*"]}, **gorev_ayari)}
    kok = depo(ek, ayar=ayar)
    return git_depo(kok) if git_li else kok


def cli(kok, *arg):
    return subprocess.run([sys.executable, H_PY] + list(arg), cwd=kok, capture_output=True, text=True,
                          encoding="utf-8", stdin=subprocess.DEVNULL)


def metin(kok, yol):
    return (kok / yol).read_text(encoding="utf-8")


def kayit(kok, kimlik):
    return h.ortak_kok(kok) / ".harness/gorev" / kimlik


def kart_ac(kok, **kw):
    kart, _ = sessiz(gorev.yeni, kok, kw.pop("baslik", "İptal nedeni ekle"), "uygulayici", ["src/siparis/**"], [],
                     hedef=HEDEF, olcut=OLCUT, **kw)
    return kart.parent.name


def soran_gorev(kok, soru):
    """Koşup soruyla duran görev."""
    kimlik = kart_ac(kok)
    os.environ.update(SAHTE_MOD="soru", SAHTE_SORU=soru)
    try:
        rapor, _ = sessiz(gorev.kos, kok, kimlik)
    finally:
        for ad in ("SAHTE_MOD", "SAHTE_SORU"):
            os.environ.pop(ad, None)
    assert rapor["durum"] == "soru", rapor
    return kimlik


class Komutlar(unittest.TestCase):
    """a) ekle, listele, kapat: numara artar; kapanan uç 'Kapanan uçlar' bölümünde tarih ve kararla durur, listede yok."""

    def test_ekle_listele_kapat(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TASARIM}, git_li=False)
        yol = "kb/tasarim/TS-001-iptal.md"
        r = cli(kok, "acik-uc")
        self.assertEqual((r.returncode, r.stdout), (0, "0 açık uç\n"))
        self.assertNotIn("## Açık uçlar", metin(kok, yol))   # şablon boş bölüm taşımaz
        for i, soru in enumerate(("İptal geri alınabilir mi?", "Kısmi  iptal\nvar mı?"), 1):
            r = cli(kok, "acik-uc", "ekle", "TS-001", soru)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(r.stdout, "eklendi: TS-001/AU-%d (%s)\n" % (i, yol))
        self.assertTrue(metin(kok, yol).endswith(
            "\n\n## Açık uçlar\n- AU-1: İptal geri alınabilir mi?\n- AU-2: Kısmi iptal var mı?\n"))
        r = cli(kok, "acik-uc")
        self.assertEqual(r.stdout, "TS-001/AU-1 [taslak] İptal geri alınabilir mi?\n"
                                   "TS-001/AU-2 [taslak] Kısmi iptal var mı?\n2 açık uç, 1 düğümde\n")
        self.assertEqual(cli(kok, "acik-uc", "TS-001").stdout, r.stdout)
        self.assertEqual(cli(kok, "acik-uc", "KR-001").stdout, "0 açık uç\n")
        self.assertEqual(cli(kok, "acik-uc", "TS-404").returncode, 2)

        # kapatma: kancanın bu komuta bıraktığı işaretle
        kapat = 'python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar "Geri alınamaz; yeni sipariş açılır."'
        self.assertEqual(karar(komut(kok, kapat)), "ask")
        r = cli(kok, "acik-uc", "kapat", "TS-001", "AU-1", "--karar", "Geri alınamaz; yeni sipariş açılır.")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("kapandı: TS-001/AU-1 — İptal geri alınabilir mi?", r.stdout)
        self.assertTrue(metin(kok, yol).endswith(
            "\n\n## Açık uçlar\n- AU-2: Kısmi iptal var mı?\n\n## Kapanan uçlar\n"
            "- AU-1 (%s): İptal geri alınabilir mi? — karar: Geri alınamaz; yeni sipariş açılır.\n" % BUGUN))
        self.assertEqual(cli(kok, "acik-uc").stdout, "TS-001/AU-2 [taslak] Kısmi iptal var mı?\n1 açık uç, 1 düğümde\n")
        # numara kapananlardan da artar; yeni uç kapananların önüne yazılır
        self.assertIn("TS-001/AU-3", cli(kok, "acik-uc", "ekle", "TS-001", "Üçüncü").stdout)
        self.assertIn("- AU-2: Kısmi iptal var mı?\n- AU-3: Üçüncü\n\n## Kapanan uçlar\n", metin(kok, yol))
        for no in ("AU-2", "AU-3"):
            komut(kok, "python3 harness/h.py acik-uc kapat TS-001 %s --karar Karar-%s" % (no, no))
            self.assertEqual(cli(kok, "acik-uc", "kapat", "TS-001", no, "--karar", "Karar-" + no).returncode, 0)
        son = metin(kok, yol)
        self.assertNotIn("## Açık uçlar", son)   # bölüm yalnız açık uç varsa yazılır
        self.assertEqual(son.count("## Kapanan uçlar"), 1)
        self.assertIn("- AU-3 (%s): Üçüncü — karar: Karar-AU-3\n" % BUGUN, son)
        self.assertEqual(cli(kok, "acik-uc").stdout, "0 açık uç\n")
        self.assertEqual([b for b in h.denetle(kok) if b["kod"] == "Z21"], [])

    def test_kapatma_isaretsiz_ve_ucbirimsiz_reddedilir(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False)
        once = metin(kok, "kb/tasarim/TS-001-iptal.md")
        r = cli(kok, "acik-uc", "kapat", "TS-001", "AU-1", "--karar", "x")
        self.assertEqual(r.returncode, 2)
        self.assertIn("TS-001/AU-1 kapatılmadı: kapatma kullanıcının onayını ister", r.stderr)
        self.assertEqual(metin(kok, "kb/tasarim/TS-001-iptal.md"), once)

    def test_ucbirimde_arac_kendisi_sorar(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False)
        ucbirim = mock.Mock()
        ucbirim.stdin.isatty.return_value = ucbirim.stdout.isatty.return_value = True
        with mock.patch.object(h, "sys", ucbirim), mock.patch("builtins.input", return_value="hayır"):
            with self.assertRaisesRegex(h.HarnessHata, "kullanıcı onaylamadı"):
                sessiz(h._komut_acik_uc, kok, ["kapat", "TS-001", "AU-1", "--karar", "x"])
        self.assertIn("- AU-1: İptal geri alınabilir mi?", metin(kok, "kb/tasarim/TS-001-iptal.md"))
        with mock.patch.object(h, "sys", ucbirim), mock.patch("builtins.input", return_value="evet"):
            kod, cikti = sessiz(h._komut_acik_uc, kok, ["kapat", "TS-001", "AU-1", "--karar", "x"])
        self.assertEqual(kod, 0)
        self.assertIn("TS-001/AU-1 — İptal geri alınabilir mi?\nyazılacak karar: x", cikti)
        self.assertNotIn("- AU-1: İptal", metin(kok, "kb/tasarim/TS-001-iptal.md"))

    def test_reddedilmis_kapatmanin_isaretiyle_baska_karar_yazilmaz(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False)
        once = metin(kok, "kb/tasarim/TS-001-iptal.md")
        komut(kok, "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar 'Sorulan karar'")   # kullanıcı reddetti
        r = cli(kok, "acik-uc", "kapat", "TS-001", "AU-1", "--karar", "Sorulmamış karar")
        self.assertEqual(r.returncode, 2)
        self.assertEqual(metin(kok, "kb/tasarim/TS-001-iptal.md"), once)

    def test_kabul_edilmis_dugume_eklemek_surum_ister(self):
        kok = deposu()
        git(kok, "checkout", "-q", "-b", "is")
        r = cli(kok, "acik-uc", "ekle", "KR-001", "Tablonun adı?")
        self.assertIn("not: KR-001 kabul durumunda; açık uç bağlayıcı içeriktir, sürümü artır (Z12)", r.stdout)
        self.assertIn("surumsuz-degisiklik", {b["ad"] for b in h.denetle(kok, taban=True)})
        yol = kok / "kb/karar/KR-001-durum-tablosu.md"
        yol.write_text(metin(kok, "kb/karar/KR-001-durum-tablosu.md").replace("surum: 1", "surum: 2"), encoding="utf-8")
        self.assertNotIn("surumsuz-degisiklik", {b["ad"] for b in h.denetle(kok, taban=True)})

    def test_kabul_edilmis_dugumde_kapatma_surum_ister(self):
        """İnceleme önerisi: kapatma da bağlayıcı içeriği değiştirir; çıktısı ekleme gibi sürümü söyler."""
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU, "kb/tasarim/TS-001-iptal.md": TS_UCLU})
        git(kok, "checkout", "-q", "-b", "is")
        komut(kok, "python3 harness/h.py acik-uc kapat KR-001 AU-1 --karar durum_gecisleri")
        r = cli(kok, "acik-uc", "kapat", "KR-001", "AU-1", "--karar", "durum_gecisleri")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("not: KR-001 kabul durumunda; açık uç bağlayıcı içeriktir, kapatmak onu değiştirir: sürümü "
                      "artır (Z12)", r.stdout)
        self.assertIn("surumsuz-degisiklik", {b["ad"] for b in h.denetle(kok, taban=True)})
        komut(kok, "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar Hayır")   # taslakta sürüm notu yok
        r = cli(kok, "acik-uc", "kapat", "TS-001", "AU-1", "--karar", "Hayır")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("sürümü artır", r.stdout)

    def test_tirnakli_buyuktur_ve_ayirici_isaret_uretir(self):
        """İnceleme önerisi: tırnaklı değer yönlendirme ya da ayırıcı sanılmaz; kancanın işaretiyle araç kapatır."""
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False)
        for no, karar_metni in (("AU-1", ">5 gün; sonra iptal"), ("AU-2", "3>2 olsun")):
            c = komut(kok, "python3 harness/h.py acik-uc kapat TS-001 %s --karar '%s' 2>&1" % (no, karar_metni))
            self.assertEqual(karar(c), "ask")
            self.assertIn("yazılacak karar: " + karar_metni, gerekce(c))
            self.assertNotIn("onay işareti bırakılmadı", gerekce(c))
            r = cli(kok, "acik-uc", "kapat", "TS-001", no, "--karar", karar_metni)
            self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("— karar: >5 gün; sonra iptal\n", metin(kok, "kb/tasarim/TS-001-iptal.md"))


class Bicim(unittest.TestCase):
    """b) Yinelenen numara ve boş metin `denetle` çıktısında kırmızıdır."""

    def test_yinelenen_numara_ve_bos_metin_kirmizi(self):
        bozuk = uclu(TASARIM, "- AU-1: Bir", "- AU-1: İki", "- AU-2:", "- AU-3:   ") + "\n## Kapanan uçlar\n" \
            "- AU-2 (2026-11-25): Eski — karar: x\n"
        kok = deposu({"kb/tasarim/TS-001-iptal.md": bozuk}, git_li=False)
        bulgular = [(b["ad"], b["mesaj"], b["seviye"]) for b in h.denetle(kok) if b["kod"] == "Z21"]
        self.assertEqual(sorted(bulgular), sorted([
            ("acik-uc-yinelenen", "AU-1 numarası düğümde birden çok kez geçiyor", "kirmizi"),
            ("acik-uc-bos", "AU-2 açık ucunun metni boş", "kirmizi"),
            ("acik-uc-bos", "AU-3 açık ucunun metni boş", "kirmizi"),
            ("acik-uc-yinelenen", "AU-2 numarası düğümde birden çok kez geçiyor", "kirmizi")]))
        r = cli(kok, "denetle")
        self.assertEqual(r.returncode, 1)
        self.assertIn("acik-uc-yinelenen", r.stdout + r.stderr)
        self.assertIn("acik-uc-bos", r.stdout + r.stderr)

    def test_bicime_uymayan_satir_kirmizi(self):
        """İnceleme önerisi: bölümdeki bozuk satır paket, sayım ve listeye girmez; denetim onu gösterir."""
        bozuk = uclu(TASARIM, "- AU-1: Doğru", "- AU2: Tiresiz", "* AU-3: Yıldızlı", "  - AU-4: Girintili", "Serbest")
        kok = deposu({"kb/tasarim/TS-001-iptal.md": bozuk}, git_li=False)
        bulgular = [b for b in h.denetle(kok) if b["kod"] == "Z21"]
        self.assertEqual([b["ad"] for b in bulgular], ["acik-uc-bicim"] * 4)
        self.assertEqual({b["seviye"] for b in bulgular}, {"kirmizi"})
        for parca in ("- AU2: Tiresiz", "* AU-3: Yıldızlı", "- AU-4: Girintili", "Serbest"):
            self.assertTrue(any(parca in b["mesaj"] for b in bulgular), parca)
        self.assertEqual(cli(kok, "denetle").returncode, 1)

    def test_temiz_bicim_bulgu_vermez(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU, "kb/karar/KR-001-durum-tablosu.md": KR_UCLU},
                     git_li=False)
        self.assertEqual([b for b in h.denetle(kok) if b["kod"] == "Z21"], [])


class Kanca(unittest.TestCase):
    """c) Kapatma komutu ve `- AU-` satırını silen ya da değiştiren düzenleme onay 'yok' iken de sorulur; ekleme serbest."""

    def test_kapatma_komutu_onay_yok_iken_sorulur(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False, onay="yok")
        c = komut(kok, 'cd %s && python3 harness/h.py acik-uc kapat TS-001 AU-2 --karar "Kısmi iptal yok" 2>&1' % kok)
        self.assertEqual(karar(c), "ask")
        for parca in ("TS-001/AU-2 — Kısmi iptal var mı?", "yazılacak karar: Kısmi iptal yok",
                      "kb/tasarim/TS-001-iptal.md", "onay ayarından bağımsız"):
            self.assertIn(parca, gerekce(c))
        isaret = h.izin_isareti(kok, "acik-uc-kapat", "TS-001")
        self.assertEqual(json.loads(isaret.read_text(encoding="utf-8"))["ozet"], h.komut_ozeti(
            ["acik-uc", "kapat", "TS-001", "AU-2", "--karar", "Kısmi iptal yok"]))

    def test_kapatma_soru_gostermeyen_modda_reddedilir_cozumlenemeyende_isaret_yok(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False)
        c = ajan_hook.isle("komut-oncesi", {"session_id": "s1", "cwd": str(kok), "permission_mode": "bypassPermissions",
                                            "tool_input": {"command": "python3 harness/h.py acik-uc kapat TS-001 AU-1 "
                                                           "--karar x"}}, {})
        self.assertEqual(karar(c), "deny")
        c = komut(kok, "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar 'kapanmayan tırnak")
        self.assertEqual(karar(c), "deny")   # ana oturumun notu: çözümlenemeyen izinli komut reddedilir
        self.assertIn("Komut çözümlenemedi", gerekce(c))
        self.assertFalse(h.izin_isareti(kok, "acik-uc-kapat", "TS-001").exists())

    def test_satiri_silen_ve_degistiren_duzenleme_sorulur_ekleyen_sorulmaz(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False, onay="yok")
        yol = "kb/tasarim/TS-001-iptal.md"
        sil = duzenle(kok, yol, old_string="- AU-2: Kısmi iptal var mı?\n", new_string="")
        self.assertEqual(karar(sil), "ask")
        self.assertIn("- AU-2: Kısmi iptal var mı?", gerekce(sil))
        degistir = duzenle(kok, yol, old_string="İptal geri alınabilir mi?", new_string="Geri alınamaz.")
        self.assertEqual(karar(degistir), "ask")
        self.assertIn("- AU-1: İptal geri alınabilir mi?", gerekce(degistir))
        yaz = ajan_hook.isle("duzenleme-oncesi", {"session_id": "s1", "cwd": str(kok), "tool_name": "Write",
                                                  "tool_input": {"file_path": str(kok / yol), "content": TASARIM}}, {})
        self.assertEqual(karar(yaz), "ask")
        ekle = duzenle(kok, yol, old_string="- AU-2: Kısmi iptal var mı?\n",
                       new_string="- AU-2: Kısmi iptal var mı?\n- AU-3: Yeni soru\n")
        self.assertIsNone(ekle)
        self.assertIsNone(duzenle(kok, yol, old_string="İptal akışı.", new_string="İptal akışı ve nedeni."))
        bypass = ajan_hook.isle("duzenleme-oncesi", {"session_id": "s1", "cwd": str(kok), "tool_name": "Edit",
                                                     "permission_mode": "bypassPermissions",
                                                     "tool_input": {"file_path": str(kok / yol),
                                                                    "old_string": "- AU-1: İptal geri alınabilir mi?\n",
                                                                    "new_string": ""}}, {})
        self.assertEqual(karar(bypass), "deny")

    def test_bolum_basligini_degistiren_ya_da_araya_baslik_koyan_duzenleme_sorulur(self):
        """İnceleme engeli: denetim satır metnine değil ayrıştırılmış açık uç kümesine bakar."""
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU + "\n## Kapanan uçlar\n- AU-3 (2026-11-25): Eski — karar: x\n"},
                     git_li=False, onay="yok")
        yol = "kb/tasarim/TS-001-iptal.md"
        baslik = duzenle(kok, yol, old_string="## Açık uçlar\n", new_string="## Notlar\n")
        self.assertEqual(karar(baslik), "ask")
        self.assertIn("- AU-1: İptal geri alınabilir mi? (bölüm: Açık uçlar)", gerekce(baslik))
        self.assertIn("- AU-2: Kısmi iptal var mı? (bölüm: Açık uçlar)", gerekce(baslik))
        araya = duzenle(kok, yol, old_string="- AU-2: Kısmi", new_string="## Ara\n- AU-2: Kısmi")
        self.assertEqual(karar(araya), "ask")
        self.assertIn("- AU-2: Kısmi iptal var mı?", gerekce(araya))
        self.assertNotIn("AU-1", gerekce(araya))
        yaz = ajan_hook.isle("duzenleme-oncesi", {"session_id": "s1", "cwd": str(kok), "tool_name": "Write", "tool_input": {
            "file_path": str(kok / yol), "content": metin(kok, yol).replace("## Açık uçlar", "## Sorular")}}, {})
        self.assertEqual(karar(yaz), "ask")
        kapanan = duzenle(kok, yol, old_string="## Kapanan uçlar\n", new_string="## Geçmiş\n")
        self.assertEqual(karar(kapanan), "ask")
        self.assertIn("AU-3", gerekce(kapanan))
        # yeşil: uçların bölümünü değiştirmeyen başlık ve satır düzenlemesi sorulmaz
        self.assertIsNone(duzenle(kok, yol, old_string="## Açık uçlar\n", new_string="## Açık uçlar\n\n"))
        self.assertIsNone(duzenle(kok, yol, old_string="## Kapanan uçlar\n", new_string="## Ek\nNot.\n\n## Kapanan uçlar\n"))

    def test_kapatma_sorusu_obur_kapilarla_birlesir(self):
        """İnceleme engeli: kapatma sorusu erken dönmez; gönderme, görev işlemi ve işçi denetimi önce karar verir, red
        kazanır, sorular tek soruda görünür."""
        bozuk = uclu(KARAR.replace("KR-001", "KR-008"), "- AU-1: Bir", "- AU-1: İki")
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU, "kb/karar/KR-008-bozuk.md": bozuk}, onay="yok")
        kapat = "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar Hayır"
        isaret = h.izin_isareti(kok, "acik-uc-kapat", "TS-001")
        c = komut(kok, kapat + " && git push origin main")   # kırmızı zincirde push: red, kapatma işareti yok
        self.assertEqual(karar(c), "deny")
        self.assertIn("Zincir kırmızı", gerekce(c))
        self.assertFalse(isaret.exists())
        c = komut(kok, kapat + " && gh pr merge 3")
        self.assertEqual(karar(c), "deny")
        c = komut(kok, kapat + " && git commit -qam x", ortam={"HARNESS_GOREV": "GV-001"})   # işçi oturumu
        self.assertEqual(karar(c), "deny")
        self.assertIn("git geçmişine dokunmaz", gerekce(c))
        self.assertFalse(isaret.exists())
        kimlik = kart_ac(kok)
        c = komut(kok, "python3 harness/h.py gorev at %s && %s" % (kimlik, kapat))   # atma her zaman sorulur
        self.assertEqual(karar(c), "ask")
        for parca in (ajan_hook.GOREV_SORUSU["at"], kimlik, "TS-001/AU-1 — İptal geri alınabilir mi?",
                      "yazılacak karar: Hayır"):
            self.assertIn(parca, gerekce(c))
        self.assertTrue(isaret.exists())
        # yeşil: tek başına kapatma ve kırmızı zincirde push içermeyen kapatma sorulur
        self.assertEqual(karar(komut(kok, kapat)), "ask")


class Paket(unittest.TestCase):
    """d) İşe düşen bağlayıcı, taslak ve dayanak düğümlerinin açık uçları bloğa girer; işe düşmeyeninki girmez; bağlayıcı
    bloğun metni ve özet damgası değişmez; açık uç yokken paket bugünküyle aynıdır."""

    def test_blok_ise_dusenleri_tasir(self):
        ek = {"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": KU_TASLAK_UCLU,
              "kb/karar/KR-001-durum-tablosu.md": KR_UCLU, "kb/tasarim/TS-001-iptal.md": TS_UCLU,
              "kb/karar/KR-009-baska.md": ILGISIZ}
        uclu_kok = deposu(ek, git_li=False)
        ucsuz_kok = deposu(dict(ek, **{"kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL, "kb/karar/KR-001-durum-tablosu.md":
                                       KARAR, "kb/tasarim/TS-001-iptal.md": TASARIM, "kb/karar/KR-009-baska.md": None}),
                           git_li=False)
        for rol in ("uygulayici", "inceleyici"):
            p = h.paket(uclu_kok, rol, ["src/siparis/**"], [], ["TS-001"])
            bugun = h.paket(ucsuz_kok, rol, ["src/siparis/**"], [], ["TS-001"])
            self.assertEqual((p["metin"], p["ozet"]), (bugun["metin"], bugun["ozet"]))
            onek, _, blok = p["tam"].partition("\n\n[[KB-ACIK-UC]]\n")
            self.assertEqual(onek, bugun["tam"])
            self.assertNotIn("KB-ACIK-UC", bugun["tam"])
            self.assertTrue(blok.endswith("\n[[/KB-ACIK-UC]]"))
            self.assertIn(YONERGE, blok)
            for satir in ("- KU-002/AU-1: Neden kodları kaç haneli?", "- KR-001/AU-1: Tablonun adı ne olacak?",
                          "- TS-001/AU-1: İptal geri alınabilir mi?", "- TS-001/AU-2: Kısmi iptal var mı?"):
                self.assertIn("\n" + satir + "\n", blok)
            self.assertNotIn("İLGİSİZ-UC", blok)
        # işe düşmeyen: yolu başka yerde olan işe KU-001/KU-002 ve kararları düşmez; dayanaksız işe TS-001 düşmez
        p = h.paket(uclu_kok, "uygulayici", ["src/odeme/**"], [])
        self.assertNotIn("KB-ACIK-UC", p["tam"])
        p = h.paket(uclu_kok, "uygulayici", ["src/siparis/**"], [])
        self.assertNotIn("TS-001/AU", p["tam"])
        self.assertIn("KU-002/AU-1", p["tam"])

    def test_kart_ve_inceleme_bloku_tasir_kos_blogu_yeniler(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": uclu(TASARIM.replace("durum: taslak", "durum: kabul"),
                                                         "- AU-1: İptal geri alınabilir mi?")})
        kimlik = kart_ac(kok, dayanak=["TS-001"])
        kart = (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")
        self.assertIn("- TS-001/AU-1: İptal geri alınabilir mi?\n[[/KB-ACIK-UC]]", kart)
        komut(kok, "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar Hayır")
        self.assertEqual(cli(kok, "acik-uc", "kapat", "TS-001", "AU-1", "--karar", "Hayır").returncode, 0)
        git(kok, "commit", "-qam", "kapat")
        rapor, _ = sessiz(gorev.kos, kok, kimlik)
        self.assertEqual(rapor["durum"], "tamam", rapor)
        kart = (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")
        self.assertNotIn("KB-ACIK-UC", kart)   # kapanan uç karttan da çıktı
        self.assertIn("\n[[/KB-PAKET]]\n\n## Bitiş kaydı", kart)

    def test_inceleme_kartinda_yonerge_ve_blok(self):
        """g) İnceleme kartında açık uç yönergesi vardır."""
        self.assertIn("Açık uçta (paketin \"Açık uçlar\" bloğundaki karara bağlanmamış nokta) sorulmadan yapılmış seçim "
                      "ENGELDİR", gorev.INCELEME)
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU})
        kimlik = kart_ac(kok)
        sessiz(gorev.kos, kok, kimlik)
        sessiz(gorev.incele, kok, kimlik)
        istem = (kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        self.assertIn("sorulmadan yapılmış seçim ENGELDİR", istem)
        self.assertIn("- KR-001/AU-1: Tablonun adı ne olacak?", istem)


class Soru(unittest.TestCase):
    """e) Açık uç kimliği taşıyan soruyla duran görevde `gorev kos --cevap` kancada her zaman sorulur ve özet soruyu,
    açık ucu ve cevabı taşır; cevap kayda 'kullanıcı onayıyla' yazılır. Kimlik taşımayan soruda kanca bugünkü gibidir."""

    SORU = "Tablo adı karara bağlanmamış (KR-001/AU-1): hangisi?"

    def test_acik_uca_dayanan_soru_kullaniciya_gider(self):
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, self.SORU)
        _, cikti = sessiz(gorev.komut, kok, ["durum"])
        self.assertIn("%s [yarım kaldı (soru: kullanıcıya)]" % kimlik, cikti)
        bas = "python3 harness/h.py gorev kos %s" % kimlik
        c = komut(kok, bas + ' --cevap "durum_gecisleri adı kullanılır"')
        self.assertEqual(karar(c), "ask")
        for parca in ("cevabı yalnız kullanıcı verir", "işçinin sorusu: " + self.SORU,
                      "açık uç: KR-001/AU-1 — Tablonun adı ne olacak?",
                      "verilecek cevap: durum_gecisleri adı kullanılır", "kullanıcı onayıyla"):
            self.assertIn(parca, gerekce(c))
        kod, _ = sessiz(gorev.komut, kok, ["kos", kimlik, "--cevap", "durum_gecisleri adı kullanılır"])
        self.assertEqual(kod, 0)
        cevaplar = json.loads((kayit(kok, kimlik) / "cevaplar.json").read_text(encoding="utf-8"))["cevaplar"]
        self.assertEqual(cevaplar, [{"soru": self.SORU, "cevap": "durum_gecisleri adı kullanılır",
                                     "onay": "kullanıcı onayıyla"}])
        self.assertIn("Cevap (kullanıcı onayıyla): durum_gecisleri adı kullanılır", gorev._cevaplar(kayit(kok, kimlik)))

    def test_isaretsiz_ya_da_farkli_cevapla_kayda_gecmez(self):
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, self.SORU)
        r = cli(kok, "gorev", "kos", kimlik, "--cevap", "sorulmamış cevap")
        self.assertEqual(r.returncode, 2)
        self.assertIn("cevabı yalnız kullanıcı verir ve soru sorulmadan cevap kayda geçmez", r.stderr)
        komut(kok, 'python3 harness/h.py gorev kos %s --cevap "sorulan cevap"' % kimlik)   # kullanıcı reddetti
        r = cli(kok, "gorev", "kos", kimlik, "--cevap", "başka cevap")
        self.assertEqual(r.returncode, 2)
        self.assertFalse((kayit(kok, kimlik) / "cevaplar.json").exists())
        self.assertEqual(json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))["durum"], "soru")
        with self.assertRaisesRegex(h.HarnessHata, "açık uca dayanıyor"):   # doğrudan çağrı da onaysız kaydetmez
            sessiz(gorev.kos, kok, kimlik, cevap="x")
        c = ajan_hook.isle("komut-oncesi", {"session_id": "s1", "cwd": str(kok), "permission_mode": "dontAsk",
                                            "tool_input": {"command": "python3 harness/h.py gorev kos %s --cevap x"
                                                           % kimlik}}, {})
        self.assertEqual(karar(c), "deny")

    def test_cevaplanmamis_acik_uc_sorusunda_notla_ya_da_cevapsiz_kosmaz(self):
        """İnceleme engeli: açık uç sorusunu ana oturum notla cevaplayamaz; kanca da araç da reddeder."""
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, self.SORU)
        bas = "python3 harness/h.py gorev kos %s" % kimlik
        for ek in (' --not "tablo adı durum_gecisleri olsun"', "", " --taslakla"):
            c = komut(kok, bas + ek)
            self.assertEqual(karar(c), "deny", ek)
            for parca in ("KR-001/AU-1", "Açık uç sorusu kullanıcıya gider", "--cevap"):
                self.assertIn(parca, gerekce(c))
        for ek in (["--not", "tablo adı durum_gecisleri olsun"], []):
            r = cli(kok, "gorev", "kos", kimlik, *ek)
            self.assertEqual(r.returncode, 2, ek)
            self.assertIn("Açık uç sorusu kullanıcıya gider", r.stderr)
        with self.assertRaisesRegex(h.HarnessHata, "soru cevaplanana kadar reddedilir"):
            sessiz(gorev.kos, kok, kimlik, notu="x")
        self.assertFalse((kayit(kok, kimlik) / "notlar.json").exists())
        self.assertEqual(json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8"))["durum"], "soru")
        # yeşil: kullanıcı onaylı cevapla koşar (not da birlikte verilebilir)
        komut(kok, bas + ' --cevap "durum_gecisleri" --not "önce test"')
        r = cli(kok, "gorev", "kos", kimlik, "--cevap", "durum_gecisleri", "--not", "önce test")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(gorev.bekleyen_acik_uclar(kok, kimlik), [])

    def test_kimlik_tasimayan_soruda_not_bugunku_gibidir(self):
        kok = deposu(onay="yok")
        kimlik = soran_gorev(kok, "Hangi dosya adı?")
        self.assertIsNone(komut(kok, 'python3 harness/h.py gorev kos %s --not "a.ts kullan"' % kimlik))
        rapor, _ = sessiz(gorev.kos, kok, kimlik, notu="a.ts kullan")
        self.assertEqual(rapor["durum"], "tamam", rapor)

    def test_ucbirimde_arac_kendisi_sorar(self):
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU})
        kimlik = soran_gorev(kok, self.SORU)
        ucbirim = mock.Mock()
        ucbirim.stdin.isatty.return_value = ucbirim.stdout.isatty.return_value = True
        with mock.patch.object(gorev, "sys", ucbirim), mock.patch("builtins.input", return_value="hayır"):
            with self.assertRaisesRegex(h.HarnessHata, "kullanıcı cevabı onaylamadı"):
                sessiz(gorev.komut, kok, ["kos", kimlik, "--cevap", "c"])
        self.assertFalse((kayit(kok, kimlik) / "cevaplar.json").exists())
        with mock.patch.object(gorev, "sys", ucbirim), mock.patch("builtins.input", return_value="evet"):
            kod, cikti = sessiz(gorev.komut, kok, ["kos", kimlik, "--cevap", "c"])
        self.assertEqual(kod, 0)
        self.assertIn("açık uç: KR-001/AU-1 — Tablonun adı ne olacak?\nverilecek cevap: c", cikti)
        self.assertEqual(json.loads((kayit(kok, kimlik) / "cevaplar.json").read_text(encoding="utf-8"))["cevaplar"][0]
                         ["onay"], "kullanıcı onayıyla")

    def test_kimlik_tasimayan_soruda_kanca_bugunku_gibidir(self):
        kok = deposu(onay="yok")
        kimlik = soran_gorev(kok, "Hangi dosya adı?")
        self.assertIsNone(komut(kok, 'python3 harness/h.py gorev kos %s --cevap "a.ts"' % kimlik))
        _, cikti = sessiz(gorev.komut, kok, ["durum"])
        self.assertIn("[yarım kaldı (soru)]", cikti)
        kod, _ = sessiz(gorev.komut, kok, ["kos", kimlik, "--cevap", "a.ts"])
        self.assertEqual(kod, 0)
        self.assertEqual(json.loads((kayit(kok, kimlik) / "cevaplar.json").read_text(encoding="utf-8"))["cevaplar"],
                         [{"soru": "Hangi dosya adı?", "cevap": "a.ts"}])
        kok = deposu()   # varsayılan onay: soru bugünkü koşturma sorusudur
        kimlik = soran_gorev(kok, "Hangi dosya adı?")
        c = komut(kok, 'python3 harness/h.py gorev kos %s --cevap "a.ts"' % kimlik)
        self.assertTrue(gerekce(c).startswith("[harness] " + ajan_hook.GOREV_SORUSU["kos"]))


class Isaret(unittest.TestCase):
    """Ana oturumun notu: izin işareti komutun özetine bağlıdır; reddedilmiş sorunun işaretiyle farklı biçimli komut
    koşmaz; kancanın çözümleyemediği komutta işaret yazılmaz."""

    def test_reddedilmis_taslak_izninin_isaretiyle_farkli_komut_kosmaz(self):
        kok = deposu({"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL})
        kimlik = kart_ac(kok)
        c = komut(kok, 'python3 harness/h.py gorev kos %s --taslakla --not "önce testler"' % kimlik)
        self.assertEqual(karar(c), "ask")   # kullanıcı reddetti: komut koşmadı, işaret duruyor
        self.assertTrue(gorev._izin_isareti(kok, kimlik).exists())
        r = cli(kok, "gorev", "kos", kimlik, "--taslakla")   # kancanın görmediği, farklı biçimli komut
        self.assertEqual(r.returncode, 2)
        self.assertIn("izin sorusu sorulmadan --taslakla kullanılamaz", r.stderr)
        self.assertNotIn("taslak_izinleri", json.loads((kayit(kok, kimlik) / "durum.json").read_text(encoding="utf-8")))
        r = cli(kok, "gorev", "kos", kimlik, "--taslakla", "--not", "önce testler")   # sorulan komutun kendisi koşar
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_cozumlenemeyen_komutta_isaret_yazilmaz(self):
        kok = deposu({"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL})
        kimlik = kart_ac(kok)
        c = komut(kok, "python3 harness/h.py gorev kos %s --taslakla --not 'kapanmayan" % kimlik)
        self.assertEqual(karar(c), "deny")   # ana oturumun notu: çözümlenemeyen izinli komut reddedilir
        self.assertIn("Komut çözümlenemedi", gerekce(c))
        self.assertFalse(gorev._izin_isareti(kok, kimlik).exists())

    def test_ozet_yonlendirme_ve_satir_devamindan_etkilenmez(self):
        bas = ["gorev", "kos", "GV-001", "--cevap", "a > b; c", "--taslakla"]
        for metin in ('python3 harness/h.py gorev kos GV-001 --cevap "a > b; c" --taslakla 2>&1 | tail -5',
                      'cd /x && python3 "harness/h.py" gorev kos GV-001 \\\n  --cevap \'a > b; c\' --taslakla >/dev/null'):
            self.assertEqual(ajan_hook._arac_cagrilari(metin), [bas], metin)
        self.assertEqual(len(ajan_hook._arac_cagrilari("python3 harness/h.py gorev kos GV-001; python3 harness/h.py "
                                                       "gorev kos GV-001 --taslakla")), 2)
        self.assertIsNone(ajan_hook._arac_cagrilari("python3 harness/h.py gorev kos GV-001 --not 'kapanmayan"))
        # tırnaklı değer sözcükte kalır; tırnak dışındaki yönlendirme ve ayırıcı çağrıyı bitirir
        for metin, son in (('python3 harness/h.py gorev kos GV-001 --cevap ">5" 2>/dev/null', ">5"),
                           ("python3 harness/h.py gorev kos GV-001 --cevap '3>2 olsun' > /tmp/x", "3>2 olsun"),
                           ('python3 harness/h.py gorev kos GV-001 --cevap ";" ; ls', ";"),
                           ("python3 harness/h.py gorev kos GV-001 --cevap a\\>b", "a>b"),
                           ("python3 harness/h.py gorev kos GV-001 --cevap x2>f", "x2"),
                           ("python3 harness/h.py gorev kos GV-001 --cevap x 2>f", "x")):
            self.assertEqual(ajan_hook._arac_cagrilari(metin), [["gorev", "kos", "GV-001", "--cevap", son]], metin)

    def test_tirnakli_buyuktur_iceren_cevap_isaret_uretir(self):
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, "Tablo adı karara bağlanmamış (KR-001/AU-1): hangisi?")
        c = komut(kok, "python3 harness/h.py gorev kos %s --cevap '>5 sütun; adı durum' 2>&1" % kimlik)
        self.assertEqual(karar(c), "ask")
        self.assertIn("verilecek cevap: >5 sütun; adı durum", gerekce(c))
        r = cli(kok, "gorev", "kos", kimlik, "--cevap", ">5 sütun; adı durum")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


class Tanima(unittest.TestCase):
    """İkinci incelemenin engelleri (ana oturumun yönü): işaretin dosya adı yalnız doğrulanmış kimlikten kurulur;
    kanca izin isteyen komutu kabuk sözcüklerinden tanır; yeni soru aynı tür ve hedefin eski işaretini siler."""

    def test_yol_disina_cikan_kimlikle_dosya_olusmaz(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False, onay="yok")
        klasor = h.ortak_kok(kok) / ".harness" / "onay"
        kacak = "../../../../%s-kacak" % kok.name
        hedefler = (kacak, "TS-001/../../x", "/tmp/%s-mutlak" % kok.name, "TS-001/x", "ts-001", "TS-001\n", "")
        for hedef in hedefler:
            for islev, ek in ((h.izin_yaz, ("ozet",)), (h.izin_tuket, ("ozet",)), (h.izin_sil, ())):
                with self.assertRaisesRegex(h.HarnessHata, "hedefi geçersiz", msg=repr(hedef)):
                    islev(kok, "acik-uc-kapat", hedef, *ek)
        for metin in ("python3 harness/h.py acik-uc kapat %s AU-1 --karar x" % kacak,
                      "python3 harness/h.py acik-uc kapat '/tmp/%s-mutlak' AU-1 --karar x" % kok.name,
                      "python3 harness/h.py acik-uc kapat TS-001/x AU-1 --karar x",
                      "python3 harness/h.py gorev kos ../GV-001 --cevap x",
                      "python3 harness/h.py gorev kos GV-001/../../x --taslakla",
                      "python3 harness/h.py plan yurut ../EP-001 --taslakla"):
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)
        self.assertFalse(klasor.exists())
        for hedef in hedefler[:4]:
            self.assertFalse(os.path.exists(os.path.normpath(str(klasor / ("acik-uc-kapat-%s.json" % hedef)))), hedef)
        self.assertFalse((kok.parent / ("%s-kacak.json" % kok.name)).exists())
        r = cli(kok, "acik-uc", "kapat", kacak, "AU-1", "--karar", "x")   # araç da okumaz
        self.assertEqual(r.returncode, 2)
        self.assertIn("hedefi geçersiz", r.stderr)
        self.assertFalse(klasor.exists())

    def test_tirnakli_alt_komut_ve_kimlik_ayni_karari_alir(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False, onay="yok")
        argv = ["acik-uc", "kapat", "TS-001", "AU-1", "--karar", "Hayır"]
        isaret = h.izin_isareti(kok, "acik-uc-kapat", "TS-001")
        for metin in ('python3 harness/h.py acik-uc "kapat" TS-001 AU-1 --karar Hayır',
                      "python3 harness/h.py 'acik-uc' kapat \"TS-001\" AU-1 --karar 'Hayır'",
                      "python3 harness/h.py acik-uc \\\n  kapat TS-001 AU-1 --karar Hayır",
                      "time env A=1 python3 ./harness/h.py acik-uc kapat TS-001 AU-1 --karar Hayır",
                      "bash -c 'python3 harness/h.py acik-uc \"kapat\" TS-001 AU-1 --karar Hayır'",
                      'echo "$(python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar Hayır)"',
                      "eval python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar Hayır"):
            isaret.unlink(missing_ok=True)
            c = komut(kok, metin)
            self.assertEqual(karar(c), "ask", metin)
            self.assertIn("yazılacak karar: Hayır", gerekce(c), metin)
            self.assertEqual(json.loads(isaret.read_text(encoding="utf-8"))["ozet"], h.komut_ozeti(argv), metin)
        kimlik = kart_ac(kok)
        c = komut(kok, 'python3 harness/h.py gorev "at" "%s"' % kimlik)   # atma onay 'yok' iken de sorulur
        self.assertEqual(karar(c), "ask")
        self.assertIn(ajan_hook.GOREV_SORUSU["at"], gerekce(c))
        kok = deposu({"kb/karar/KR-002-iptal.md": TASLAK_KARAR}, git_li=False)
        c = komut(kok, "python3 harness/h.py 'kabul' KR-002")
        self.assertEqual(karar(c), "ask")
        self.assertIn("KR-002", gerekce(c))

    def test_tirnakli_cevap_komutu_sorulur(self):
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, Soru.SORU)
        c = komut(kok, "python3 harness/h.py gorev 'kos' \"%s\" --cevap durum_gecisleri" % kimlik)
        self.assertEqual(karar(c), "ask")
        self.assertIn("verilecek cevap: durum_gecisleri", gerekce(c))
        c = komut(kok, "python3 harness/h.py \"gorev\" 'kos' %s --not 'adı durum olsun'" % kimlik)
        self.assertEqual(karar(c), "deny")
        self.assertIn("Açık uç sorusu kullanıcıya gider", gerekce(c))

    def test_reddedilmis_sorunun_ardindan_tirnakli_bicim_yeniden_sorulur(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False, onay="yok")
        once = metin(kok, "kb/tasarim/TS-001-iptal.md")
        isaret = h.izin_isareti(kok, "acik-uc-kapat", "TS-001")
        self.assertEqual(karar(komut(kok, "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar A")), "ask")  # reddedildi
        c = komut(kok, 'python3 harness/h.py acik-uc "kapat" TS-001 AU-1 --karar A')   # sorusuz geçmez
        self.assertEqual(karar(c), "ask")
        self.assertIn("yazılacak karar: A", gerekce(c))
        # yeni soru aynı hedefin eski işaretini geçersiz kılar: reddedilen A, B sorusundan sonra koşmaz
        komut(kok, "python3 harness/h.py acik-uc 'kapat' TS-001 AU-1 --karar B")
        self.assertEqual(json.loads(isaret.read_text(encoding="utf-8"))["ozet"], h.komut_ozeti(
            ["acik-uc", "kapat", "TS-001", "AU-1", "--karar", "B"]))
        self.assertEqual(cli(kok, "acik-uc", "kapat", "TS-001", "AU-1", "--karar", "A").returncode, 2)
        self.assertEqual(metin(kok, "kb/tasarim/TS-001-iptal.md"), once)
        # taslak izni: bayrağı çağrının dışında olan (fazladan) soru da eski işareti siler
        kok = deposu({"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL})
        kimlik = kart_ac(kok)
        komut(kok, 'python3 harness/h.py gorev kos %s --taslakla --not "x"' % kimlik)   # reddedildi
        self.assertTrue(gorev._izin_isareti(kok, kimlik).exists())
        self.assertEqual(karar(komut(kok, "python3 harness/h.py gorev kos %s; echo --taslakla" % kimlik)), "ask")
        self.assertFalse(gorev._izin_isareti(kok, kimlik).exists())
        self.assertEqual(cli(kok, "gorev", "kos", kimlik, "--taslakla", "--not", "x").returncode, 2)

    def test_cozumlenemeyen_izinli_komut_reddedilir(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU, "kb/karar/KR-002-iptal.md": TASLAK_KARAR},
                     git_li=False, onay="yok")
        for metin in ("python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar 'x",
                      "python3 harness/h.py gorev 'at GV-001",
                      "python3 harness/h.py kabul KR-002 \"",
                      'echo "$(python3 harness/h.py gorev kos GV-001 --cevap \'x)"'):
            c = komut(kok, metin)
            self.assertEqual(karar(c), "deny", metin)
            self.assertIn("Komut çözümlenemedi", gerekce(c), metin)
        self.assertFalse((h.ortak_kok(kok) / ".harness" / "onay").exists())
        # yeşil: izin istemeyen çözümlenemeyen komut ve aracın adını taşımayan komut kapıya takılmaz
        self.assertIsNone(komut(kok, "python3 harness/h.py durum 'x"))
        self.assertIsNone(komut(kok, "echo 'kapat"))

    def test_tek_komutta_birden_cok_gorev_islemi_reddedilir(self):
        """Tanıma bütün çağrılara bakar: ilki sorulmayan işlemin ardındaki ikinci işlem sorusuz geçmez."""
        kok = deposu(git_li=False)
        kimlik = kart_ac(kok)
        self.assertIsNone(komut(kok, "python3 harness/h.py gorev incele %s" % kimlik))
        c = komut(kok, "python3 harness/h.py gorev incele %s && python3 harness/h.py gorev al %s" % (kimlik, kimlik))
        self.assertEqual(karar(c), "deny")
        self.assertIn("tek çağrı", gerekce(c))

    def test_isaret_omru_ve_ozeti_eslesen_suresi_gecmis_isaret(self):
        """İnceleme önerisi: özeti eşleşen ama süresi geçmiş işaret geçmez (taslak izni, cevap, kapatma)."""
        self.assertEqual(h.IZIN_SURESI_SN, 120)
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, git_li=False)
        argv = ["acik-uc", "kapat", "TS-001", "AU-1", "--karar", "x"]
        h.izin_yaz(kok, "acik-uc-kapat", "TS-001", h.komut_ozeti(argv), simdi=time.time() - h.IZIN_SURESI_SN - 5)
        self.assertEqual(cli(kok, *argv).returncode, 2)
        self.assertFalse(h.izin_isareti(kok, "acik-uc-kapat", "TS-001").exists())   # süresi geçen silinir
        h.izin_yaz(kok, "acik-uc-kapat", "TS-001", h.komut_ozeti(argv), simdi=time.time() - h.IZIN_SURESI_SN + 30)
        self.assertEqual(cli(kok, *argv).returncode, 0)   # yeşil: süresi içinde geçer
        kok = deposu({"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL})
        kimlik = kart_ac(kok)
        gorev.taslak_izni_yaz(kok, kimlik, ["KU-002", "KR-002"], simdi=time.time() - h.IZIN_SURESI_SN - 5,
                              ozet=h.komut_ozeti(["gorev", "kos", kimlik, "--taslakla"]))
        r = cli(kok, "gorev", "kos", kimlik, "--taslakla")
        self.assertEqual(r.returncode, 2)
        self.assertIn("izin sorusu sorulmadan --taslakla kullanılamaz", r.stderr)
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, Soru.SORU)
        h.izin_yaz(kok, "cevap", kimlik, h.komut_ozeti(["gorev", "kos", kimlik, "--cevap", "c"]),
                   simdi=time.time() - h.IZIN_SURESI_SN - 5)
        self.assertEqual(cli(kok, "gorev", "kos", kimlik, "--cevap", "c").returncode, 2)
        self.assertFalse((kayit(kok, kimlik) / "cevaplar.json").exists())

    def test_kapanmis_gorevde_acik_uc_sorusu_sorulmaz(self):
        """İnceleme önerisi: kanca da araç gibi önce kapanmışlığa bakar; ölü görev için kullanıcıya karar sorulmaz."""
        kok = deposu({"kb/karar/KR-001-durum-tablosu.md": KR_UCLU}, onay="yok")
        kimlik = soran_gorev(kok, Soru.SORU)
        sessiz(gorev.at, kok, kimlik)
        self.assertIsNone(komut(kok, "python3 harness/h.py gorev kos " + kimlik))
        self.assertIsNone(komut(kok, "python3 harness/h.py gorev kos %s --cevap c" % kimlik))
        self.assertFalse(h.izin_isareti(kok, "cevap", kimlik).exists())
        r = cli(kok, "gorev", "kos", kimlik, "--cevap", "c")   # araç da koşturmaz, cevap kayda geçmez
        self.assertEqual(r.returncode, 2)
        self.assertFalse((kayit(kok, kimlik) / "cevaplar.json").exists())


def cift_tire(kabuk, govde):
    """Kabuk `--` sonrasındaki metni koşturur."""
    return "%s -c -- '%s'" % (kabuk, govde)


def yorumlayici(govde):
    """Kabuk olmayan bir yorumlayıcının -c metni: sözcük ağı görmez, metin ağı görür."""
    return 'python3 -c "import os; os.system(\'%s\')"' % govde


class Birlesim(unittest.TestCase):
    """Üçüncü incelemenin engeli (ana oturumun yönü): tanıma iki ağın birleşimidir. Sözcük ağı kabukta `-c --`
    biçimini de görür; metin ağı her zaman koşar. Yalnız metin ağının gördüğü işlemde eski kancanın kararı verilir,
    izin işareti isteyen işlem reddedilir."""

    BICIMLER = (lambda g: cift_tire("bash", g), lambda g: cift_tire("sh", g), lambda g: cift_tire("zsh", g),
                yorumlayici)

    def test_cift_tire_ve_yorumlayici_metni_eski_karari_alir(self):
        kok = deposu(git_li=False)   # varsayılan onay: koşturma, alma sorulur; inceleme sorulmaz
        kimlik = kart_ac(kok)
        plan_kur(kok)
        yaprak(kok)
        for bicim in self.BICIMLER:
            for islem in ("at", "al", "kos"):
                c = komut(kok, bicim("python3 harness/h.py gorev %s %s" % (islem, kimlik)))
                self.assertEqual(karar(c), "ask", (bicim(""), islem))
                self.assertIn(ajan_hook.GOREV_SORUSU[islem], gerekce(c))
            self.assertIsNone(komut(kok, bicim("python3 harness/h.py gorev incele " + kimlik)))
            c = komut(kok, bicim("python3 harness/h.py plan yurut EP-001"))
            self.assertEqual(karar(c), "ask", bicim(""))
            self.assertIn("Bu epic baştan sona yürütülecek", gerekce(c))
        kok = deposu(git_li=False, onay="yok")   # onay 'yok': yalnız atma sorulur
        kimlik = kart_ac(kok)
        plan_kur(kok)
        yaprak(kok)
        for bicim in self.BICIMLER:
            self.assertEqual(karar(komut(kok, bicim("python3 harness/h.py gorev at " + kimlik))), "ask", bicim(""))
            for govde in ("gorev al " + kimlik, "gorev kos " + kimlik, "plan yurut EP-001"):
                self.assertIsNone(komut(kok, bicim("python3 harness/h.py " + govde)), (bicim(""), govde))

    def test_gorunur_islemin_ardindaki_gizli_islem_sorusuz_gecmez(self):
        """İncelemenin örneği: sorulmayan incelemenin yanında yorumlayıcı metnindeki atma görülür."""
        kok = deposu(git_li=False)
        kimlik = kart_ac(kok)
        gizli = yorumlayici("python3 harness/h.py gorev at " + kimlik)
        c = komut(kok, "python3 harness/h.py gorev incele %s; %s" % (kimlik, gizli))
        self.assertEqual(karar(c), "deny")
        self.assertIn("tek çağrı", gerekce(c))

    def test_izin_isareti_isteyen_islem_yalniz_metin_aginda_reddedilir(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU, "kb/karar/KR-002-iptal.md": TASLAK_KARAR},
                     git_li=False, onay="yok")
        kimlik = kart_ac(kok)
        plan_kur(kok)
        yaprak(kok)
        onay = h.ortak_kok(kok) / ".harness" / "onay"
        for govde in ("kabul KR-002", "acik-uc kapat TS-001 AU-1 --karar x", "gorev kos %s --taslakla" % kimlik,
                      "gorev kos %s --cevap x" % kimlik, "plan yurut EP-001 --taslakla"):
            c = komut(kok, yorumlayici("python3 harness/h.py " + govde))
            self.assertEqual(karar(c), "deny", govde)
            self.assertIn("Komutu düz biçimde yaz", gerekce(c), govde)
            self.assertFalse(onay.exists(), govde)   # işaret yazılmadı
        # yeşil: aynı işlem kabukta `-c --` biçiminde sözcük ağına görünür, sorulur ve işaret çağrının özetine bağlanır
        c = komut(kok, cift_tire("bash", "python3 harness/h.py acik-uc kapat TS-001 AU-1 --karar x"))
        self.assertEqual(karar(c), "ask")
        self.assertEqual(json.loads(h.izin_isareti(kok, "acik-uc-kapat", "TS-001").read_text(encoding="utf-8"))
                         ["ozet"], h.komut_ozeti(["acik-uc", "kapat", "TS-001", "AU-1", "--karar", "x"]))
        c = komut(kok, cift_tire("sh", "python3 harness/h.py kabul KR-002"))
        self.assertEqual(karar(c), "ask")
        self.assertIn("KR-002", gerekce(c))


class Gorunurluk(unittest.TestCase):
    """e, f, h) durum ve oturum başı sayıyı taşır; taslak engeli ve --taslakla sorusu taslakların açık uçlarını sayar."""

    def test_durum_ve_oturum_basi(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU, "kb/karar/KR-001-durum-tablosu.md": KR_UCLU})
        r = cli(kok, "durum")
        self.assertIn("  açık uç: 3 (KR-001 1, TS-001 2) — liste: python3 harness/h.py acik-uc\n", r.stdout)
        b = baglam(ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok)}, {}))
        self.assertIn("Açık uç: 3 (KR-001 1, TS-001 2).", b)
        kok = deposu()
        self.assertNotIn("açık uç", cli(kok, "durum").stdout)
        self.assertNotIn("Açık uç", baglam(ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok)}, {})))

    def test_taslak_engeli_ve_izin_sorusu_acik_uclari_sayar(self):
        kok = deposu({"kb/tasarim/TS-001-iptal.md": TS_UCLU}, onay="yok")
        kimlik = kart_ac(kok, dayanak=["TS-001"])
        with self.assertRaises(h.HarnessHata) as e:
            sessiz(gorev.kos, kok, kimlik)
        for parca in ("1 taslak (2 açık uç)", "TS-001 İptal akışının tasarımı (taslak)\n      TS-001/AU-1: İptal geri "
                      "alınabilir mi?\n      TS-001/AU-2: Kısmi iptal var mı?"):
            self.assertIn(parca, str(e.exception))
        c = komut(kok, "python3 harness/h.py gorev kos %s --taslakla" % kimlik)
        self.assertIn("işe düşen 1 taslak (2 açık uç):", gerekce(c))
        self.assertIn("TS-001/AU-2: Kısmi iptal var mı?", gerekce(c))
        sessiz(plan.space, kok, "Sipariş", amac="A.", yollar=["src/siparis/**"])
        sessiz(plan.epic, kok, "siparis", "İptal", hedef="H.", dayanak=["TS-001"])
        sessiz(plan.task, kok, "EP-001", "Yaprak", hedef=HEDEF, olcut=OLCUT)
        c = komut(kok, "python3 harness/h.py plan yurut EP-001 --taslakla")
        self.assertIn("TS-001/AU-1: İptal geri alınabilir mi?", gerekce(c))


class BuDepo(unittest.TestCase):
    """h) Bu depoda `acik-uc` çıktısı yazılır (yalnız okur; gerçek kayıtlara yazmaz)."""

    def test_bu_depoda_liste(self):
        kok = BURASI.parents[1]
        r = cli(kok, "acik-uc")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertRegex(r.stdout, r"\d+ açık uç")

    def test_plan_skill_acik_uc_sorusunda_not_vermez(self):
        """İnceleme önerisi: duran yaprak adımı açık uç sorusunu kullanıcıya götürür, not önermez."""
        adim = next(s for s in (BURASI.parents[1] / ".claude/skills/plan/SKILL.md").read_text(encoding="utf-8")
                    .split("\n") if s.startswith("12. "))
        self.assertIn("açık uca dayanan soruyla durduysa (`yarım kaldı (soru: kullanıcıya)`) not verilmez", adim)
        self.assertIn('`gorev kos GV-NNN --cevap "..."`', adim)


if __name__ == "__main__":
    unittest.main(verbosity=1)
