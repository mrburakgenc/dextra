#!/usr/bin/env python3
"""Sözlük (TS-009 Yapı 12): kabul edilmiş kavram düğümleri rol paketine bilgi bloğu olarak girer.

Biçim: kavramın `baslik` alanı terimdir, `kacin` kullanılmayacak eş anlamlılar, `konu` isteğe bağlı konulardır; gövdenin
ilk paragrafı tanımdır. Konusuz kavram her pakete, konulu kavram yalnız işin konularından biriyle kesişiyorsa girer;
taslak kavram girmez. Blok özet damgasının dışındadır; sözlükle birlikte paket bütçeyi aşarsa denetle kırmızıdır.

Koşum: python3 harness/test/test_sozluk.py
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import gorev  # noqa: E402
from test_h import AYAR, depo, git  # noqa: E402
from test_acikuc import KR_UCLU, KU_TASLAK_UCLU, deposu, kart_ac, kayit, sessiz  # noqa: E402

H_PY = str(BURASI.parent / "h.py")
SABLON = (BURASI.parent / "sablon" / "kavram.md").read_text(encoding="utf-8")
ROLLER = AYAR["roller"]
YONERGE = "Sözlük (bilgi; bağlayıcı değil)"


def kavram(kimlik="KV-001", durum="kabul", baslik="Sipariş", tanim="Müşterinin ödediği ve teslim bekleyen alım kaydı.",
           kacin="[order, talep]", konu=None) -> str:
    alanlar = ["kimlik: " + kimlik, "tur: kavram", "durum: " + durum, "surum: 1", "baslik: " + baslik]
    alanlar += (["kacin: " + kacin] if kacin else []) + (["konu: " + konu] if konu else [])
    return "---\n" + "\n".join(alanlar) + "\n---\n" + tanim + "\n"


KONUSUZ = {"kb/kavram/KV-001-siparis.md": kavram()}
KONULU = {"kb/kavram/KV-002-gecis-tablosu.md": kavram("KV-002", baslik="Geçiş tablosu", kacin=None,
                                                       tanim="Durumdan duruma izinli geçişleri tutan tablo.",
                                                       konu="[veri-modeli]")}
TASLAK = {"kb/kavram/KV-003-iade.md": kavram("KV-003", durum="taslak", baslik="İade", tanim="TASLAK-TANIM geri ödeme.")}


def cli(kok, *arg):
    return subprocess.run([sys.executable, H_PY] + list(arg), cwd=kok, capture_output=True, text=True,
                          encoding="utf-8", stdin=subprocess.DEVNULL)


def kirmizi_satirlar(kok) -> list:
    return [s for s in cli(kok, "denetle").stdout.split("\n") if "KIRMIZI" in s]


# Kavram yokken paketin bu görevden önceki biçimi (sabit; tabandan bağımsız): depo() üstünde, src/siparis/** yolu
# ve veri-modeli konusuyla. Sözlük bu metne hiçbir şey eklememelidir.
KU_001 = "KU-001@1 [gözden geçirme] Durumu değiştiren her kod yolu geçiş tablosundan geçer. (KR-001)"
BEKLENEN = {
    "uygulayici": "[[KB-PAKET rol=uygulayici ozet=c9546f30]]\nBu göreve düşen diğer kurallar:\n%s\n[[/KB-PAKET]]" % KU_001,
    "inceleyici": "[[KB-PAKET rol=inceleyici ozet=abd53c28]]\nBu göreve düşen diğer kurallar:\n[ ] %s → uyuyor / "
                  "uymuyor / uygulanmaz\n[[/KB-PAKET]]" % KU_001,
    "kesif": "[[KB-PAKET rol=kesif ozet=c9546f30]]\nBu göreve düşen diğer kurallar:\n%s\n[[/KB-PAKET]]" % KU_001,
    "tasarimci": "[[KB-PAKET rol=tasarimci ozet=5d0b6850]]\nBu göreve düşen diğer kurallar:\n%s\n\nBu kararlarda "
                 "değerlendirilmiş seçenekler (reddedileni yeniden önerme):\nKR-001 Durum tek tablodan yönetilir — "
                 "değerlendirilen seçenekler: A — Tek tablo; B — Her serviste kontrol\n[[/KB-PAKET]]" % KU_001,
}
BOS = "[[KB-PAKET rol=%s ozet=55d29494]]\n(bu role verilecek kural yok)\n[[/KB-PAKET]]"


class KavramsizPaket(unittest.TestCase):
    """a) Kabul edilmiş kavram yokken her rolün paket metni ve özet damgası bu görevden öncekiyle aynıdır."""

    def test_onceki_bicimle_ayni(self):
        for ek in ({}, TASLAK):
            kok = depo(ek)
            for rol in ROLLER:
                p = h.paket(kok, rol, ("src/siparis/**",), ("veri-modeli",))
                self.assertEqual((p["metin"], p["tam"], p["ozet"]), (BEKLENEN[rol], BEKLENEN[rol],
                                                                     h.PAKET.match(BEKLENEN[rol]).group(2)))
                p = h.paket(kok, rol)
                self.assertEqual((p["metin"], p["tam"], p["ozet"]), (BOS % rol, BOS % rol, "55d29494"))
                self.assertEqual(p["sozluk"], [])

    def test_taslak_kavram_paketi_degistirmez(self):
        """Taslak ve açık uç blokları varken de taslak kavram paketi değiştirmez; blok dizilimi korunur."""
        ek = {"kb/kural/KU-002-iptal-nedeni.md": KU_TASLAK_UCLU, "kb/karar/KR-001-durum-tablosu.md": KR_UCLU}
        bos, taslakli = depo(ek), depo(dict(ek, **TASLAK))
        for rol in ROLLER:
            p = h.paket(taslakli, rol, ("src/siparis/**",))
            self.assertEqual(p["tam"], h.paket(bos, rol, ("src/siparis/**",))["tam"])
            self.assertEqual(re.findall(r"(?m)^\[\[(KB-[A-Z-]+)", p["tam"]), ["KB-PAKET", "KB-TASLAK", "KB-ACIK-UC"])


class SozlukBlogu(unittest.TestCase):

    def test_konusuz_kavram_her_pakette_taslak_hicbirinde(self):
        """b) Konusuz kabul edilmiş kavram her rolün paketinde terim, tanım ve kullanma listesiyle görünür."""
        kok = depo(dict(KONUSUZ, **TASLAK))
        for rol in ROLLER:
            for konular in ((), ("veri-modeli",)):
                tam = h.paket(kok, rol, (), konular)["tam"]
                self.assertTrue(tam.endswith("\n\n[[KB-SOZLUK]]\n%s: bu işte terimleri bu anlamda kullan; ayraçtaki "
                                             "eş anlamlıları kullanma.\n\n- Sipariş: Müşterinin ödediği ve teslim "
                                             "bekleyen alım kaydı. (kullanma: order, talep)\n[[/KB-SOZLUK]]"
                                             % YONERGE), tam)
                self.assertNotIn("İade", tam)
                self.assertNotIn("TASLAK-TANIM", tam)

    def test_konulu_kavram_yalniz_konusu_tutan_iste(self):
        """c) Konulu kavram yalnız o konuyu taşıyan işin paketinde görünür."""
        kok = depo(dict(KONUSUZ, **KONULU))
        for rol in ROLLER:
            konulu = h.paket(kok, rol, (), ["veri-modeli"])
            self.assertIn("- Geçiş tablosu: Durumdan duruma izinli geçişleri tutan tablo.\n", konulu["tam"])
            self.assertEqual(konulu["sozluk"], ["KV-001", "KV-002"])
            for konular in ((), ("baska-konu",)):
                p = h.paket(kok, rol, (), konular)
                self.assertNotIn("Geçiş tablosu", p["tam"])
                self.assertIn("- Sipariş: ", p["tam"])

    def test_ozet_damgasi_ve_baglayici_blok_degismez(self):
        """d) Sözlük eklenince paketin özet damgası ve bağlayıcı bloğun metni değişmez; blok paketin sonundadır."""
        bos, dolu = depo(), depo(dict(KONUSUZ, **KONULU))
        for rol in ROLLER:
            once, sonra = h.paket(bos, rol, (), ["veri-modeli"]), h.paket(dolu, rol, (), ["veri-modeli"])
            self.assertEqual((sonra["metin"], sonra["ozet"]), (once["metin"], once["ozet"]))
            onek, _, blok = sonra["tam"].partition("\n\n[[KB-SOZLUK]]\n")
            self.assertEqual(onek, once["tam"])
            self.assertTrue(blok.endswith("\n[[/KB-SOZLUK]]"))
            self.assertEqual(h.paket_ozeti_dogrula(sonra["tam"]), once["ozet"])


class Denetim(unittest.TestCase):

    def test_butce_sozlukle_asilirsa_kirmizi_ve_rolu_soyler(self):
        """e) Sözlük paketi bütçenin üstüne çıkarırsa denetle kırmızıdır ve rolü söyler. Konulu kavram da sayılır."""
        en_uzun = max(len(h.paket(depo(), rol)["metin"]) for rol in ROLLER)
        ayar = {"butce": {"paket_karakter": en_uzun + 150}}
        self.assertEqual(kirmizi_satirlar(depo(ayar=ayar)), [])
        uzun = "Uzun bir tanım cümlesi ki sözlüğü bütçenin üstüne taşır. " * 4
        for ek in ({"kb/kavram/KV-001-siparis.md": kavram(tanim=uzun)},
                   {"kb/kavram/KV-002-gecis-tablosu.md": kavram("KV-002", tanim=uzun, konu="[veri-modeli]")}):
            kok = depo(ek, ayar=ayar)
            satirlar = [s for s in kirmizi_satirlar(kok) if "paket-sisti" in s]
            for rol in ROLLER:
                satir = next((s for s in satirlar if " %s — " % rol in s), None)
                self.assertIsNotNone(satir, (rol, satirlar))
                self.assertRegex(satir, r"kesin paket \d+ karakter \(sözlük \d+ dahil\); sınır %d" % (en_uzun + 150))

    def test_tanimi_bos_ya_da_uzun_kavram_kirmizi(self):
        """f) Tanımı boş ya da 400 karakterden uzun kavram denetle çıktısında kırmızıdır (taslakta da)."""
        for durum in ("kabul", "taslak"):
            kok = depo({"kb/kavram/KV-001-siparis.md": kavram(durum=durum, tanim="## Not\nTanım yok.")})
            self.assertTrue(any("KV-001" in s and "zorunlu-alan" in s for s in kirmizi_satirlar(kok)),
                            kirmizi_satirlar(kok))
            kok = depo({"kb/kavram/KV-001-siparis.md": kavram(durum=durum, tanim="a" * 401)})
            self.assertTrue(any("KV-001" in s and "uzun-tanim" in s and "401 karakter; sınır 400" in s
                                for s in kirmizi_satirlar(kok)), kirmizi_satirlar(kok))
            kok = depo({"kb/kavram/KV-001-siparis.md": kavram(durum=durum, tanim="a" * 400)})
            self.assertEqual(kirmizi_satirlar(kok), [])

    def test_tanimsiz_konulu_kavram_kirmizi(self):
        """Konusu harness.json konular listesinde olmayan kavram kırmızıdır (kuraldaki Z16 denetiminin aynısı)."""
        for durum in ("kabul", "taslak"):
            kok = depo({"kb/kavram/KV-001-siparis.md": kavram(durum=durum, konu="[veri-modle]")})
            self.assertTrue(any("KV-001" in s and "tanimsiz-deger" in s and "konu 'veri-modle'" in s
                                for s in kirmizi_satirlar(kok)), kirmizi_satirlar(kok))
        self.assertEqual(kirmizi_satirlar(depo({"kb/kavram/KV-001-siparis.md": kavram(konu="[veri-modeli]")})), [])

    def test_yeni_kavram_taslagi_temiz_gecer(self):
        """g) yeni kavram komutunun açtığı taslak denetle'den temiz geçer."""
        kok = depo({"harness/sablon/kavram.md": SABLON})
        r = cli(kok, "yeni", "kavram", "Sipariş")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        yol = next((kok / "kb" / "kavram").glob("KV-001-*.md"))
        d = h.dugum_oku(yol, kok)
        self.assertEqual((d["baslik"], d["durum"], h.liste(d, "kacin"), h.liste(d, "konu")),
                         ("Sipariş", "taslak", [], []))
        self.assertTrue(d["_ifade"])
        self.assertNotIn("## ", d["_govde"])   # boş bölüm başlığı yok
        r = cli(kok, "denetle")
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "denetle: temiz"), r.stdout + r.stderr)


