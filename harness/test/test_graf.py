#!/usr/bin/env python3
"""graf.py testleri: zincirin türetilmiş görünümleri (SQLite dizini, sorgu, etki, çizim).

Koşum: python3 harness/test/test_graf.py
Her test geçici bir depo kurar; gerçek bilgi tabanına dokunmaz.
"""
from __future__ import annotations

import pathlib
import sqlite3
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import graf  # noqa: E402
from test_h import BUGUN, KARAR, KURAL, YAPI, depo, git_depo  # noqa: E402

# Karara doğrudan dayanmaz: ona yalnız yapı üzerinden bağlanır (çok adımlı yolun sınanması için).
KURAL_YAPIDAN = (KURAL.replace("KU-001", "KU-002").replace("kapsam: [src/siparis/**]", "kapsam: [YP-001, docs/**]")
                 .replace("baslik: Durum yalnız tablodan değişir", "baslik: Yapıdan gelen kural")
                 .replace("dayanak: [KR-001@1]\n", ""))
KURAL_DENETIMLI = KURAL.replace("denetim_duzey: gozden-gecirme", "denetim_duzey: mekanik\ndenetim_ref: [DN-001]")
KURAL_TASLAK = (KURAL.replace("KU-001", "KU-003").replace("durum: kabul", "durum: taslak")
                .replace("dayanak: [KR-001@1]", "dayanak: [KR-001@1]\nrol: [uygulayici, inceleyici]"))
YAPI_DAYANAKLI = YAPI.replace("katman: alan\n", "katman: alan\ndayanak: [KR-001@1]\n")
YAPI_ODEME = (YAPI.replace("YP-001", "YP-002").replace("baslik: siparis", "baslik: odeme")
              .replace("src/siparis/**", "src/odeme/**").replace("katman: alan\n", "katman: alan\nbagimli: [YP-001]\n"))
DENETIM = ("---\nkimlik: DN-001\ntur: denetim\ndurum: kabul\nsurum: 1\nbaslik: Tablo denetimi\n---\n"
           "Geçişlerin tablodan geçtiğini sınar.\n")
TASARIM = ("---\nkimlik: TS-001\ntur: tasarim\ndurum: kabul\nsurum: 1\nbaslik: Sipariş tasarımı\n"
           "agirlik: cift-yonlu\n---\nSipariş akışının tasarımı.\n")
KARAR_BAGLAMLI = KARAR.replace("tip: mimari\n", "tip: mimari\nbaglam: TS-001\n")


def zengin_depo(**ek):
    """Karar ← tasarım, karar → yapı → kural, kural → denetim: birden çok adımlı bir zincir."""
    dosyalar = {"kb/karar/KR-001-durum-tablosu.md": KARAR_BAGLAMLI,
                "kb/kural/KU-001-durum-tablodan.md": KURAL_DENETIMLI,
                "kb/kural/KU-002-yapidan.md": KURAL_YAPIDAN,
                "kb/yapi/YP-001-siparis.md": YAPI_DAYANAKLI,
                "kb/yapi/YP-002-odeme.md": YAPI_ODEME,
                "kb/denetim/DN-001-tablo.md": DENETIM,
                "kb/tasarim/TS-001-siparis.md": TASARIM,
                "src/siparis/olustur.ts": "export const y = 2\n",
                "src/odeme/tahsil.ts": "export const z = 3\n",
                "docs/not.md": "not\n"}
    dosyalar.update(ek)
    return depo(dosyalar, uret=False)


def satirlar(kok, sql, *p):
    return graf.sorgu(kok, sql, p)[1]


