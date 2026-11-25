#!/usr/bin/env python3
"""GV-126 (TS-006 Yapı 11) testleri: kart ön denetimi.

a) Eşiğin üstünde dosyaya düşen desenle açılan kart 'kapsam geniş' uyarısını sayıyla taşır; altında taşımaz.
b) Uzun hedef ve ölçütle açılan kart 'kart büyük' uyarısını taşır.
c) Kapsamın içindeki bir dosyayı içe aktaran kapsam dışı iki dosya (biri .js belirteciyle .ts dosyasını, biri klasörün
   index dosyasını) listelenir; kapsamın içindeki dosyalar ve paket içe aktarmaları listelenmez.
d) Uyarılar kartın 'Kapsam notu' bölümünde vardır; uyarı yoksa bölüm yazılmaz ve kart bugünküyle aynıdır.

Her test geçici bir git deposu kurar (test_gorev.py'deki gibi; kaynak kökü `src`); gerçek görev kayıtlarına ve
gerçek bilgi tabanına dokunmaz.

Koşum: python3 harness/test/test_kart.py
"""
from __future__ import annotations

import contextlib
import io
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
from test_gorev import gorev_deposu  # noqa: E402
from test_h import git_depo  # noqa: E402

HEDEF, OLCUT = "İptal isteğine neden kodu ekle.", "Neden kodu olmadan istek reddedilir."

KAYNAK = {
    "src/siparis/neden/index.ts": "export const neden = 1\n",
    "src/siparis/ic.ts": "import { x } from './iptal.js'\nimport { neden } from './neden'\n",
    # kapsam dışı; .js belirteci .ts dosyasına çözülür
    "src/odeme/a.ts": "import { x } from '../siparis/iptal.js'\n",
    # kapsam dışı; uzantısız belirteç klasörün index dosyasına çözülür (çok satırlı export-from)
    "src/odeme/b.ts": "export {\n  neden,\n} from \"../siparis/neden\"\n",
    # paket adları, çözülemeyen göreli belirteç ve kapsam dışı hedef listelenmez
    "src/odeme/c.ts": "import a from 'siparis'\nimport b from '@app/siparis/iptal'\nimport c from './yok'\n"
                      "import d from './a'\n",
    # kaynak kökünün dışında: listelenmez
    "scripts/tohum.ts": "import { x } from '../src/siparis/iptal'\n",
}


def deposu(dosyalar: dict, **gorev_ayari) -> pathlib.Path:
    """Sahte kaynak ağacı commit edilmiş görev deposu."""
    kok = gorev_deposu(git_li=False, **gorev_ayari)
    for yol, icerik in dosyalar.items():
        p = kok / yol
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(icerik, bytes):
            p.write_bytes(icerik)
        else:
            p.write_text(icerik, encoding="utf-8")
    return git_depo(kok)


def kart_ac(kok, yollar=("src/siparis/**",), hedef=HEDEF, olcut=OLCUT):
    """Kartı açar: (kart metni, standart çıktı)."""
    cikti = io.StringIO()
    with contextlib.redirect_stdout(cikti):
        kart = gorev.yeni(kok, "İş", "uygulayici", list(yollar), [], hedef=hedef, olcut=olcut)
    return kart.read_text(encoding="utf-8"), cikti.getvalue()


def kapsam_notu(kart: str) -> str:
    return gorev._bolum(kart, "Kapsam notu")


class Ayarlar(unittest.TestCase):
    def test_esikler_harness_jsonda_yazmasa_da_varsayilanla_gelir(self):
        g = h.ayar_oku(gorev_deposu(git_li=False))["gorev"]
        self.assertEqual((g["kapsam_dosya_esigi"], g["kart_karakter_esigi"]), (60, 6000))


class KapsamGenisligi(unittest.TestCase):
    def test_esigin_ustunde_kart_sayiyla_uyari_tasir(self):
        kok = deposu({"src/siparis/%d.ts" % i: "export const x = 1\n" for i in range(3)}, kapsam_dosya_esigi=3)
        kart, cikti = kart_ac(kok)
        self.assertIn("kapsam geniş: 4 dosya; bölmeyi düşün", kapsam_notu(kart))
        self.assertIn("[harness] GV-001 kapsam geniş: 4 dosya; bölmeyi düşün", cikti)

    def test_esikte_ve_altinda_uyari_yok(self):
        kok = deposu({"src/siparis/%d.ts" % i: "export const x = 1\n" for i in range(2)}, kapsam_dosya_esigi=3)
        kart, cikti = kart_ac(kok)
        self.assertNotIn("kapsam geniş", kart + cikti)

    def test_varsayilan_esik_60(self):
        kok = deposu({"src/siparis/%d.ts" % i: "export const x = 1\n" for i in range(60)})
        kart, _ = kart_ac(kok)
        self.assertIn("kapsam geniş: 61 dosya", kart)
        kart, _ = kart_ac(kok, yollar=["src/siparis/1*.ts", "src/siparis/2*.ts"])
        self.assertNotIn("kapsam geniş", kart)


class KartBoyu(unittest.TestCase):
    def test_uzun_hedef_ve_olcut_kart_buyuk_uyarisi_tasir(self):
        kok = deposu({})
        kart, cikti = kart_ac(kok, hedef="h" * 3000, olcut="o" * 3001)
        self.assertIn("kart büyük; tek oturuma sığmayabilir", kapsam_notu(kart))
        self.assertIn("[harness] GV-001 kart büyük", cikti)

    def test_esikteki_metin_uyari_tasimaz(self):
        kok = deposu({})
        kart, _ = kart_ac(kok, hedef="h" * 3000, olcut="o" * 3000)
        self.assertNotIn("kart büyük", kart)


