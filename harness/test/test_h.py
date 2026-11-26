#!/usr/bin/env python3
"""h.py testleri: her zincir kuralı için bozulmuş bir örnek.

Koşum: python3 harness/test/test_h.py
Her test geçici bir depo kurar; gerçek bilgi tabanına dokunmaz.
"""
from __future__ import annotations

import contextlib
import datetime
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import h  # noqa: E402

BUGUN = datetime.date(2026, 11, 20)

AYAR = {
    "bicim_surumu": 1,
    "kaynak_kokleri": ["src"],
    "haric": ["**/node_modules/**"],
    "taban_dal": "main",
    "duzey": 1,
    "konular": ["veri-modeli"],
    "katmanlar": ["alan", "uygulama"],
    "roller": ["tasarimci", "uygulayici", "inceleyici", "kesif"],
    "ajan_rolleri": {"Plan": "tasarimci", "Explore": "kesif", "general-purpose": "uygulayici"},
    "butce": {"agents_bayt": 24576, "ifade_karakter": 400, "dosya_basina_kural": 12,
              "paket_karakter": 6000},
}

KARAR = """---
kimlik: KR-001
tur: karar
durum: kabul
surum: 1
baslik: Durum tek tablodan yönetilir
agirlik: cift-yonlu
tip: mimari
---
Durum geçişleri için tek tablo seçildi; tek doğruluk noktası kazanılıyor, tabloyu güncelleme yükü kabul ediliyor.

## Bağlam
Durum iki yerde güncelleniyordu.

## Seçenekler
### A — Tek tablo
Tek yerde durur.
### B — Her serviste kontrol
İki yerde farklılaşır.

## Sonuçlar
- Yükümlülük: her yol tablodan geçer.
"""

KURAL = """---
kimlik: KU-001
tur: kural
durum: kabul
surum: 1
baslik: Durum yalnız tablodan değişir
dayanak: [KR-001@1]
kapsam: [src/siparis/**]
baglama: kapsam
bicim: kural
denetim_duzey: gozden-gecirme
bakis: 2099-01-01
---
Durumu değiştiren her kod yolu geçiş tablosundan geçer.

## Neden
İki yerde güncellenince hata oldu.
"""

YAPI = """---
kimlik: YP-001
tur: yapi
durum: kabul
surum: 1
baslik: siparis
yollar: [src/siparis/**]
katman: alan
---
Sipariş yaşam döngüsü.
"""

AGENTS = "# Proje\n\nElle yazılan giriş.\n\n" + h.URETILEN_BASLA + "\n" + h.URETILEN_BITIR + "\n"


def depo(ek: dict | None = None, ayar: dict | None = None, uret: bool = True) -> pathlib.Path:
    """Temiz bir örnek depo kurar; `ek` ile dosya ekler ya da ezer (None değer dosyayı siler)."""
    kok = pathlib.Path(tempfile.mkdtemp(prefix="harness-test-"))
    dosyalar = {
        "harness.json": json.dumps({**AYAR, **(ayar or {})}, ensure_ascii=False, indent=2),
        "AGENTS.md": AGENTS,
        "kb/karar/KR-001-durum-tablosu.md": KARAR,
        "kb/kural/KU-001-durum-tablodan.md": KURAL,
        "kb/yapi/YP-001-siparis.md": YAPI,
        "src/siparis/iptal.ts": "export const x = 1\n",
    }
    dosyalar.update(ek or {})
    for yol, icerik in dosyalar.items():
        if icerik is None:
            continue
        p = kok / yol
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(icerik, encoding="utf-8")
    if uret:
        h.uret(kok)
    return kok


def git(kok, *arg) -> str:
    return subprocess.run(["git", *arg], cwd=kok, check=True, capture_output=True, text=True).stdout


def git_depo(kok: pathlib.Path, commit: bool = True) -> pathlib.Path:
    """Örnek depoyu git deposu yapar; `commit` ile ilk commit'i atar."""
    git(kok, "init", "-q", "-b", "main")
    for ad, deger in (("user.name", "t"), ("user.email", "t@example.invalid"), ("commit.gpgsign", "false")):
        git(kok, "config", ad, deger)
    (kok / ".gitignore").write_text(".harness/\n.claude/worktrees/\n", encoding="utf-8")
    if commit:
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "ilk")
    return kok


def agac_ac(kok: pathlib.Path, ad: str, yer: str = ".claude/worktrees") -> pathlib.Path:
    """Ayrı dallı bir çalışma ağacı açar (Claude Code'un oturum ağaçlarının durduğu yerde)."""
    hedef = kok / yer / ad
    git(kok, "worktree", "add", "-q", "-b", "oturum-" + ad, str(hedef))
    return hedef


def adlar(kok: pathlib.Path, **kw) -> set:
    return {b["ad"] for b in h.denetle(kok, bugun=BUGUN, **kw)}


def kirmizilar(kok: pathlib.Path, **kw) -> set:
    return {b["ad"] for b in h.denetle(kok, bugun=BUGUN, **kw) if b["seviye"] == "kirmizi"}


class TemizDepo(unittest.TestCase):
    def test_temiz_depoda_bulgu_yok(self):
        self.assertEqual(h.denetle(depo(), bugun=BUGUN), [])