class Kenarlar(unittest.TestCase):
    def test_kuralin_dayanagi_surumuyle_kenardir(self):
        self.assertIn(("KU-001", "dayanak", "KR-001", 1), graf.kenarlar(h.Dizin(depo())))

    def test_kapsamdaki_yapi_kimligi_kenardir_yol_deseni_degildir(self):
        k = graf.kenarlar(h.Dizin(zengin_depo()))
        self.assertIn(("KU-002", "kapsam", "YP-001", None), k)
        self.assertEqual([x for x in k if x[2] == "docs/**"], [])

    def test_denetim_bagimlilik_ve_baglam_kenardir(self):
        k = graf.kenarlar(h.Dizin(zengin_depo()))
        for beklenen in (("KU-001", "denetim_ref", "DN-001", None), ("YP-002", "bagimli", "YP-001", None),
                         ("KR-001", "baglam", "TS-001", None), ("YP-001", "dayanak", "KR-001", 1)):
            self.assertIn(beklenen, k)

    def test_yerine_ve_celiski_kenardir(self):
        ezilen = KURAL.replace("KU-001", "KU-009").replace("durum: kabul", "durum: ezildi\nyerine: KU-001")
        celisen = KURAL.replace("KU-001", "KU-008").replace("bicim: kural", "bicim: kural\ncelisir: [KU-001]")
        k = graf.kenarlar(h.Dizin(depo({"kb/kural/KU-009-eski.md": ezilen, "kb/kural/KU-008-celisen.md": celisen})))
        self.assertIn(("KU-009", "yerine", "KU-001", None), k)
        self.assertIn(("KU-008", "celisir", "KU-001", None), k)


class DizinTablolari(unittest.TestCase):
    def test_dugumler_taslaklar_dahil_dizindedir(self):
        kok = zengin_depo(**{"kb/kural/KU-003-taslak.md": KURAL_TASLAK})
        s = dict(satirlar(kok, "select kimlik, durum from dugum"))
        self.assertEqual(s["KU-003"], "taslak")
        self.assertEqual(s["KR-001"], "kabul")
        self.assertEqual(len(s), 8)

    def test_dugumun_turu_basligi_ve_ifadesi_dizindedir(self):
        s = satirlar(depo(), "select tur, surum, baslik, ifade, yol from dugum where kimlik = 'KU-001'")
        self.assertEqual(s, [("kural", 1, "Durum yalnız tablodan değişir",
                              "Durumu değiştiren her kod yolu geçiş tablosundan geçer.",
                              "kb/kural/KU-001-durum-tablodan.md")])

    def test_kuralin_deseni_ve_eslesen_dosyalari_dizindedir(self):
        kok = zengin_depo()
        self.assertEqual(satirlar(kok, "select desen from desen where dugum = 'KU-001'"), [("src/siparis/**",)])
        self.assertEqual(satirlar(kok, "select yol from dosya where dugum = 'KU-001' order by yol"),
                         [("src/siparis/iptal.ts",), ("src/siparis/olustur.ts",)])

    def test_yapi_uzerinden_gelen_kapsam_dosyaya_kadar_cozulur(self):
        yollar = [s[0] for s in satirlar(zengin_depo(), "select yol from dosya where dugum = 'KU-002' order by yol")]
        self.assertEqual(yollar, ["docs/not.md", "src/siparis/iptal.ts", "src/siparis/olustur.ts"])

    def test_yapinin_dosyalari_da_dizindedir(self):
        self.assertEqual(satirlar(zengin_depo(), "select yol from dosya where dugum = 'YP-002'"),
                         [("src/odeme/tahsil.ts",)])

    def test_baslik_alanlari_tek_tek_sorgulanir(self):
        kok = zengin_depo(**{"kb/kural/KU-003-taslak.md": KURAL_TASLAK})
        self.assertEqual(satirlar(kok, "select dugum from alan where ad = 'rol' and deger = 'inceleyici'"),
                         [("KU-003",)])

    def test_kenarlar_tabloda_surumuyle_durur(self):
        self.assertEqual(satirlar(depo(), "select kaynak, bag, hedef, surum from kenar"),
                         [("KU-001", "dayanak", "KR-001", 1)])


