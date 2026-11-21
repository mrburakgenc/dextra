#!/usr/bin/env python3
"""plan.py testleri: space → epic → task → subtask.

- Space bir özelliktir (feature): adı, amacı ve yolları vardır; epicleri toplar.
- Epic geliştirilecek konudur: hedefi ve task'ları vardır.
- Task işin kendisidir; ya doğrudan koşturulur (yaprak) ya da subtask'lara bölünür (kapsayıcı).
- Koşturulan birim yapraktır: her yaprağın bir görev kartı vardır ve kendi çalışma ağacında koşar.
- İşaret elle konmaz: yaprak, görevi alınınca işaretlenir; task, epic ve space alttan yukarı türetilir.
- Plan ana çalışma ağacında durur; ayrı ağaçlardaki oturumlar aynı ağacı görür.

Koşum: python3 harness/test/test_plan.py
"""
from __future__ import annotations

import json
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
from test_h import agac_ac  # noqa: E402
from test_gorev import gorev_deposu  # noqa: E402

HEDEF, OLCUT = "İptal isteğine neden kodu ekle.", "Neden kodu olmadan istek reddedilir."


def plan_dizini(kok):
    return h.ortak_kok(kok) / ".harness/plan"


def kurulu(yollar=("src/siparis/**",), **kw):
    """Bir space ve içinde bir epic olan depo."""
    kok = gorev_deposu(**kw)
    plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=list(yollar))
    plan.epic(kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
    return kok


def yaprak_task(kok, baslik="İptal nedeni ekle", once=(), yollar=None, ep="EP-001"):
    return plan.task(kok, ep, baslik, rol="uygulayici", yollar=yollar, once=list(once), hedef=HEDEF, olcut=OLCUT)


def alt(kok, task_no, baslik="Neden kodu alanı", once=(), ep="EP-001"):
    return plan.subtask(kok, ep, task_no, baslik, rol="uygulayici", once=list(once), hedef=HEDEF, olcut=OLCUT)


def epic_metni(kok, ep="EP-001", space="siparis"):
    return (plan_dizini(kok) / space / (ep + ".md")).read_text(encoding="utf-8")


def satir(kok, no, ep="EP-001", space="siparis"):
    """Epic dosyasında `no` numaralı task ya da subtask satırı ('1' ya da '1.2')."""
    on_ekler = ("- [ ] %s. ", "- [x] %s. ") if "." not in str(no) else ("  - [ ] %s ", "  - [x] %s ")
    for s in epic_metni(kok, ep, space).split("\n"):
        if s.startswith(tuple(o % no for o in on_ekler)):
            return s
    raise AssertionError("%s epic dosyasında yok:\n%s" % (no, epic_metni(kok, ep, space)))


def space_satiri(kok, ep="EP-001", space="siparis"):
    for s in (plan_dizini(kok) / space / "space.md").read_text(encoding="utf-8").split("\n"):
        if s.startswith(("- [ ] " + ep, "- [x] " + ep)):
            return s
    raise AssertionError("%s space dosyasında yok" % ep)


def bitir(kok, kimlik):
    gorev.kos(kok, kimlik)
    gorev.incele(kok, kimlik)
    gorev.al(kok, kimlik)


def gorev_durumu(kok, kimlik):
    return json.loads((h.ortak_kok(kok) / ".harness/gorev" / kimlik / "durum.json").read_text(encoding="utf-8"))


class Ortam(unittest.TestCase):
    def setUp(self):
        for ad in ("SAHTE_MOD", "SAHTE_INCELEME"):
            os.environ.pop(ad, None)

    tearDown = setUp


class Yapi(Ortam):
    def test_space_acilir_anahtari_adindan_turer(self):
        kok = gorev_deposu()
        yol = plan.space(kok, "Sipariş İptali", amac="İptal akışı.", yollar=["src/siparis/**"])
        self.assertEqual(yol.resolve(), (kok / ".harness/plan/siparis-iptali/space.md").resolve())
        metin = yol.read_text(encoding="utf-8")
        for parca in ("Sipariş İptali", "siparis-iptali", "İptal akışı.", "src/siparis/**"):
            self.assertIn(parca, metin)

    def test_ayni_adla_ikinci_space_acilmaz(self):
        kok = gorev_deposu()
        plan.space(kok, "Sipariş")
        with self.assertRaises(h.HarnessHata):
            plan.space(kok, "Sipariş")

    def test_epic_space_altinda_acilir_ve_kimligi_depo_capinda_siralidir(self):
        kok = gorev_deposu()
        plan.space(kok, "Sipariş")
        plan.space(kok, "Ödeme")
        ilk = plan.epic(kok, "siparis", "İptal nedenleri", hedef="H1")
        ikinci = plan.epic(kok, "odeme", "İade", hedef="H2")
        self.assertEqual(ilk.resolve(), (kok / ".harness/plan/siparis/EP-001.md").resolve())
        self.assertEqual(ikinci.resolve(), (kok / ".harness/plan/odeme/EP-002.md").resolve())
        self.assertIn("# EP-001 — İptal nedenleri", ilk.read_text(encoding="utf-8"))
        self.assertIn("H1", ilk.read_text(encoding="utf-8"))

    def test_olmayan_space_e_epic_acilmaz(self):
        kok = gorev_deposu()
        with self.assertRaises(h.HarnessHata):
            plan.epic(kok, "yok", "İptal nedenleri")

    def test_yaprak_task_gorev_karti_acar_ve_isaretsiz_yazilir(self):
        kok = kurulu()
        self.assertEqual(yaprak_task(kok), ("1", "GV-001"))
        self.assertTrue(satir(kok, 1).startswith("- [ ] 1. İptal nedeni ekle — GV-001"))
        kart = (kok / ".harness/gorev/GV-001/kart.md").read_text(encoding="utf-8")
        for parca in (OLCUT, "EP-001", "Sipariş", "İptal nedenleri"):
            self.assertIn(parca, kart)

    def test_kapsayici_task_gorev_karti_acmaz(self):
        kok = kurulu()
        self.assertEqual(plan.task(kok, "EP-001", "Doğrulama katmanı"), ("1", None))
        s = satir(kok, 1)
        self.assertNotIn("GV-", s)
        self.assertIn("subtask bekliyor", s)
        self.assertFalse((kok / ".harness/gorev/GV-001").exists())

    def test_subtask_taskin_altina_girintili_yazilir_ve_karti_acilir(self):
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        self.assertEqual(alt(kok, 1), ("1.1", "GV-001"))
        self.assertEqual(alt(kok, 1, baslik="Hata mesajı", once=[1]), ("1.2", "GV-002"))
        self.assertTrue(satir(kok, "1.1").startswith("  - [ ] 1.1 Neden kodu alanı — GV-001"))
        self.assertIn("önce: 1.1", satir(kok, "1.2"))
        kart = (kok / ".harness/gorev/GV-002/kart.md").read_text(encoding="utf-8")
        self.assertIn("Doğrulama katmanı", kart)

    def test_yol_verilmezse_space_in_yollari_kullanilir(self):
        kok = kurulu(yollar=("src/siparis/**", "test/siparis/**"))
        _, kimlik = yaprak_task(kok)
        self.assertEqual(gorev_durumu(kok, kimlik)["yollar"], ["src/siparis/**", "test/siparis/**"])

    def test_yaprakta_verilen_yol_space_inkinin_yerine_gecer(self):
        kok = kurulu()
        _, kimlik = yaprak_task(kok, yollar=["src/siparis/iptal.ts"])
        self.assertEqual(gorev_durumu(kok, kimlik)["yollar"], ["src/siparis/iptal.ts"])

    def test_ne_yaprakta_ne_space_te_yol_varsa_yaprak_acilmaz(self):
        kok = kurulu(yollar=())
        with self.assertRaises(h.HarnessHata) as hata:
            yaprak_task(kok)
        self.assertIn("yol", str(hata.exception))

    def test_kosmamis_yaprak_task_bolunurse_kendi_gorevi_kapanir(self):
        kok = kurulu()
        yaprak_task(kok)
        self.assertEqual(alt(kok, 1), ("1.1", "GV-002"))
        self.assertNotIn("GV-001", satir(kok, 1))
        self.assertEqual(gorev_durumu(kok, "GV-001")["durum"], "atildi")

    def test_kosmus_yaprak_task_bolunemez(self):
        kok = kurulu()
        _, kimlik = yaprak_task(kok)
        gorev.kos(kok, kimlik)
        with self.assertRaises(h.HarnessHata):
            alt(kok, 1)

    def test_olmayan_taska_subtask_eklenmez(self):
        kok = kurulu()
        with self.assertRaises(h.HarnessHata):
            alt(kok, 3)

    def test_olmayan_onkosul_reddedilir(self):
        kok = kurulu()
        with self.assertRaises(h.HarnessHata):
            yaprak_task(kok, once=[4])
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        with self.assertRaises(h.HarnessHata):
            alt(kok, 1, once=[2])

    def test_basliktaki_ayiraclar_agaci_bozmaz(self):
        kok = kurulu()
        yaprak_task(kok, baslik="Neden · kod — alan")
        task = plan.oku(kok, "EP-001")["tasklar"][0]
        self.assertEqual(task["gorev"], "GV-001")
        self.assertNotIn(" · ", task["baslik"])
        self.assertNotIn(" — ", task["baslik"])

    def test_epic_okununca_agac_gelir(self):
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        alt(kok, 1)
        alt(kok, 1, baslik="Hata mesajı", once=[1])
        yaprak_task(kok, baslik="Raporu güncelle", once=[1])
        ep = plan.oku(kok, "EP-001")
        self.assertEqual((ep["baslik"], ep["space"]), ("İptal nedenleri", "siparis"))
        self.assertEqual([(t["no"], t["gorev"], t["once"]) for t in ep["tasklar"]],
                         [("1", None, []), ("2", "GV-003", ["1"])])
        self.assertEqual([(a["no"], a["gorev"], a["once"]) for a in ep["tasklar"][0]["subtasklar"]],
                         [("1.1", "GV-001", []), ("1.2", "GV-002", ["1.1"])])


class Isaretleme(Ortam):
    def _iki_subtask(self, **kw):
        kok = kurulu(**kw)
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        _, ilk = alt(kok, 1)
        _, ikinci = alt(kok, 1, baslik="Hata mesajı")
        return kok, ilk, ikinci

    def test_alinan_subtask_isaretlenir_task_hepsi_bitince_isaretlenir(self):
        kok, ilk, ikinci = self._iki_subtask()
        bitir(kok, ilk)
        self.assertTrue(satir(kok, "1.1").startswith("  - [x] 1.1"))
        self.assertTrue(satir(kok, 1).startswith("- [ ] 1."))
        self.assertIn("1/2", satir(kok, 1))
        bitir(kok, ikinci)
        self.assertTrue(satir(kok, 1).startswith("- [x] 1."))
        self.assertIn("2/2", satir(kok, 1))

    def test_epic_butun_tasklar_bitince_space_listesinde_isaretlenir(self):
        kok, ilk, ikinci = self._iki_subtask()
        self.assertTrue(space_satiri(kok).startswith("- [ ] EP-001 — İptal nedenleri"))
        self.assertIn("0/2", space_satiri(kok))
        bitir(kok, ilk)
        self.assertTrue(space_satiri(kok).startswith("- [ ] EP-001"))
        self.assertIn("1/2", space_satiri(kok))
        bitir(kok, ikinci)
        self.assertTrue(space_satiri(kok).startswith("- [x] EP-001"))

    def test_epic_tasklarin_yalniz_biri_bitince_isaretlenmez(self):
        kok = kurulu()
        _, ilk = yaprak_task(kok)
        _, ikinci = yaprak_task(kok, baslik="Raporu güncelle")
        bitir(kok, ilk)
        self.assertFalse(plan.oku(kok, "EP-001")["isaret"])
        self.assertTrue(space_satiri(kok).startswith("- [ ] EP-001"))
        bitir(kok, ikinci)
        self.assertTrue(plan.oku(kok, "EP-001")["isaret"])
        self.assertTrue(space_satiri(kok).startswith("- [x] EP-001"))

    def test_yaprak_task_alininca_isaretlenir(self):
        kok = kurulu()
        _, kimlik = yaprak_task(kok)
        bitir(kok, kimlik)
        self.assertTrue(satir(kok, 1).startswith("- [x] 1."))
        self.assertIn("alındı", satir(kok, 1))

    def test_kosan_ama_incelenmeyen_yaprak_isaretlenmez(self):
        kok, ilk, _ = self._iki_subtask()
        gorev.kos(kok, ilk)
        self.assertTrue(satir(kok, "1.1").startswith("  - [ ] 1.1"))
        self.assertIn("inceleme bekliyor", satir(kok, "1.1"))

    def test_incelenen_ama_alinmayan_yaprak_isaretlenmez(self):
        kok, ilk, _ = self._iki_subtask()
        gorev.kos(kok, ilk)
        gorev.incele(kok, ilk)
        self.assertTrue(satir(kok, "1.1").startswith("  - [ ] 1.1"))
        self.assertIn("alınmayı bekliyor", satir(kok, "1.1"))

    def test_sorunlu_yaprak_isaretlenmez_ve_sorunu_soyler(self):
        os.environ["SAHTE_MOD"] = "kapsam-disi"
        kok, ilk, _ = self._iki_subtask()
        gorev.kos(kok, ilk)
        s = satir(kok, "1.1")
        self.assertTrue(s.startswith("  - [ ] 1.1"))
        self.assertIn("sorunlu", s)
        self.assertIn("kapsam-disi", s)

    def test_incelemede_kalan_yaprak_isaretlenmez(self):
        kok, ilk, _ = self._iki_subtask()
        gorev.kos(kok, ilk)
        os.environ["SAHTE_INCELEME"] = "kaldi"
        gorev.incele(kok, ilk)
        self.assertTrue(satir(kok, "1.1").startswith("  - [ ] 1.1"))
        self.assertIn("incelemede kaldı", satir(kok, "1.1"))

    def test_atilan_subtask_taski_kilitlemez_ama_satirda_gorunur(self):
        kok, ilk, ikinci = self._iki_subtask()
        bitir(kok, ilk)
        gorev.at(kok, ikinci)
        self.assertTrue(satir(kok, "1.2").startswith("  - [ ] 1.2"))
        self.assertIn("atıldı", satir(kok, "1.2"))
        self.assertTrue(satir(kok, 1).startswith("- [x] 1."))
        self.assertIn("1 atıldı", satir(kok, 1))

    def test_butun_subtasklari_atilan_task_isaretlenmez(self):
        kok, ilk, ikinci = self._iki_subtask()
        gorev.at(kok, ilk)
        gorev.at(kok, ikinci)
        self.assertTrue(satir(kok, 1).startswith("- [ ] 1."))

    def test_subtaski_olmayan_kapsayici_task_isaretlenmez(self):
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        plan.guncelle(kok, "EP-001")
        self.assertTrue(satir(kok, 1).startswith("- [ ] 1."))
        self.assertTrue(space_satiri(kok).startswith("- [ ] EP-001"))

    def test_elle_konan_isaretler_guncellemede_geri_alinir(self):
        kok, _, _ = self._iki_subtask()
        for yol in (plan_dizini(kok) / "siparis/EP-001.md", plan_dizini(kok) / "siparis/space.md"):
            yol.write_text(yol.read_text(encoding="utf-8").replace("- [ ]", "- [x]"), encoding="utf-8")
        plan.guncelle(kok, "EP-001")
        self.assertTrue(satir(kok, 1).startswith("- [ ] 1."))
        self.assertTrue(satir(kok, "1.1").startswith("  - [ ] 1.1"))
        self.assertTrue(space_satiri(kok).startswith("- [ ] EP-001"))

    def test_guncelleme_elle_yazilan_kismi_korur(self):
        kok, _, _ = self._iki_subtask()
        for ad in ("EP-001.md", "space.md"):
            yol = plan_dizini(kok) / "siparis" / ad
            yol.write_text(yol.read_text(encoding="utf-8") + "\n## Notlar\nBURAYA-DOKUNMA\n", encoding="utf-8")
        plan.guncelle(kok, "EP-001")
        for ad in ("EP-001.md", "space.md"):
            self.assertIn("BURAYA-DOKUNMA", (plan_dizini(kok) / "siparis" / ad).read_text(encoding="utf-8"))


class Sira(Ortam):
    def _agac(self):
        """1 (kapsayıcı): 1.1, 1.2 (önce 1.1) · 2 (yaprak, önce 1)."""
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        _, a = alt(kok, 1)
        _, b = alt(kok, 1, baslik="Hata mesajı", once=[1])
        _, c = yaprak_task(kok, baslik="Raporu güncelle", once=[1])
        return kok, a, b, c

    def test_onkosulu_alinmamis_subtask_kosmaz(self):
        kok, _, b, _ = self._agac()
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.kos(kok, b)
        self.assertIn("1.1", str(hata.exception))

    def test_onkosul_taski_bitmemis_yaprak_task_kosmaz(self):
        kok, a, _, c = self._agac()
        bitir(kok, a)
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.kos(kok, c)
        self.assertIn("task 1", str(hata.exception))

    def test_taskinin_onkosulu_bitmemis_subtask_kosmaz(self):
        kok, _, _, _ = self._agac()
        plan.task(kok, "EP-001", "Bildirim", once=[1])
        _, d = alt(kok, 3, baslik="Bildirim metni")
        with self.assertRaises(h.HarnessHata) as hata:
            gorev.kos(kok, d)
        self.assertIn("task 1", str(hata.exception))

    def test_onkosulu_alinan_yaprak_kosar_ve_onun_isini_gorur(self):
        kok, a, b, _ = self._agac()
        bitir(kok, a)
        gorev.kos(kok, b)
        self.assertIn(a, h._git(kok / ".harness/agac" / b, "log", "--format=%s"))

    def test_hazir_yapraklar_sirayla_acilir(self):
        kok, a, b, c = self._agac()
        self.assertEqual([y["no"] for y in plan.hazir(kok, "EP-001")], ["1.1"])
        bitir(kok, a)
        self.assertEqual([y["no"] for y in plan.hazir(kok, "EP-001")], ["1.2"])
        bitir(kok, b)
        self.assertEqual([(y["no"], y["gorev"]) for y in plan.hazir(kok, "EP-001")], [("2", c)])

    def test_onkosulsuz_yapraklar_ayni_anda_hazirdir(self):
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        alt(kok, 1)
        alt(kok, 1, baslik="Hata mesajı")
        yaprak_task(kok, baslik="Raporu güncelle")
        self.assertEqual([y["no"] for y in plan.hazir(kok, "EP-001")], ["1.1", "1.2", "2"])


class Yurutme(Ortam):
    """Epic tek onayla yürütülür: hazır yapraklar sırayla koşar, incelenir, alınır; ilk sorunda durur."""

    def _agac(self, **kw):
        """1 (kapsayıcı): 1.1, 1.2 (önce 1.1) · 2 (yaprak, önce 1)."""
        kok = kurulu(**kw)
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        alt(kok, 1)
        alt(kok, 1, baslik="Hata mesajı", once=[1])
        yaprak_task(kok, baslik="Raporu güncelle", once=[1])
        return kok

    def test_hazir_yapraklar_sirayla_kosar_incelenir_alinir_ve_epic_biter(self):
        kok = self._agac()
        sonuc = plan.yurut(kok, "EP-001")
        self.assertEqual(sonuc["alinan"], ["GV-001", "GV-002", "GV-003"])
        self.assertIsNone(sonuc["duran"])
        self.assertTrue(sonuc["bitti"])
        self.assertTrue(space_satiri(kok).startswith("- [x] EP-001"))
        for kimlik in sonuc["alinan"]:
            self.assertEqual(gorev_durumu(kok, kimlik)["inceleme"], "gecti")

    def test_ilk_sorunda_durur_nedenini_soyler_ve_sonrakini_kosturmaz(self):
        os.environ["SAHTE_MOD"] = "kapsam-disi"
        kok = self._agac()
        sonuc = plan.yurut(kok, "EP-001")
        self.assertEqual(sonuc["alinan"], [])
        self.assertEqual((sonuc["duran"]["gorev"], sonuc["duran"]["no"], sonuc["duran"]["asama"]),
                         ("GV-001", "1.1", "kosum"))
        self.assertIn("kapsam-disi", sonuc["duran"]["neden"])
        self.assertFalse(sonuc["bitti"])
        self.assertEqual(gorev_durumu(kok, "GV-002")["durum"], "taslak")

    def test_incelemede_kalan_yaprakta_durur_ve_isi_almaz(self):
        os.environ["SAHTE_INCELEME"] = "kaldi"
        kok = self._agac()
        sonuc = plan.yurut(kok, "EP-001")
        self.assertEqual(sonuc["alinan"], [])
        self.assertEqual(sonuc["duran"]["asama"], "inceleme")
        self.assertFalse(gorev_durumu(kok, "GV-001").get("alindi"))

    def test_agacinin_disina_yazan_iscide_durur(self):
        os.environ["SAHTE_MOD"] = "agac-disi"
        kok = self._agac()
        sonuc = plan.yurut(kok, "EP-001")
        self.assertEqual(sonuc["alinan"], [])
        self.assertIn("agac-disi", sonuc["duran"]["neden"])

    def test_en_cok_sayisi_kadar_yaprak_yurutur(self):
        kok = self._agac()
        sonuc = plan.yurut(kok, "EP-001", en_cok=1)
        self.assertEqual(sonuc["alinan"], ["GV-001"])
        self.assertIsNone(sonuc["duran"])
        self.assertEqual(sonuc["kalan"], ["1.2"])

    def test_inceleme_istege_bagliysa_incelemeden_alir(self):
        kok = self._agac(inceleme="istege-bagli")
        sonuc = plan.yurut(kok, "EP-001", en_cok=1)
        self.assertEqual(sonuc["alinan"], ["GV-001"])
        self.assertIsNone(gorev_durumu(kok, "GV-001").get("inceleme"))

    def test_bitmis_epicte_hicbir_sey_kosturmaz(self):
        kok = self._agac()
        plan.yurut(kok, "EP-001")
        sonuc = plan.yurut(kok, "EP-001")
        self.assertEqual((sonuc["alinan"], sonuc["duran"], sonuc["bitti"]), ([], None, True))

    def test_yurutme_komutu_bir_kez_sorulur_ve_ne_yapacagini_soyler(self):
        from test_hook import gerekce, karar, komut
        kok = self._agac()
        c = komut(kok, "python3 harness/h.py plan yurut EP-001")
        self.assertEqual(karar(c), "ask")
        for parca in ("EP-001", "İptal nedenleri", "3 yaprak", "1.1", "GV-003", "acceptEdits", "kum havuzu açık",
                      "İlk sorunda durur"):
            self.assertIn(parca, gerekce(c))

    def test_yurutme_onayi_yalniz_bekleyen_yapraklari_sayar(self):
        from test_hook import gerekce, komut
        kok = self._agac()
        plan.yurut(kok, "EP-001", en_cok=1)
        metin = gerekce(komut(kok, "python3 harness/h.py plan yurut EP-001"))
        self.assertIn("2 yaprak", metin)
        self.assertNotIn("(GV-001)", metin)
        self.assertIn("(GV-002)", metin)

    def test_onay_kapaliysa_yurutme_komutu_sorulmaz(self):
        from test_hook import komut
        kok = self._agac(onay="yok")
        self.assertIsNone(komut(kok, "python3 harness/h.py plan yurut EP-001"))

    def test_gorev_oturumu_plan_yurutemez(self):
        from test_hook import karar, komut
        kok = self._agac()
        self.assertEqual(karar(komut(kok, "python3 harness/h.py plan yurut EP-001", ortam={"HARNESS_GOREV": "GV-001"})),
                         "deny")


class OrtakGorunum(Ortam):
    """Plan ana ağaçta durur: ayrı ağaçlardaki oturumlar aynı ağacı görür ve işaretler."""

    def test_bagli_agactan_acilan_space_ve_epic_ana_agacta_durur(self):
        kok = gorev_deposu()
        oturum = agac_ac(kok, "a")
        self.assertEqual(plan.space(oturum, "Sipariş", yollar=["src/siparis/**"]).resolve(),
                         (kok / ".harness/plan/siparis/space.md").resolve())
        self.assertEqual(plan.epic(oturum, "siparis", "İptal nedenleri").resolve(),
                         (kok / ".harness/plan/siparis/EP-001.md").resolve())

    def test_baska_agactaki_oturum_ayni_agaci_ve_durumu_gorur(self):
        kok = kurulu()
        a, b = agac_ac(kok, "a"), agac_ac(kok, "b")
        _, kimlik = yaprak_task(a)
        bitir(a, kimlik)
        gorulen = plan.oku(b, "EP-001")["tasklar"][0]
        self.assertEqual((gorulen["gorev"], gorulen["isaret"]), (kimlik, True))

    def test_bir_oturumun_isini_baska_agactaki_oturum_inceleyebilir(self):
        kok = kurulu()
        a, b = agac_ac(kok, "a"), agac_ac(kok, "b")
        _, kimlik = yaprak_task(a)
        gorev.kos(a, kimlik)
        self.assertEqual(gorev.incele(b, kimlik)["sonuc"], "gecti")
        self.assertIn("alınmayı bekliyor", satir(kok, 1))

    def test_oturum_basi_acik_epici_ve_siradaki_yapragi_soyler(self):
        import ajan_hook
        kok = kurulu()
        plan.task(kok, "EP-001", "Doğrulama katmanı")
        alt(kok, 1)
        alt(kok, 1, baslik="Hata mesajı", once=[1])
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(agac_ac(kok, "a")), "source": "startup"}, {})
        metin = c["hookSpecificOutput"]["additionalContext"]
        for parca in ("siparis", "EP-001", "0/2", "1.1 (GV-001)"):
            self.assertIn(parca, metin)

    def test_biten_epic_oturum_basinda_gosterilmez(self):
        import ajan_hook
        kok = kurulu()
        _, kimlik = yaprak_task(kok)
        bitir(kok, kimlik)
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(agac_ac(kok, "a")), "source": "startup"}, {})
        self.assertNotIn("EP-001", c["hookSpecificOutput"]["additionalContext"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