class ListeDisiIceAktaranlar(unittest.TestCase):
    def test_kapsam_disi_iki_iceaktaran_listelenir_ic_ve_paketler_listelenmez(self):
        kok = deposu(KAYNAK)
        self.assertEqual(gorev.liste_disi_iceaktaranlar(kok, ["src/siparis/**"]), ["src/odeme/a.ts", "src/odeme/b.ts"])
        kart, cikti = kart_ac(kok)
        not_ = kapsam_notu(kart)
        self.assertIn("liste dışı içe aktaranlar (2): src/odeme/a.ts, src/odeme/b.ts — taşıma ya da ad değişikliği "
                      "yapacaksan bunlar da değişir; listeye ekle ya da işi böl", not_)
        for olmamali in ("src/siparis/ic.ts", "src/odeme/c.ts", "scripts/tohum.ts"):
            self.assertNotIn(olmamali, not_)
        self.assertIn("[harness] GV-001 liste dışı içe aktaranlar (2)", cikti)

    def test_require_ve_uzantisiz_js_belirteci_de_bulunur(self):
        kok = deposu({"src/odeme/r.cjs": "const k = require( \"../siparis/iptal\" )\n",
                      "src/odeme/m.mjs": "import('../siparis/iptal.js').then(() => 1)\n"})
        self.assertEqual(gorev.liste_disi_iceaktaranlar(kok, ["src/siparis/**"]),
                         ["src/odeme/m.mjs", "src/odeme/r.cjs"])

    def test_en_cok_yirmisi_ve_toplam_sayi_yazilir(self):
        kok = deposu({"src/odeme/%02d.ts" % i: "import '../siparis/iptal'\n" for i in range(25)})
        kart, _ = kart_ac(kok)
        not_ = kapsam_notu(kart)
        self.assertIn("liste dışı içe aktaranlar (25): src/odeme/00.ts, ", not_)
        self.assertIn("src/odeme/19.ts, … — ", not_)
        self.assertNotIn("src/odeme/20.ts", not_)

    def test_bozuk_ve_okunamayan_dosyada_dusmez(self):
        kok = deposu({"src/odeme/bozuk.ts": b"\xff\xfe\x00import x from '../siparis/iptal\n\x00",
                      "src/odeme/silinen.ts": "import '../siparis/iptal'\n",
                      "src/odeme/a.ts": "import '../siparis/iptal'\n"})
        (kok / "src/odeme/silinen.ts").unlink()    # izlenen ama diskte yok
        self.assertEqual(gorev.liste_disi_iceaktaranlar(kok, ["src/siparis/**"]), ["src/odeme/a.ts"])

    def test_git_deposu_olmayan_yerde_de_kart_acilir(self):
        kok = gorev_deposu(git_li=False)
        (kok / "src/odeme").mkdir(parents=True)
        (kok / "src/odeme/a.ts").write_text("import '../siparis/iptal'\n", encoding="utf-8")
        kart, _ = kart_ac(kok)
        self.assertIn("liste dışı içe aktaranlar (1): src/odeme/a.ts", kart)


class KapsamNotu(unittest.TestCase):
    def test_uyari_yoksa_bolum_yazilmaz_ve_kart_bugunkuyle_ayni(self):
        kok = deposu({})
        kart, cikti = kart_ac(kok)
        d = {"kimlik": "GV-001", "baslik": "İş", "rol": "uygulayici", "yollar": ["src/siparis/**"], "konular": [],
             "yer": None}
        self.assertEqual(kart, gorev._kart_metni("GV-001", d, HEDEF, OLCUT,
                                                 h.paket(kok, "uygulayici", d["yollar"], [])["tam"]))
        self.assertNotIn("Kapsam notu", kart)
        self.assertNotIn("[harness] GV-001", cikti)

    def test_uyarilar_kartin_sonunda_kapsam_notu_bolumunde(self):
        kok = deposu(KAYNAK, kapsam_dosya_esigi=1)
        kart, _ = kart_ac(kok, hedef="h" * 7000)
        self.assertTrue(kart.rstrip("\n").split("\n## ")[-1].startswith("Kapsam notu\n"))
        not_ = kapsam_notu(kart)
        for parca in ("kapsam geniş: 3 dosya", "kart büyük", "liste dışı içe aktaranlar (2)"):
            self.assertIn(parca, not_)
        self.assertEqual(gorev._bolum(kart, "Kabul ölçütü"), OLCUT)   # öbür bölümler değişmez

    def test_plan_task_subtask_ve_gorev_yeni_komutu_da_uyarir(self):
        kok = deposu(KAYNAK)
        plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/siparis/**"])
        plan.epic(kok, "siparis", "İptal nedenleri", hedef="İptal nedenleri kayda girer.")
        cikti = io.StringIO()
        with contextlib.redirect_stdout(cikti):
            _, task_gorev = plan.task(kok, "EP-001", "Neden", rol="uygulayici", hedef=HEDEF, olcut=OLCUT)
            plan.task(kok, "EP-001", "Kapsayıcı")
            _, sub_gorev = plan.subtask(kok, "EP-001", "2", "Alt", rol="uygulayici", hedef=HEDEF, olcut=OLCUT)
            gorev.komut(kok, ["yeni", "Tek", "--yol", "src/siparis/**", "--hedef", HEDEF, "--olcut", OLCUT])
        for kimlik in (task_gorev, sub_gorev, "GV-003"):
            self.assertIn("[harness] %s liste dışı içe aktaranlar (2)" % kimlik, cikti.getvalue())
            kart = (h.ortak_kok(kok) / ".harness/gorev" / kimlik / "kart.md").read_text(encoding="utf-8")
            self.assertIn("src/odeme/a.ts, src/odeme/b.ts", kapsam_notu(kart))


if __name__ == "__main__":
    unittest.main()