class DizinDosyasi(unittest.TestCase):
    def test_dizin_dosyasi_yazilir_ve_baska_aracla_okunur(self):
        kok = zengin_depo()
        yol = graf.yaz(kok)
        self.assertEqual(yol, kok / ".harness" / "dizin.db")
        b = sqlite3.connect(str(yol))
        try:
            self.assertEqual(b.execute("select count(*) from dugum").fetchone()[0], 7)
        finally:
            b.close()

    def test_dizin_her_yazista_bastan_kurulur(self):
        kok = zengin_depo()
        graf.yaz(kok)
        (kok / "kb/kural/KU-003-taslak.md").write_text(KURAL_TASLAK, encoding="utf-8")
        (kok / "kb/denetim/DN-001-tablo.md").unlink()
        b = sqlite3.connect(str(graf.yaz(kok)))
        try:
            kimlikler = {s[0] for s in b.execute("select kimlik from dugum")}
        finally:
            b.close()
        self.assertIn("KU-003", kimlikler)
        self.assertNotIn("DN-001", kimlikler)

    def test_dizin_kaynagin_imzasini_tasir(self):
        kok = zengin_depo()
        onceki = dict(satirlar(kok, "select anahtar, deger from meta"))["imza"]
        self.assertEqual(onceki, graf.imza(kok))
        (kok / "kb/denetim/DN-001-tablo.md").write_text(DENETIM.replace("sınar", "ölçer"), encoding="utf-8")
        self.assertNotEqual(graf.imza(kok), onceki)

    def test_git_deposunda_dizin_commit_kimligini_tasir(self):
        kok = git_depo(zengin_depo())
        commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=kok, capture_output=True, text=True).stdout.strip()
        self.assertEqual(dict(satirlar(kok, "select anahtar, deger from meta"))["commit"], commit)

    def test_dizin_bilgi_tabanina_ve_izlenen_dosyalara_dokunmaz(self):
        kok = git_depo(zengin_depo())
        graf.yaz(kok)
        graf.sorgu(kok, "select 1")
        self.assertEqual(subprocess.run(["git", "status", "--porcelain"], cwd=kok, capture_output=True,
                                        text=True).stdout, "")


class Sorgu(unittest.TestCase):
    def test_sorgu_sutun_adlarini_ve_satirlari_doner(self):
        basliklar, s = graf.sorgu(depo(), "select kimlik, tur from dugum where tur = ? order by kimlik", ("karar",))
        self.assertEqual(basliklar, ["kimlik", "tur"])
        self.assertEqual(s, [("KR-001", "karar")])

    def test_cok_adimli_soru_tek_sorguyla_cevaplanir(self):
        sql = ("with recursive z(k) as (select 'TS-001' union select kaynak from kenar join z on hedef = k) "
               "select k from z order by k")
        self.assertEqual([s[0] for s in satirlar(zengin_depo(), sql)],
                         ["KR-001", "KU-001", "KU-002", "TS-001", "YP-001", "YP-002"])

    def test_yazan_ya_da_dosya_acan_sorgu_reddedilir(self):
        kok = depo()
        for sql in ("insert into dugum values ('X','x','x',1,'x','x','x',null,null,null)", "delete from dugum",
                    "drop table dugum", "create table t (a)", "update dugum set durum = 'kabul'",
                    "attach database '%s' as d" % (kok / "sizinti.db"), "pragma writable_schema = 1"):
            with self.assertRaises(h.HarnessHata, msg=sql):
                graf.sorgu(kok, sql)
        self.assertFalse((kok / "sizinti.db").exists())

    def test_bozuk_sorgu_nedeniyle_reddedilir(self):
        with self.assertRaises(h.HarnessHata) as c:
            graf.sorgu(depo(), "select * from olmayan_tablo")
        self.assertIn("olmayan_tablo", str(c.exception))