class Z1Kimlik(unittest.TestCase):
    def test_bozuk_baslik_blogu_bicim_hatasi_verir(self):
        bozuk = KURAL.replace("baglama: kapsam", "baglama:\n  - kapsam")
        self.assertIn("bicim", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": bozuk})))

    def test_ayni_kimlik_iki_dosyada_yakalanir(self):
        self.assertIn("cift-kimlik", adlar(depo({"kb/kural/KU-001-kopya.md": KURAL})))

    def test_dosya_adi_kimlikle_baslamiyorsa_yakalanir(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": None, "kb/kural/KU-009-yanlis.md": KURAL})
        self.assertIn("ad-uyusmuyor", adlar(kok))

    def test_olmayan_karara_dayanak_olu_hedeftir(self):
        k = KURAL.replace("KR-001@1", "KR-404@1")
        self.assertIn("olu-hedef", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_dayanak_karar_degilse_yanlis_tiptir(self):
        k = KURAL.replace("KR-001@1", "YP-001@1")
        self.assertIn("yanlis-tip", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_kb_altinda_taninmayan_dosya_sessizce_gecmez(self):
        self.assertIn("taninmayan-dosya", adlar(depo({"kb/kural/notlarim.md": "serbest metin\n"})))

    def test_zorunlu_alan_eksikse_yakalanir(self):
        k = KURAL.replace("baslik: Durum yalnız tablodan değişir\n", "")
        self.assertIn("zorunlu-alan", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))


class Z2Dayanak(unittest.TestCase):
    def test_dayanaksiz_kural_yakalanir(self):
        k = KURAL.replace("dayanak: [KR-001@1]\n", "")
        self.assertIn("dayanaksiz", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_karar_surumu_artinca_dayanak_bayatlar(self):
        yeni = KARAR.replace("surum: 1", "surum: 2")
        self.assertIn("bayat-dayanak", adlar(depo({"kb/karar/KR-001-durum-tablosu.md": yeni})))

    def test_kabul_kural_taslak_karara_dayanamaz(self):
        taslak = KARAR.replace("durum: kabul", "durum: taslak")
        self.assertIn("kabulsuz-dayanak", adlar(depo({"kb/karar/KR-001-durum-tablosu.md": taslak})))


class Z3Z4(unittest.TestCase):
    def test_kural_dogurmayan_kabul_karar_sonucsuzdur(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": None})
        self.assertIn("sonucsuz-karar", adlar(kok))

    def test_sonucsuz_gerekce_yazilmissa_karar_gecer(self):
        k = KARAR.replace("tip: mimari", "tip: mimari\nsonucsuz_gerekce: Yalnız bilgi kaydıdır")
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": None, "kb/karar/KR-001-durum-tablosu.md": k})
        self.assertNotIn("sonucsuz-karar", adlar(kok))

    def test_kapsami_ve_olayi_olmayan_kural_yakalanir(self):
        k = KURAL.replace("kapsam: [src/siparis/**]\n", "")
        self.assertIn("kapsamsiz", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_hicbir_dosyayla_eslesmeyen_kapsam_bostur(self):
        k = KURAL.replace("src/siparis/**", "src/olmayan/**")
        self.assertIn("bos-kapsam", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_yalniz_olaya_bagli_kural_gecerlidir(self):
        k = KURAL.replace("kapsam: [src/siparis/**]", "olay: [push]")
        self.assertEqual(kirmizilar(depo({"kb/kural/KU-001-durum-tablodan.md": k})), set())


class Z8Bakis(unittest.TestCase):
    def test_gozden_gecirme_kurali_bakis_tarihi_ister(self):
        k = KURAL.replace("bakis: 2099-01-01\n", "")
        self.assertIn("bakissiz", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_yeni_gecmis_bakis_yalniz_uyaridir(self):
        k = KURAL.replace("2099-01-01", "2026-11-10")
        bulgular = h.denetle(depo({"kb/kural/KU-001-durum-tablodan.md": k}), bugun=BUGUN)
        self.assertEqual([(b["ad"], b["seviye"]) for b in bulgular], [("gecikmis-bakis", "uyari")])

    def test_otuz_gunu_asan_bakis_kirmizidir(self):
        k = KURAL.replace("2099-01-01", "2026-09-01")
        self.assertIn("gecikmis-bakis", kirmizilar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))


class Z11Ezilme(unittest.TestCase):
    def test_ezilen_karar_yerine_gostermek_zorunda(self):
        k = KARAR.replace("durum: kabul", "durum: ezildi")
        self.assertIn("yerinesiz", adlar(depo({"kb/karar/KR-001-durum-tablosu.md": k})))

    def test_ezilmis_karara_dayanan_kabul_kural_yakalanir(self):
        eski = KARAR.replace("durum: kabul", "durum: ezildi\nyerine: KR-002")
        yeni = KARAR.replace("KR-001", "KR-002")
        kok = depo({"kb/karar/KR-001-durum-tablosu.md": eski, "kb/karar/KR-002-yeni.md": yeni})
        self.assertIn("ezilene-dayanan", adlar(kok))


class Z12Surum(unittest.TestCase):
    def _git(self, kok, *arg):
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid",
                        "-c", "commit.gpgsign=false", *arg], cwd=kok, check=True,
                       capture_output=True)

    def _depo(self):
        kok = depo()
        self._git(kok, "init", "-q", "-b", "main")
        self._git(kok, "add", "-A")
        self._git(kok, "commit", "-q", "-m", "ilk")
        self._git(kok, "checkout", "-q", "-b", "is")
        return kok

    def test_ifade_degisip_surum_artmazsa_yakalanir(self):
        kok = self._depo()
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8").replace("geçiş tablosundan geçer",
                                                            "geçiş tablosunu kullanır"), encoding="utf-8")
        h.uret(kok)
        self.assertIn("surumsuz-degisiklik", adlar(kok, taban=True))

    def test_surum_artinca_degisiklik_gecer(self):
        kok = self._depo()
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8").replace("geçiş tablosundan geçer",
                                                            "geçiş tablosunu kullanır")
                     .replace("surum: 1", "surum: 2"), encoding="utf-8")
        h.uret(kok)
        self.assertNotIn("surumsuz-degisiklik", adlar(kok, taban=True))

    def test_yalniz_neden_bolumu_degisince_surum_istenmez(self):
        kok = self._depo()
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8").replace("hata oldu", "hata olmuştu"), encoding="utf-8")
        self.assertNotIn("surumsuz-degisiklik", adlar(kok, taban=True))


class Z13Z14(unittest.TestCase):
    def test_uretilenler_bayatsa_yakalanir(self):
        kok = depo()
        (kok / "AGENTS.md").write_text(AGENTS, encoding="utf-8")
        self.assertIn("bayat-uretim", adlar(kok))

    def test_uzun_baglayici_ifade_yakalanir(self):
        k = KURAL.replace("Durumu değiştiren her kod yolu geçiş tablosundan geçer.", "a" * 401)
        self.assertIn("uzun-ifade", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_sisen_agents_dosyasi_yakalanir(self):
        kok = depo(ayar={"butce": {**AYAR["butce"], "agents_bayt": 50}})
        self.assertIn("agents-sisti", adlar(kok))


class Z15Z16(unittest.TestCase):
    KESIN = KURAL.replace("bicim: kural", "bicim: kural\nkesinlik: kesin") + (
        "\n## İhlal örneği\nDoğrudan atama.\n\n## Uygun örnek\nTablo üzerinden.\n")

    def test_beyan_edilmis_celiski_iki_kabul_kuralda_kirmizidir(self):
        k1 = KURAL.replace("bicim: kural", "bicim: kural\ncelisir: [KU-002]")
        k2 = KURAL.replace("KU-001", "KU-002")
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": k1, "kb/kural/KU-002-oteki.md": k2})
        self.assertIn("cozulmemis-celiski", adlar(kok))

    def test_tam_yazilmis_kesin_kural_gecer(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": self.KESIN,
                    "kb/karar/KR-001-durum-tablosu.md": KARAR + "\n## İstisna yolu\nİstisnası yok.\n"})
        self.assertEqual(kirmizilar(kok), set())

    def test_kesin_kural_rehber_duzeyinde_olamaz(self):
        k = self.KESIN.replace("denetim_duzey: gozden-gecirme", "denetim_duzey: rehber\ngerekce: yok")
        self.assertIn("denetimsiz-kesin", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_kesin_kural_ornek_bolumleri_ister(self):
        k = KURAL.replace("bicim: kural", "bicim: kural\nkesinlik: kesin")
        self.assertIn("orneksiz-kesin", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_sozlukte_olmayan_konu_yakalanir(self):
        k = KURAL.replace("bicim: kural", "bicim: kural\nkonu: [uydurma]")
        self.assertIn("tanimsiz-deger", adlar(depo({"kb/kural/KU-001-durum-tablodan.md": k})))

    def test_sozlukte_olmayan_katman_yakalanir(self):
        y = YAPI.replace("katman: alan", "katman: uydurma")
        self.assertIn("tanimsiz-deger", adlar(depo({"kb/yapi/YP-001-siparis.md": y})))


class Z17Hassas(unittest.TestCase):
    def test_bilgi_tabaninda_adres_deseni_yakalanir_ve_deger_basilmaz(self):
        gizli = ".".join(["10", "20", "30", "40"])
        k = KURAL.replace("İki yerde güncellenince hata oldu.", "Sunucu " + gizli + " üzerinde.")
        bulgular = h.denetle(depo({"kb/kural/KU-001-durum-tablodan.md": k}), bugun=BUGUN)
        hassas = [b for b in bulgular if b["ad"] == "hassas-veri"]
        self.assertEqual(len(hassas), 1)
        self.assertNotIn(gizli, json.dumps(hassas, ensure_ascii=False))


class Z18KararBicimi(unittest.TestCase):
    TEK = KARAR.replace("agirlik: cift-yonlu", "agirlik: tek-yonlu")

    def test_agirligi_olmayan_karar_yakalanir(self):
        k = KARAR.replace("agirlik: cift-yonlu\n", "")
        self.assertIn("agirliksiz", adlar(depo({"kb/karar/KR-001-durum-tablosu.md": k})))

    def test_tek_secenekli_karar_yakalanir(self):
        k = KARAR.replace("### B — Her serviste kontrol\nİki yerde farklılaşır.\n", "")
        self.assertIn("tek-secenek", adlar(depo({"kb/karar/KR-001-durum-tablosu.md": k})))

    def test_tek_yonlu_karar_butun_bolumleri_ister(self):
        eksik = {b["yer"] for b in h.denetle(depo({"kb/karar/KR-001-durum-tablosu.md": self.TEK}),
                                              bugun=BUGUN) if b["ad"] == "eksik-bolum"}
        self.assertTrue(eksik)
        mesajlar = " ".join(b["mesaj"] for b in h.denetle(
            depo({"kb/karar/KR-001-durum-tablosu.md": self.TEK}), bugun=BUGUN))
        for bolum in ("Ölçütler", "Seçim", "Doğrulama", "Varsayımlar", "Geri dönüş", "İstisna yolu"):
            self.assertIn(bolum, mesajlar)

    def test_tek_yonlu_kararda_sayisiz_olcut_yakalanir(self):
        k = self.TEK + ("\n## Ölçütler\nHızlı olmalı.\n\n## Seçim\nA.\n\n## Doğrulama\nDN-001. Birim: uç.\n\n"
                        "## Varsayımlar\n- yok: ölçüldü.\n\n## Geri dönüş\nUcuz.\n\n## İstisna yolu\nİstisnası yok.\n")
        self.assertIn("olcutsuz", adlar(depo({"kb/karar/KR-001-durum-tablosu.md": k})))

    def test_tam_yazilmis_tek_yonlu_karar_gecer(self):
        k = self.TEK + ("\n## Ölçütler\nYanıtların %95'i 200 ms altında.\n\n## Seçim\nA.\n\n"
                        "## Doğrulama\nDN-001. Birim: uç.\n\n## Varsayımlar\n- yük: ölçüldü.\n\n"
                        "## Geri dönüş\nUcuz.\n\n## İstisna yolu\nİstisnası yok; tek giriş noktası var.\n")
        kok = depo({"kb/karar/KR-001-durum-tablosu.md": k,
                    "kb/denetim/DN-001-olcum.md": "---\nkimlik: DN-001\ntur: denetim\ndurum: kabul\n"
                    "surum: 1\nbaslik: Yük ölçümü\ncesit: komut\n---\nYük testi.\n"})
        self.assertEqual(kirmizilar(kok), set())

    def test_kesin_kural_doguran_karar_istisna_yolu_ister(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": Z15Z16.KESIN})
        # çift yönlü karar, ama ondan kesin kural doğuyor
        self.assertIn("istisna-yolu-yok", adlar(kok))


class Kapsam(unittest.TestCase):
    def test_yola_dusen_kurallar_bulunur(self):
        s = h.sor_yol(depo(), "src/siparis/iptal.ts")
        self.assertEqual(s["yapi"]["kimlik"], "YP-001")
        self.assertEqual([k["kimlik"] for k in s["kurallar"]], ["KU-001"])

    def test_kapsam_disindaki_yola_kural_dusmez(self):
        kok = depo({"src/odeme/a.ts": "x\n"})
        self.assertEqual(h.sor_yol(kok, "src/odeme/a.ts")["kurallar"], [])

    def test_yapi_kimligiyle_yazilan_kapsam_o_yapinin_yollarina_uygulanir(self):
        k = KURAL.replace("kapsam: [src/siparis/**]", "kapsam: [YP-001]")
        s = h.sor_yol(depo({"kb/kural/KU-001-durum-tablodan.md": k}), "src/siparis/iptal.ts")
        self.assertEqual([x["kimlik"] for x in s["kurallar"]], ["KU-001"])

    def test_katmanla_yazilan_kapsam_o_katmandaki_yapilara_uygulanir(self):
        k = KURAL.replace("kapsam: [src/siparis/**]", "kapsam_katman: [alan]")
        s = h.sor_yol(depo({"kb/kural/KU-001-durum-tablodan.md": k}), "src/siparis/iptal.ts")
        self.assertEqual([x["kimlik"] for x in s["kurallar"]], ["KU-001"])

    def test_taslak_kural_yola_dusmez(self):
        k = KURAL.replace("durum: kabul", "durum: taslak")
        s = h.sor_yol(depo({"kb/kural/KU-001-durum-tablodan.md": k}), "src/siparis/iptal.ts")
        self.assertEqual(s["kurallar"], [])

    def test_tek_yildiz_dizin_sinirini_gecmez(self):
        self.assertTrue(h.desen_eslesir("src/*.ts", "src/a.ts"))
        self.assertFalse(h.desen_eslesir("src/*.ts", "src/x/a.ts"))
        self.assertTrue(h.desen_eslesir("src/**", "src/x/y/a.ts"))
        self.assertTrue(h.desen_eslesir("**", "her/yer.md"))


class Paket(unittest.TestCase):
    def _kok(self):
        return depo({"kb/kural/KU-001-durum-tablodan.md": Z15Z16.KESIN.replace(
            "bicim: kural", "bicim: kural\nrol: [uygulayici]\nkonu: [veri-modeli]"),
            "kb/karar/KR-001-durum-tablosu.md": KARAR + "\n## İstisna yolu\nİstisnası yok.\n"})

    def test_kesin_kural_rolu_tutan_pakete_tam_metniyle_girer(self):
        p = h.paket(self._kok(), "uygulayici")
        self.assertIn("KU-001@1", p["metin"])
        self.assertIn("Durumu değiştiren her kod yolu geçiş tablosundan geçer.", p["metin"])

    def test_rolu_tutmayan_pakete_kesin_kural_girmez(self):
        self.assertNotIn("KU-001", h.paket(self._kok(), "inceleyici")["metin"])

    def test_konu_verilince_konusu_tutmayan_kesin_kural_cikar(self):
        kok = self._kok()
        self.assertEqual(h.paket(kok, "uygulayici", konular=["baska"])["kurallar"], [])
        self.assertEqual(h.paket(kok, "uygulayici", konular=["veri-modeli"])["kurallar"], ["KU-001@1"])

    def test_ayni_girdi_ayni_ozeti_verir_ve_ozet_metne_baglidir(self):
        kok = self._kok()
        a, b = h.paket(kok, "uygulayici"), h.paket(kok, "uygulayici")
        self.assertEqual(a["ozet"], b["ozet"])
        self.assertIn("ozet=" + a["ozet"], a["metin"])
        self.assertEqual(h.paket_ozeti_dogrula(a["metin"]), a["ozet"])
        self.assertIsNone(h.paket_ozeti_dogrula(a["metin"].replace("geçer", "geçmez")))

    def test_tasarimci_paketi_reddedilen_secenekleri_tasir(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": Z15Z16.KESIN,
                    "kb/karar/KR-001-durum-tablosu.md": KARAR + "\n## İstisna yolu\nİstisnası yok.\n"})
        self.assertIn("Her serviste kontrol", h.paket(kok, "tasarimci")["metin"])

    def test_yol_verilince_o_yola_dusen_olagan_kural_da_girer(self):
        p = h.paket(depo(), "uygulayici", yollar=["src/siparis/iptal.ts"])
        self.assertIn("KU-001@1", p["metin"])


class Uretim(unittest.TestCase):
    def test_uret_yol_kapsamli_kural_dosyasi_yazar(self):
        kok = depo()
        metin = (kok / ".claude/rules/KU-001.md").read_text(encoding="utf-8")
        self.assertIn('  - "src/siparis/**"', metin)
        self.assertIn("Durumu değiştiren her kod yolu geçiş tablosundan geçer.", metin)

    def test_uret_rol_basina_ajan_tanimi_yazar(self):
        kok = depo()
        for rol in AYAR["roller"]:
            self.assertTrue((kok / ".claude/agents" / (rol + ".md")).is_file())

    def _ajan_basligi(self, kok, rol):
        return (kok / ".claude/agents" / (rol + ".md")).read_text(encoding="utf-8").split("---")[1]

    def test_kesif_ajani_yalniz_okuma_araclariyla_uretilir(self):
        self.assertIn("\ntools: Read, Grep, Glob\n", self._ajan_basligi(depo(), "kesif"))

    def test_inceleyici_ve_tasarimci_dosya_yazma_araci_olmadan_uretilir(self):
        kok = depo()
        for rol in ("inceleyici", "tasarimci"):
            araclar = [s for s in self._ajan_basligi(kok, rol).split("\n") if s.startswith("tools: ")]
            self.assertEqual(len(araclar), 1, rol)
            self.assertIn("Read", araclar[0])
            for yasak in ("Edit", "Write", "NotebookEdit"):
                self.assertNotIn(yasak, araclar[0], rol)

    def test_uygulayici_butun_araclari_devralir(self):
        self.assertNotIn("tools:", self._ajan_basligi(depo(), "uygulayici"))

    def test_rolun_araclari_ayardan_degistirilebilir(self):
        kok = depo(ayar={"rol_araclari": {"kesif": "Read, Grep, Glob, Bash", "uygulayici": "Read, Edit"}})
        self.assertIn("\ntools: Read, Grep, Glob, Bash\n", self._ajan_basligi(kok, "kesif"))
        self.assertIn("\ntools: Read, Edit\n", self._ajan_basligi(kok, "uygulayici"))

    def test_ayarda_bos_birakilan_rol_butun_araclari_devralir(self):
        self.assertNotIn("tools:", self._ajan_basligi(depo(ayar={"rol_araclari": {"kesif": ""}}), "kesif"))

    def test_kesif_ajani_hizli_modelle_digerleri_oturumun_modeliyle_uretilir(self):
        kok = depo()
        self.assertIn("\nmodel: haiku\n", self._ajan_basligi(kok, "kesif"))
        for rol in ("tasarimci", "uygulayici", "inceleyici"):
            self.assertNotIn("model:", self._ajan_basligi(kok, rol), rol)

    def test_rolun_modeli_ayardan_degistirilebilir(self):
        kok = depo(ayar={"rol_modelleri": {"tasarimci": "opus", "kesif": ""}})
        self.assertIn("\nmodel: opus\n", self._ajan_basligi(kok, "tasarimci"))
        self.assertNotIn("model:", self._ajan_basligi(kok, "kesif"))

    def test_ajan_basligi_ad_ve_aciklama_tasir(self):
        baslik = self._ajan_basligi(depo(), "kesif")
        self.assertIn("\nname: kesif\n", baslik)
        self.assertIn("\ndescription: ", baslik)

    def test_uret_elle_yazilan_agents_girisini_korur(self):
        kok = depo()
        self.assertIn("Elle yazılan giriş.", (kok / "AGENTS.md").read_text(encoding="utf-8"))

    def test_kural_emekli_olunca_uretilen_dosyasi_silinir(self):
        kok = depo()
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8").replace("durum: kabul", "durum: emekli"),
                     encoding="utf-8")
        h.uret(kok)
        self.assertFalse((kok / ".claude/rules/KU-001.md").exists())


class YeniVeKabul(unittest.TestCase):
    def _sablonlu(self):
        kaynak = pathlib.Path(h.__file__).resolve().parent / "sablon"
        ek = {"harness/sablon/" + p.name: p.read_text(encoding="utf-8") for p in kaynak.glob("*.md")}
        return depo(ek)

    def test_yeni_siradaki_kimlikle_taslak_acar(self):
        kok = self._sablonlu()
        yol = h.yeni(kok, "kural", "Dış çağrı adaptörden yapılır")
        self.assertEqual(yol.name, "KU-002-dis-cagri-adaptorden-yapilir.md")
        self.assertIn("durum: taslak", yol.read_text(encoding="utf-8"))

    def _gunluk(self, kok):
        return [s for s in (kok / "kb/GUNLUK.md").read_text(encoding="utf-8").split("\n") if s.startswith("## [")]

    def test_yeni_taslak_gunluge_yazilir(self):
        kok = self._sablonlu()
        h.yeni(kok, "karar", "Yeni karar")
        son = self._gunluk(kok)[-1]
        self.assertRegex(son, r"^## \[\d{4}-\d{2}-\d{2}\] taslak \| KR-002 Yeni karar$")

    def test_kabul_gunluge_surumuyle_yazilir(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("durum: kabul", "durum: taslak")})
        h.kabul(kok, "KU-001", onay=True)
        self.assertRegex(self._gunluk(kok)[-1], r"^## \[\d{4}-\d{2}-\d{2}\] kabul \| KU-001@1 Durum yalnız tablodan değişir$")

    def test_reddedilen_kabul_gunluge_yazilmaz(self):
        kok = self._sablonlu()
        yol = h.yeni(kok, "kural", "Eksik kural")
        once = self._gunluk(kok)
        with self.assertRaises(h.HarnessHata):
            h.kabul(kok, h.kimlik_oku(yol), onay=True)
        self.assertEqual(self._gunluk(kok), once)

    def test_gunluk_yalniz_eklenir_ve_sirayi_korur(self):
        kok = self._sablonlu()
        h.yeni(kok, "karar", "Birinci")
        h.yeni(kok, "karar", "İkinci")
        self.assertEqual([s.split("| ")[1] for s in self._gunluk(kok)], ["KR-002 Birinci", "KR-003 İkinci"])

    def test_gunluk_dosyasi_dugum_sayilmaz_ve_kapiyi_bozmaz(self):
        kok = self._sablonlu()
        h.yeni(kok, "karar", "Yeni karar")
        self.assertEqual(kirmizilar(kok), set())
        self.assertNotIn("taninmayan-dosya", adlar(kok))

    def test_taslak_dugum_kapiyi_kirmizi_yapmaz(self):
        kok = self._sablonlu()
        h.yeni(kok, "karar", "Yeni karar")
        h.yeni(kok, "kural", "Yeni kural")
        self.assertEqual(kirmizilar(kok), set())

    def test_kabul_bicimi_bozuk_dugumu_reddeder(self):
        kok = self._sablonlu()
        yol = h.yeni(kok, "kural", "Eksik kural")
        with self.assertRaises(h.HarnessHata):
            h.kabul(kok, h.kimlik_oku(yol), onay=True)

    def test_kabul_gecerli_taslagi_kabul_eder(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("durum: kabul", "durum: taslak")})
        h.kabul(kok, "KU-001", onay=True)
        self.assertIn("durum: kabul", (kok / "kb/kural/KU-001-durum-tablodan.md").read_text(encoding="utf-8"))
        self.assertEqual(kirmizilar(kok), set())

    def test_kabul_onaysiz_calismaz(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("durum: kabul", "durum: taslak")})
        with self.assertRaises(h.HarnessHata):
            h.kabul(kok, "KU-001", onay=False)

    def _hepsi_taslak(self, **ek):
        dosyalar = {"kb/karar/KR-001-durum-tablosu.md": KARAR.replace("durum: kabul", "durum: taslak"),
                    "kb/kural/KU-001-durum-tablodan.md": KURAL.replace("durum: kabul", "durum: taslak")}
        dosyalar.update(ek)
        return depo(dosyalar)

    def test_hicbir_sey_kabul_degilken_once_karar_sonra_kural_kabul_edilir(self):
        """Gerçek sıra: karar kabul edildiği anda ondan doğan kabul edilmiş kural olamaz; bu, kabulü engellemez."""
        kok = self._hepsi_taslak()
        h.kabul(kok, "KR-001", onay=True)
        self.assertEqual(kirmizilar(kok), {"sonucsuz-karar"})   # kural kabul edilene kadar kapı kırmızı kalır
        h.kabul(kok, "KU-001", onay=True)
        self.assertEqual(kirmizilar(kok), set())

    def test_karari_kabul_edilmemis_kural_kabul_edilemez(self):
        kok = self._hepsi_taslak()
        with self.assertRaises(h.HarnessHata) as c:
            h.kabul(kok, "KU-001", onay=True)
        self.assertIn("KR-001 henüz kabul edilmedi", str(c.exception))
        self.assertIn("durum: taslak", (kok / "kb/kural/KU-001-durum-tablodan.md").read_text(encoding="utf-8"))

    def test_bicimi_bozuk_karar_kuralsiz_diye_aklanmaz(self):
        tek = KARAR.replace("durum: kabul", "durum: taslak").replace("### B — Her serviste kontrol\nİki yerde farklılaşır.\n", "")
        kok = self._hepsi_taslak(**{"kb/karar/KR-001-durum-tablosu.md": tek})
        with self.assertRaises(h.HarnessHata) as c:
            h.kabul(kok, "KR-001", onay=True)
        self.assertIn("tek-secenek", str(c.exception))
        self.assertIn("durum: taslak", (kok / "kb/karar/KR-001-durum-tablosu.md").read_text(encoding="utf-8"))

    def test_kabul_notu_bekleyen_taslak_kurallari_sayar(self):
        kok = self._hepsi_taslak()
        self.assertIsNone(h.kabul_notu(kok, "KR-001"))   # henüz kabul edilmedi: not yok
        h.kabul(kok, "KR-001", onay=True)
        not_ = h.kabul_notu(kok, "KR-001")
        self.assertIn("KU-001", not_)
        self.assertIn("kırmızı", not_)
        h.kabul(kok, "KU-001", onay=True)
        self.assertIsNone(h.kabul_notu(kok, "KR-001"))   # kuralı kabul edildi: söylenecek bir şey kalmadı
        self.assertIsNone(h.kabul_notu(kok, "KU-001"))