class KartYenileme(unittest.TestCase):
    """gorev kos karttaki paketi yenilerken sözlük bloğunu da yeniler: blok birikmez, eski tanım kalmaz."""

    def kos_ve_oku(self, kok, kimlik):
        rapor, _ = sessiz(gorev.kos, kok, kimlik)
        self.assertEqual(rapor["durum"], "tamam", rapor)
        return (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")

    def test_kavramla_tek_blok_ve_yeni_tanim(self):
        kok = deposu(KONUSUZ)
        kimlik = kart_ac(kok)
        kart = (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")
        self.assertEqual(kart.count("[[KB-SOZLUK]]"), 1)
        for _ in range(2):
            self.assertEqual(self.kos_ve_oku(kok, kimlik), kart)
        yol = kok / "kb/kavram/KV-001-siparis.md"
        yol.write_text(kavram(tanim="YENİ-TANIM teslim bekleyen alım."), encoding="utf-8")
        git(kok, "commit", "-qam", "tanım değişti")
        kart = self.kos_ve_oku(kok, kimlik)
        self.assertEqual(kart.count("[[KB-SOZLUK]]"), 1)
        self.assertIn("- Sipariş: YENİ-TANIM teslim bekleyen alım. (kullanma: order, talep)\n[[/KB-SOZLUK]]", kart)
        self.assertNotIn("Müşterinin ödediği", kart)
        self.assertIn("\n[[/KB-SOZLUK]]\n\n## Bitiş kaydı", kart)

    def test_kavramsiz_yenileme_karti_degistirmez(self):
        kok = deposu()
        kimlik = kart_ac(kok)
        kart = (kayit(kok, kimlik) / "kart.md").read_text(encoding="utf-8")
        self.assertNotIn("KB-SOZLUK", kart)
        self.assertEqual(self.kos_ve_oku(kok, kimlik), kart)


class Sor(unittest.TestCase):
    """sor KV-NNN kavramı ve hangi rollerin paketine girdiğini gösterir."""

    def test_sor_kavrami_ve_rolleri_gosterir(self):
        kok = depo(dict(KONUSUZ, **KONULU, **TASLAK))
        r = cli(kok, "sor", "KV-001")
        self.assertEqual(r.returncode, 0, r.stderr)
        for parca in ("KV-001@1 [kabul] Sipariş", "ifade : Müşterinin ödediği ve teslim bekleyen alım kaydı.",
                      "kaçın : order, talep", "sözlük: %s paketinde, her işte" % ", ".join(ROLLER)):
            self.assertIn(parca, r.stdout)
        r = cli(kok, "sor", "KV-002")
        self.assertIn("kaçın : (yok)", r.stdout)
        self.assertIn("sözlük: %s paketinde, konusu veri-modeli olan işlerde" % ", ".join(ROLLER), r.stdout)
        r = cli(kok, "sor", "KV-003")
        self.assertIn("sözlük: hiçbir pakete girmez (durum: taslak)", r.stdout)


if __name__ == "__main__":
    unittest.main()