class Etki(unittest.TestCase):
    def test_karar_degisirse_ona_dayanan_kural_etkilenir(self):
        e = graf.etki(depo(), "KR-001")
        self.assertEqual([(b["kimlik"], b["adim"], b["bag"]) for b in e["baglilar"]], [("KU-001", 1, "dayanak")])
        self.assertEqual(e["dosyalar"], ["src/siparis/iptal.ts"])

    def test_etki_birden_cok_adim_izler(self):
        e = graf.etki(zengin_depo(), "TS-001")
        adim = {b["kimlik"]: b["adim"] for b in e["baglilar"]}
        self.assertEqual(adim, {"KR-001": 1, "KU-001": 2, "YP-001": 2, "KU-002": 3, "YP-002": 3})

    def test_etkilenen_kurallarin_dosyalari_ve_denetimleri_listelenir(self):
        e = graf.etki(zengin_depo(), "KR-001")
        self.assertEqual(e["dosyalar"], ["docs/not.md", "src/siparis/iptal.ts", "src/siparis/olustur.ts"])
        self.assertEqual(e["denetimler"], ["DN-001"])

    def test_kuralin_kendi_dosyalari_ve_denetimi_etkisindedir(self):
        e = graf.etki(zengin_depo(), "KU-001")
        self.assertEqual(e["baglilar"], [])
        self.assertEqual(e["dosyalar"], ["src/siparis/iptal.ts", "src/siparis/olustur.ts"])
        self.assertEqual(e["denetimler"], ["DN-001"])

    def test_denetim_degisirse_onu_kullanan_kural_etkilenir(self):
        self.assertEqual([b["kimlik"] for b in graf.etki(zengin_depo(), "DN-001")["baglilar"]], ["KU-001"])

    def test_bagimli_olmayan_dugum_etkilenmez(self):
        kimlikler = {b["kimlik"] for b in graf.etki(zengin_depo(), "YP-002")["baglilar"]}
        self.assertEqual(kimlikler, set())

    def test_dongulu_bagimlilikta_sonlanir(self):
        dongu = YAPI_DAYANAKLI.replace("katman: alan\n", "katman: alan\nbagimli: [YP-002]\n")
        e = graf.etki(zengin_depo(**{"kb/yapi/YP-001-siparis.md": dongu}), "YP-001")
        self.assertEqual({b["kimlik"]: b["adim"] for b in e["baglilar"]}, {"KU-002": 1, "YP-002": 1})

    def test_olmayan_kimlik_hata_verir(self):
        with self.assertRaises(h.HarnessHata):
            graf.etki(depo(), "KR-404")


class Cizim(unittest.TestCase):
    def test_dugumler_ve_adli_kenarlar_cizimdedir(self):
        m = graf.mermaid(zengin_depo())
        self.assertTrue(m.startswith("flowchart LR\n"))
        self.assertIn('KR_001{{"KR-001 · Durum tek tablodan yönetilir"}}', m)
        self.assertIn("KU_001 -->|dayanak| KR_001", m)
        self.assertIn("KU_002 -->|kapsam| YP_001", m)
        self.assertIn("YP_002 -->|bagimli| YP_001", m)

    def test_yol_deseni_eslesen_dosya_sayisiyla_cizilir(self):
        self.assertIn("src/siparis/** · 2 dosya", graf.mermaid(zengin_depo()))

    def test_taslak_dugum_ayri_cizilir(self):
        m = graf.mermaid(zengin_depo(**{"kb/kural/KU-003-taslak.md": KURAL_TASLAK}))
        self.assertIn("class KU_003 taslak", m)
        self.assertNotIn("class KU_001 taslak", m)

    def test_olmayan_hedef_eksik_diye_cizilir(self):
        k = KURAL.replace("KR-001@1", "KR-404@1")
        m = graf.mermaid(depo({"kb/kural/KU-001-durum-tablodan.md": k}, uret=False))
        self.assertIn("class KR_404 eksik", m)

    def test_basliktaki_ozel_karakter_cizimi_bozmaz(self):
        k = KARAR.replace("baslik: Durum tek tablodan yönetilir", 'baslik: "Tek" <b>tablo</b> & gerisi')
        m = graf.mermaid(depo({"kb/karar/KR-001-durum-tablosu.md": k}, uret=False))
        satir = next(s for s in m.split("\n") if s.strip().startswith("KR_001{{"))
        self.assertEqual(satir.count('"'), 2)
        self.assertNotIn("<", satir)
        self.assertNotIn(">", satir)
        self.assertIn("#amp;", satir)

    def test_cizim_ayni_depoda_hep_aynidir(self):
        kok = zengin_depo()
        self.assertEqual(graf.mermaid(kok), graf.mermaid(kok))

    def test_html_sayfasi_cizimi_kacirarak_tasir(self):
        k = KARAR.replace("baslik: Durum tek tablodan yönetilir", "baslik: <script>alert(1)</script>")
        sayfa = graf.html(depo({"kb/karar/KR-001-durum-tablosu.md": k}, uret=False))
        self.assertIn('<pre class="mermaid">', sayfa)
        self.assertIn("KU_001 --&gt;|dayanak| KR_001", sayfa)
        self.assertNotIn("<script>alert", sayfa)