def paketli_depo(**ek):
    """Çekirdek paketi taşıyan, bilgi tabanı boş bir depo: iskeletin yeni kopyalandığı proje gibi."""
    kaynak = pathlib.Path(h.__file__).resolve().parent / "paket" / "cekirdek"
    dosyalar = {"kb/karar/KR-001-durum-tablosu.md": None, "kb/kural/KU-001-durum-tablodan.md": None,
                "kb/yapi/YP-001-siparis.md": None}
    dosyalar.update({"harness/paket/cekirdek/" + q.relative_to(kaynak).as_posix(): q.read_text(encoding="utf-8")
                     for q in kaynak.rglob("*.md")})
    dosyalar.update(ek)
    return depo(dosyalar, uret=False)


def paket_metni(ad: str) -> str:
    kaynak = pathlib.Path(h.__file__).resolve().parent / "paket" / "cekirdek"
    return next(q for q in kaynak.rglob("*.md") if q.name.startswith(ad)).read_text(encoding="utf-8")


class Kurulum(unittest.TestCase):
    """`kur` çekirdek paketi kabul edilmiş olarak kurar: kullanıcı kimlik kimlik komut çalıştırmaz."""

    def _kur(self, kok):
        with contextlib.redirect_stdout(io.StringIO()) as c:
            kod = h._komut_kur(kok, [])
        return kod, c.getvalue()

    def _durumlar(self, kok):
        return {d["kimlik"]: d["durum"] for d in h.Dizin(kok).dugumler}

    def test_kur_cekirdek_paketi_kabul_edilmis_olarak_kurar(self):
        kok = paketli_depo()
        kod, cikti = self._kur(kok)
        self.assertEqual(kod, 0, cikti)
        durumlar = self._durumlar(kok)
        self.assertGreaterEqual(len(durumlar), 9)
        self.assertEqual(set(durumlar.values()), {"kabul"})
        self.assertEqual(h.denetle(kok), [])

    def test_kurulumdaki_her_kabul_gunluge_yazilir(self):
        kok = paketli_depo()
        self._kur(kok)
        satirlar = [s for s in (kok / "kb/GUNLUK.md").read_text(encoding="utf-8").split("\n") if "] kabul | " in s]
        self.assertEqual(len(satirlar), len(self._durumlar(kok)))

    def test_kur_ikinci_kez_calisinca_bilgi_tabanini_degistirmez(self):
        kok = paketli_depo()
        self._kur(kok)
        once = {q.relative_to(kok).as_posix(): q.read_text(encoding="utf-8") for q in (kok / "kb").rglob("*.md")}
        kod, _ = self._kur(kok)
        sonra = {q.relative_to(kok).as_posix(): q.read_text(encoding="utf-8") for q in (kok / "kb").rglob("*.md")}
        self.assertEqual(kod, 0)
        self.assertEqual(once, sonra)

    def test_kur_degistirilmis_taslagi_kabul_etmez(self):
        degisik = paket_metni("KU-005").replace("## Neden", "Bu projeye özel ek cümle.\n\n## Neden")
        kok = paketli_depo(**{"kb/kural/KU-005-once-sadelik.md": degisik})
        kod, _ = self._kur(kok)
        durumlar = self._durumlar(kok)
        self.assertEqual(kod, 0)
        self.assertEqual(durumlar["KU-005"], "taslak")
        self.assertEqual(durumlar["KU-006"], "kabul")
        self.assertEqual(durumlar["KR-003"], "kabul")

    def test_kur_degistirilmis_karara_dayanan_kurallari_bekletir_ve_soyler(self):
        degisik = paket_metni("KR-003").replace("## Bağlam", "Bu projeye özel ek cümle.\n\n## Bağlam")
        kok = paketli_depo(**{"kb/karar/KR-003-ajan-yalniz-isteneni-yapar.md": degisik})
        kod, cikti = self._kur(kok)
        durumlar = self._durumlar(kok)
        self.assertEqual(kod, 0, cikti)
        self.assertEqual((durumlar["KR-003"], durumlar["KU-005"], durumlar["KU-006"]), ("taslak",) * 3)
        self.assertEqual(durumlar["KU-001"], "kabul")
        self.assertIn("KU-005", cikti)
        self.assertEqual(kirmizilar(kok), set())

    def test_kur_var_olan_ozdes_taslaklari_da_kabul_eder(self):
        kaynak = pathlib.Path(h.__file__).resolve().parent / "paket" / "cekirdek"
        ek = {"kb/" + q.relative_to(kaynak).as_posix(): q.read_text(encoding="utf-8") for q in kaynak.rglob("*.md")}
        kok = paketli_depo(**ek)
        self._kur(kok)
        self.assertEqual(set(self._durumlar(kok).values()), {"kabul"})

    def test_kur_emekli_edilmis_cekirdek_dugume_dokunmaz(self):
        emekli = paket_metni("KU-006").replace("durum: taslak", "durum: emekli")
        kok = paketli_depo(**{"kb/kural/KU-006-cerrahi-degisiklik.md": emekli})
        self._kur(kok)
        durumlar = self._durumlar(kok)
        self.assertEqual(durumlar["KU-006"], "emekli")
        self.assertEqual(durumlar["KU-005"], "kabul")

    def test_kur_paketten_gelmeyen_taslagi_kabul_etmez(self):
        kendi = KURAL.replace("KU-001", "KU-050").replace("durum: kabul", "durum: taslak")
        kok = paketli_depo(**{"kb/kural/KU-050-projenin-kurali.md": kendi})
        self._kur(kok)
        self.assertEqual(self._durumlar(kok)["KU-050"], "taslak")