class KaynakDosyalardir(unittest.TestCase):
    """Dizin bir görünümdür: bozulsa ya da bayatlasa bile hiçbir kapının cevabı değişmez."""

    def test_bozuk_dizin_dosyasi_denetimi_ve_soruyu_etkilemez(self):
        kok = zengin_depo()
        once = (h.denetle(kok, bugun=BUGUN), [k["kimlik"] for k in h.sor_yol(kok, "src/siparis/iptal.ts")["kurallar"]])
        (kok / ".harness").mkdir(exist_ok=True)
        (kok / ".harness" / "dizin.db").write_bytes(b"bu bir veritabani degil")
        sonra = (h.denetle(kok, bugun=BUGUN), [k["kimlik"] for k in h.sor_yol(kok, "src/siparis/iptal.ts")["kurallar"]])
        self.assertEqual(once, sonra)

    def test_sorgu_diskteki_bayat_dizine_degil_dosyalara_bakar(self):
        kok = zengin_depo()
        graf.yaz(kok)
        (kok / "kb/kural/KU-003-taslak.md").write_text(KURAL_TASLAK, encoding="utf-8")
        self.assertEqual(satirlar(kok, "select count(*) from dugum where kimlik = 'KU-003'"), [(1,)])

    def test_bozuk_dizin_dosyasinin_ustune_yazilir(self):
        kok = zengin_depo()
        (kok / ".harness").mkdir(exist_ok=True)
        (kok / ".harness" / "dizin.db").write_bytes(b"bu bir veritabani degil")
        b = sqlite3.connect(str(graf.yaz(kok)))
        try:
            self.assertEqual(b.execute("select count(*) from dugum").fetchone()[0], 7)
        finally:
            b.close()


class KomutSatiri(unittest.TestCase):
    def _kos(self, kok, *arg):
        return subprocess.run([sys.executable, str(pathlib.Path(h.__file__).resolve()), *arg], cwd=kok,
                              capture_output=True, text=True)

    def test_sorgu_komutu_baslik_ve_satir_basar(self):
        r = self._kos(depo(), "sorgu", "select kimlik, tur from dugum order by kimlik")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.split("\n")[0].split("\t"), ["kimlik", "tur"])
        self.assertIn("KR-001\tkarar", r.stdout)

    def test_argumansiz_sorgu_tablolari_tanitir(self):
        r = self._kos(depo(), "sorgu")
        self.assertEqual(r.returncode, 0, r.stderr)
        for tablo in ("dugum", "kenar", "desen", "dosya", "alan", "meta"):
            self.assertIn(tablo, r.stdout)

    def test_yazan_sorgu_iz_dokumu_degil_neden_basar(self):
        r = self._kos(depo(), "sorgu", "delete from dugum")
        self.assertEqual(r.returncode, 2)
        self.assertNotIn("Traceback", r.stderr)

    def test_dizin_komutu_dosyanin_yerini_ve_sayilari_soyler(self):
        kok = zengin_depo()
        r = self._kos(kok, "dizin")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(".harness/dizin.db", r.stdout)
        self.assertIn("7 düğüm", r.stdout)
        self.assertTrue((kok / ".harness/dizin.db").is_file())

    def test_etki_komutu_adimlari_ve_dosyalari_basar(self):
        r = self._kos(zengin_depo(), "etki", "TS-001")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("KR-001", r.stdout)
        self.assertIn("3. adım", r.stdout)
        self.assertIn("src/siparis/iptal.ts", r.stdout)
        self.assertIn("DN-001", r.stdout)

    def test_graf_komutu_cizimi_basar(self):
        r = self._kos(depo(), "graf")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(r.stdout.startswith("flowchart LR"))

    def test_graf_html_sayfayi_yerel_klasore_yazar(self):
        kok = depo()
        r = self._kos(kok, "graf", "--html")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(".harness/graf.html", r.stdout)
        self.assertIn('<pre class="mermaid">', (kok / ".harness/graf.html").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