class KabulOnayi(unittest.TestCase):
    """Terminal dışında kabul, kapının kullanıcıya sorduğunu gösteren tek kullanımlık kayıtla çalışır."""

    def _taslakli(self):
        return depo({"kb/karar/KR-001-durum-tablosu.md": KARAR.replace("durum: kabul", "durum: taslak"),
                     "kb/kural/KU-001-durum-tablodan.md": KURAL.replace("durum: kabul", "durum: taslak")})

    def _kos(self, kok, *arg):
        return subprocess.run([sys.executable, str(pathlib.Path(h.__file__).resolve()), "kabul", *arg], cwd=kok,
                              capture_output=True, text=True, stdin=subprocess.DEVNULL)

    def _durum(self, kok, kimlik):
        return h.Dizin(kok).kimlik[kimlik]["durum"]

    def test_kararlar_kurallardan_once_siralanir(self):
        self.assertEqual(h.kabul_sirasi(["KU-002", "KR-001", "KU-001", "KR-001"]), ["KR-001", "KU-001", "KU-002"])

    def test_onay_kaydi_olmadan_komut_kabul_etmez(self):
        kok = self._taslakli()
        r = self._kos(kok, "KR-001")
        self.assertEqual(r.returncode, 2)
        self.assertIn("onay", r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertEqual(self._durum(kok, "KR-001"), "taslak")

    def test_onay_kaydiyla_komut_hepsini_dogru_sirayla_kabul_eder(self):
        kok = self._taslakli()
        h.onay_yaz(kok, ["KU-001", "KR-001"])
        r = self._kos(kok, "KU-001", "KR-001")     # kural önce yazılsa da karar önce kabul edilir
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual((self._durum(kok, "KR-001"), self._durum(kok, "KU-001")), ("kabul", "kabul"))
        self.assertEqual(kirmizilar(kok), set())

    def test_onay_kaydi_tek_kullanimliktir(self):
        kok = self._taslakli()
        h.onay_yaz(kok, ["KR-001"])
        self.assertTrue(h.onay_kullan(kok, ["KR-001"]))
        self.assertFalse(h.onay_kullan(kok, ["KR-001"]))

    def test_onay_kaydi_baska_kimlikler_icin_gecmez(self):
        kok = self._taslakli()
        h.onay_yaz(kok, ["KR-001"])
        r = self._kos(kok, "KR-001", "KU-001")
        self.assertEqual(r.returncode, 2)
        self.assertEqual(self._durum(kok, "KR-001"), "taslak")

    def test_eskimis_onay_kaydi_gecmez(self):
        kok = self._taslakli()
        h.onay_yaz(kok, ["KR-001"], simdi=time.time() - h.ONAY_SURESI_SN - 1)
        self.assertEqual(self._kos(kok, "KR-001").returncode, 2)
        self.assertEqual(self._durum(kok, "KR-001"), "taslak")

    def test_suresi_icindeki_onay_kaydi_gecer(self):
        kok = self._taslakli()
        h.onay_yaz(kok, ["KR-001"], simdi=time.time() - h.ONAY_SURESI_SN + 60)
        self.assertEqual(self._kos(kok, "KR-001").returncode, 0)

    def test_bozuk_onay_kaydi_gecmez(self):
        kok = self._taslakli()
        (kok / ".harness/onay").mkdir(parents=True)
        (kok / ".harness/onay/kabul.json").write_text("{bozuk", encoding="utf-8")
        self.assertFalse(h.onay_kullan(kok, ["KR-001"]))

    def test_kimliksiz_komut_kullanimi_soyler(self):
        r = self._kos(self._taslakli())
        self.assertEqual(r.returncode, 2)
        self.assertIn("kullanım", r.stderr)


class Kanarya(unittest.TestCase):
    def test_kapi_kendi_bozuk_orneginde_beklenen_bulgulari_verir(self):
        self.assertEqual(h.kanarya(), [])

    def test_bozulmus_kapi_olculemedi_doner(self):
        asil = h._kural_denetle
        h._kural_denetle = lambda *a, **k: []
        try:
            self.assertTrue(h.kanarya())
        finally:
            h._kural_denetle = asil


class CekirdekPaket(unittest.TestCase):
    """İskeletle gelen başlangıç kuralları, kabul edildiklerinde kapıdan geçmelidir."""

    def _kabul_edilmis(self):
        kaynak = pathlib.Path(h.__file__).resolve().parent / "paket" / "cekirdek"
        ek = {"kb/karar/KR-001-durum-tablosu.md": None, "kb/kural/KU-001-durum-tablodan.md": None,
              "kb/yapi/YP-001-siparis.md": None}
        for p in kaynak.rglob("*.md"):
            ek["kb/" + p.relative_to(kaynak).as_posix()] = p.read_text(encoding="utf-8").replace(
                "\ndurum: taslak\n", "\ndurum: kabul\n", 1)
        return depo(ek)

    def test_cekirdek_paket_bos_degildir(self):
        kaynak = pathlib.Path(h.__file__).resolve().parent / "paket" / "cekirdek"
        self.assertGreaterEqual(len(list(kaynak.rglob("*.md"))), 3)

    def test_kabul_edilen_cekirdek_paket_kapidan_gecer(self):
        self.assertEqual(h.denetle(self._kabul_edilmis(), bugun=BUGUN), [])

    def test_cekirdek_paket_kullanicinin_yapacagi_sirayla_kabul_edilir(self):
        """Dosyada durumu elle çevirmek yerine gerçek yol: taslaklar gelir, önce kararlar sonra kurallar kabul edilir."""
        kaynak = pathlib.Path(h.__file__).resolve().parent / "paket" / "cekirdek"
        ek = {"kb/karar/KR-001-durum-tablosu.md": None, "kb/kural/KU-001-durum-tablodan.md": None,
              "kb/yapi/YP-001-siparis.md": None}
        ek.update({"kb/" + p.relative_to(kaynak).as_posix(): p.read_text(encoding="utf-8")
                   for p in kaynak.rglob("*.md")})
        kok = depo(ek)
        kimlikler = sorted(h.kimlik_oku(p) for p in kaynak.rglob("*.md"))
        self.assertGreaterEqual(len(kimlikler), 9)
        for kimlik in [k for k in kimlikler if k.startswith("KR-")] + [k for k in kimlikler if k.startswith("KU-")]:
            h.kabul(kok, kimlik, onay=True)
        self.assertEqual(h.denetle(kok), [])
        self.assertEqual(len(h.Dizin(kok).tur("kural")), len([k for k in kimlikler if k.startswith("KU-")]))

    def test_cekirdek_kurallar_her_role_kesin_olarak_gider(self):
        kok = self._kabul_edilmis()
        ortak = ["KU-001@1", "KU-002@1", "KU-003@1", "KU-004@1"]
        kod_yazan = ortak + ["KU-005@1", "KU-006@1"]   # sadelik ve cerrahi değişiklik: yazana ve inceleyene
        beklenen = {"tasarimci": ortak, "kesif": ortak, "uygulayici": kod_yazan, "inceleyici": kod_yazan}
        for rol in AYAR["roller"]:
            self.assertEqual(h.paket(kok, rol)["kurallar"], beklenen[rol], rol)

    def test_cekirdek_kurallar_agents_blogunda_gorunur(self):
        metin = (self._kabul_edilmis() / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("KU-001@1", metin)
        self.assertIn("KU-002@1", metin)
        self.assertIn("KU-003@1", metin)
        self.assertIn("KU-004@1", metin)


class Duzey(unittest.TestCase):
    def test_bilinmeyen_duzey_degeri_olculemedi_sayilir(self):
        kok = depo(ayar={"duzey": 9}, uret=False)
        with self.assertRaises(h.HarnessHata):
            h.denetle(kok, bugun=BUGUN)


class CalismaAgaci(unittest.TestCase):
    """Her oturum ve görev kendi çalışma ağacında çalışır; ortak kayıtlar ana ağaçta durur."""

    def test_git_olmayan_klasorde_agac_turu_yoktur(self):
        kok = depo()
        self.assertEqual(h.agac_turu(kok), "yok")
        self.assertEqual(h.ortak_kok(kok), kok)

    def test_ana_agacin_ortak_koku_kendisidir(self):
        kok = git_depo(depo())
        self.assertEqual(h.agac_turu(kok), "ana")
        self.assertEqual(h.ortak_kok(kok), kok)

    def test_bagli_agacin_ortak_koku_ana_agactir(self):
        kok = git_depo(depo())
        agac = agac_ac(kok, "a")
        self.assertEqual(h.agac_turu(agac), "bagli")
        self.assertEqual(h.ortak_kok(agac).resolve(), kok.resolve())

    def test_ilk_commit_atilmadan_commit_yok_sayilir(self):
        kok = git_depo(depo(), commit=False)
        self.assertFalse(h.commit_var(kok))
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "ilk")
        self.assertTrue(h.commit_var(kok))

    def test_ic_ice_calisma_agaci_dosya_taramasina_girmez(self):
        kok = git_depo(depo())
        agac_ac(kok, "a")
        dosyalar = h.dosyalari_listele(kok, h.ayar_oku(kok))
        self.assertIn("src/siparis/iptal.ts", dosyalar)
        self.assertEqual([f for f in dosyalar if f.startswith(".claude/worktrees/")], [])

    def test_ic_ice_calisma_agaci_denetimi_bozmaz(self):
        kok = git_depo(depo())
        agac_ac(kok, "a")
        self.assertEqual(h.denetle(kok, bugun=BUGUN), [])

    def test_bagli_agac_kendi_basina_denetlenir(self):
        kok = git_depo(depo())
        self.assertEqual(h.denetle(agac_ac(kok, "a"), bugun=BUGUN), [])

    def test_kur_gunlugun_birlesimini_cakismasiz_yapar(self):
        import contextlib
        import io
        kok = depo()
        for _ in range(2):
            with contextlib.redirect_stdout(io.StringIO()):
                h._komut_kur(kok, [])
        satirlar = (kok / ".gitattributes").read_text(encoding="utf-8").split("\n")
        self.assertEqual(satirlar.count("kb/GUNLUK.md merge=union"), 1)

    def test_iki_dalda_eklenen_gunluk_satirlari_catismadan_birlesir(self):
        import contextlib
        import io
        kok = depo()
        (kok / "kb/GUNLUK.md").write_text("# Günlük\n\n## [2026-01-01] taslak | KR-001 Bir\n", encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            h._komut_kur(kok, [])
        git_depo(kok)
        for dal, satir in (("a", "KR-002 İki"), ("b", "KR-003 Üç")):
            git(kok, "checkout", "-q", "-b", dal, "main")
            with (kok / "kb/GUNLUK.md").open("a", encoding="utf-8") as f:
                f.write("## [2026-01-02] taslak | %s\n" % satir)
            git(kok, "commit", "-q", "-am", dal)
        git(kok, "checkout", "-q", "a")
        git(kok, "merge", "-q", "--no-edit", "b")
        metin = (kok / "kb/GUNLUK.md").read_text(encoding="utf-8")
        self.assertIn("KR-002 İki", metin)
        self.assertIn("KR-003 Üç", metin)
        self.assertNotIn("<<<<<<<", metin)

    def test_kur_yerel_klasorleri_gitignore_dosyasina_yazar(self):
        import contextlib
        import io
        kok = depo()
        (kok / ".gitignore").write_text("node_modules/\n", encoding="utf-8")
        for _ in range(2):
            with contextlib.redirect_stdout(io.StringIO()):
                h._komut_kur(kok, [])
        satirlar = (kok / ".gitignore").read_text(encoding="utf-8").split("\n")
        self.assertEqual(satirlar.count(".harness/"), 1)
        self.assertEqual(satirlar.count(".claude/worktrees/"), 1)
        self.assertIn("node_modules/", satirlar)


class KomutSatiri(unittest.TestCase):
    """Komut, beklenen bir hatada iz dökümü basmaz: nedeni söyler ve 2 ile çıkar."""

    def _kos(self, kok, *arg):
        return subprocess.run([sys.executable, str(pathlib.Path(h.__file__).resolve()), *arg], cwd=kok,
                              capture_output=True, text=True)

    def test_olmayan_gorev_iz_dokumu_degil_neden_basar(self):
        r = self._kos(git_depo(depo()), "gorev", "kos", "GV-999")
        self.assertEqual(r.returncode, 2)
        self.assertIn("GV-999", r.stderr)
        self.assertNotIn("Traceback", r.stderr)

    def test_harness_olmayan_klasorde_neden_basar(self):
        r = self._kos(pathlib.Path(tempfile.mkdtemp(prefix="harness-bos-")), "durum")
        self.assertEqual(r.returncode, 2)
        self.assertIn("harness.json", r.stderr)
        self.assertNotIn("Traceback", r.stderr)

    def test_temiz_depoda_denetle_sifirla_cikar(self):
        self.assertEqual(self._kos(depo(), "denetle").returncode, 0)


class SkillDosyalari(unittest.TestCase):
    """İskeletin iş akışları skill olarak durur (.claude/skills/<ad>/SKILL.md); eski komut biçimi kullanılmaz."""

    KOK = pathlib.Path(h.__file__).resolve().parents[1]
    BEKLENEN = {"karar", "kural", "tasarla", "plan", "gorev", "hata-ayikla", "kb-ice-al", "kb-tara"}
    BOLUMLER = ("Ne zaman", "Ne zaman değil", "Adımlar", "Yapma", "İlgili skill'ler", "Sınırlar")

    def _basliklar(self):
        sonuc = {}
        for yol in sorted((self.KOK / ".claude/skills").glob("*/SKILL.md")):
            metin = yol.read_text(encoding="utf-8")
            self.assertTrue(metin.startswith("---\n"), yol)
            alanlar = dict(s.split(": ", 1) for s in metin.split("---")[1].strip().split("\n") if ": " in s)
            sonuc[yol.parent.name] = (alanlar, metin)
        return sonuc

    def test_is_akislari_skill_olarak_durur(self):
        # GV-164: tam liste değil, kapsama sınanır; yeni eklenen skill bu testi kırmaz, öbür testler onu da sınar
        self.assertLessEqual(self.BEKLENEN, set(self._basliklar()))

    def test_skill_adi_klasor_adiyla_aynidir_ve_aciklamasi_vardir(self):
        for ad, (alanlar, _) in self._basliklar().items():
            self.assertEqual(alanlar.get("name"), ad)
            self.assertGreater(len(alanlar.get("description", "")), 40, ad)

    def test_skill_aciklamasi_ne_zaman_kullanilacagini_soyler(self):
        for ad, (alanlar, _) in self._basliklar().items():
            self.assertIn("kullan", alanlar["description"].lower(), ad)

    def test_skill_govdesi_argumani_alir(self):
        for ad, (_, metin) in self._basliklar().items():
            self.assertIn("$ARGUMENTS", metin, ad)

    def test_her_skill_ayni_bolum_iskeletini_tasir(self):
        for ad, (_, metin) in self._basliklar().items():
            basliklar = [s[3:].strip() for s in metin.split("\n") if s.startswith("## ")]
            self.assertEqual([b for b in self.BOLUMLER if b in basliklar], list(self.BOLUMLER), ad)

    def test_bolumler_ayni_sirayla_gelir(self):
        for ad, (_, metin) in self._basliklar().items():
            sira = [metin.index("\n## %s\n" % b) for b in self.BOLUMLER]
            self.assertEqual(sira, sorted(sira), ad)

    def test_eski_komut_bicimi_kalmamistir(self):
        self.assertFalse((self.KOK / ".claude/commands").exists())


if __name__ == "__main__":
    unittest.main(verbosity=1)
