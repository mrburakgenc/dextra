#!/usr/bin/env python3
"""h.py — iskelet harness'in tek girişi.

Bağımlılık yok: Python 3.9+ standart kütüphanesi ve git.
Tasarım: docs/tasarim/2026-11-20-iskelet-harness-tasarimi.md

Komutlar:  denetle · sor · paket · uret · yeni · kabul · durum · kur · gorev · plan · etki · sorgu · dizin · graf
Çıkış kodu: 0 temiz · 1 bulgu var · 2 ölçülemedi (kapılar 2'yi kırmızı sayar)
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time

SURUM = "0.1.0"
BICIM_SURUMU = 1

URETILEN_BASLA = "<!-- harness:uretilen-basla -->"
URETILEN_BITIR = "<!-- harness:uretilen-bitir -->"
URETILDI = "<!-- ÜRETİLDİ: harness/h.py uret — elle düzenlenmez; kaynağı kb/ -->"

ONEKLER = {"karar": "KR", "kural": "KU", "yapi": "YP", "denetim": "DN", "tasarim": "TS",
           "ozellik": "OZ", "akis": "AK", "sozlesme": "SZ", "kavram": "KV"}
TURLER = {v: k for k, v in ONEKLER.items()}
KAYIT_TURLERI = {"degisiklik", "olay", "istisna"}
DURUMLAR = ("taslak", "kabul", "ezildi", "emekli")
DENETIM_DUZEYLERI = ("mekanik", "test", "gozden-gecirme", "rehber")
DUZEY_ADI = {"mekanik": "mekanik", "test": "test", "gozden-gecirme": "gözden geçirme",
             "rehber": "rehber"}
KIMLIK = re.compile(r"^(KR|KU|YP|DN|TS|OZ|AK|SZ|KV)-(\d{3,})$")
DOSYA_ADI = re.compile(r"^((?:KR|KU|YP|DN|TS|OZ|AK|SZ|KV)-\d{3,})(?:-[^/]*)?\.md$")
TARIH = re.compile(r"\d{4}-\d{2}-\d{2}")
ATLANAN_DIZINLER = {".git", ".harness", "node_modules", "__pycache__", ".next", "dist"}
YEREL_KLASORLER = (".harness/", ".claude/worktrees/")
GUNLUK_BIRLESIM = "kb/GUNLUK.md merge=union"

VARSAYILAN_AYAR = {
    "bicim_surumu": BICIM_SURUMU, "kaynak_kokleri": [], "haric": [], "taban_dal": "main",
    "duzey": 1, "ogretici": True, "profil": "", "harness_gelistirme": False,
    "oturum_agaci": "zorunlu",   # zorunlu: ana çalışma ağacında düzenleme reddedilir · kapali
    "konular": [], "katmanlar": [],
    "roller": ["tasarimci", "uygulayici", "inceleyici", "kesif"],
    "ajan_rolleri": {"Plan": "tasarimci", "Explore": "kesif", "general-purpose": "uygulayici"},
    "rol_araclari": {},
    # Kapıların ayarı sayılan ek dosyalar (lint, tip, biçim ayarları gibi): ajan düzenlemek isterse kullanıcıya sorulur
    "korunan_ayar": [],
    "rol_modelleri": {},
    # hook_ms: bir hook çağrısı bunu aşarsa deftere yazılır; sık aşılıyorsa dizin hook yoluna alınır (tasarım 12.2)
    "butce": {"agents_bayt": 24576, "ifade_karakter": 400, "dosya_basina_kural": 12,
              "paket_karakter": 6000, "hook_ms": 300},
    "gorev": {"komut": "claude", "model": "sonnet", "max_tur": 40, "zaman_asimi_sn": 1200,
              # izin_modu: oturum soru soramaz; "bypassPermissions" hiçbir aracı izne takmaz, sınırı kum havuzu tutar
              "izin_modu": "bypassPermissions", "butce_usd": None, "izinli_araclar": [],
              # onay "baslangic": epic yürütme, tek görev koşturma, alma ve atma sorulur · "her-adim": inceleme de
              # sorulur · "yok": yalnız atma sorulur
              "onay": "baslangic",
              "inceleme": "zorunlu", "inceleme_model": "",
              # yalitim "proje": oturum yalnız projenin ayarlarını yükler (kişisel CLAUDE.md, hook, izin, MCP gitmez)
              # kum_havuzu: komutlar işletim sistemi kum havuzunda koşar; yalnız kendi ağacına ve geçici klasöre yazar
              "yalitim": "proje", "kum_havuzu": True, "ag_izinli": [],
              # yerel_ag: kum havuzundaki komutlar yerel adresteki kapılara bağlanabilir (macOS); dinleyen bütün
              # yerel servisleri kapsar · hazirlik: ağaç açılınca, kum havuzunun dışında koşan komut (argüman listesi)
              "yerel_ag": False, "hazirlik": [],
              # orkestrasyon: işçi alt ajan ve iş akışı başlatabilir (inceleyici başlatamaz) · efor, inceleme_efor:
              # oturuma --effort ile verilen düzey; boşsa bayrak komuta girmez
              "orkestrasyon": False, "efor": "", "inceleme_efor": "",
              # mcp: oturuma verilen MCP sunucuları (ad → ayar); boşsa oturum MCP sunucusu olmadan başlar
              "mcp": {},
              # paralel: epic yürütülürken dosyaları kesişmeyen en çok kaç yaprak yan yana koşar; 1 = sırayla
              "paralel": 1,
              # Görev oturumu web araçları olmadan başlar ve şu yolları okuyamaz (izinleri atlayan modda da)
              "ag_araclari": False,
              "okunmaz": ["~/.ssh/**", "~/.aws/**", "~/.gnupg/**", "~/.claude.json", "~/.claude/CLAUDE.md",
                          "~/.claude/projects/**", "~/.claude/.credentials.json", "**/.env", "**/.env.*"]},
}

KARAR_BOLUMLERI = {
    "cift-yonlu": ("Bağlam", "Seçenekler", "Sonuçlar"),
    "tek-yonlu": ("Bağlam", "Ölçütler", "Seçenekler", "Seçim", "Sonuçlar", "Doğrulama",
                  "Varsayımlar", "Geri dönüş", "İstisna yolu"),
}
TASARIM_BOLUMLERI = {
    "cift-yonlu": ("Sorun", "Kısıtlar", "Seçenekler", "Doğrulama"),
    "tek-yonlu": ("Sorun", "Senaryolar", "Kısıtlar", "Değişmezler", "Kapasite", "Veri modeli",
                  "Yapı", "Seçenekler", "Hata modları", "Performans mantığı", "Aşamalar",
                  "Doğrulama", "Çürütme"),
}
HASSAS_DESENLER = (
    ("ozel-anahtar", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("gizli-atama", re.compile(r"(?i)\b(password|passwd|parola|sifre|şifre|secret|token|"
                               r"api[_-]?key)\b\s*[:=]\s*\S{6,}")),
    ("ip-adresi", re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])")),
    ("tc-kimlik", re.compile(r"(?<!\d)[1-9]\d{10}(?!\d)")),
    ("telefon", re.compile(r"(?<!\d)0?5\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}(?!\d)")),
    ("e-posta", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
)
# Rolün alt ajanı hangi araçlarla doğar. Claude Code'da `tools` yazılmayan ajan bütün araçları devralır;
# okuyan ve inceleyen rollerin dosya yazma aracı olmaması için liste açıkça verilir. None: hepsini devral.
# Proje bir rolün listesini harness.json içinde `rol_araclari` ile değiştirir ("" = hepsini devral).
ROL_ARACLARI = {
    "tasarimci": "Read, Grep, Glob, Bash, WebSearch, WebFetch",
    "uygulayici": None,
    "inceleyici": "Read, Grep, Glob, Bash",
    "kesif": "Read, Grep, Glob",
}

# Rolün alt ajanı hangi modelle doğar. Yazılmayan rol oturumun modelini devralır. Keşif çok dosya okur ve
# hızlı model ona yeter; tasarım ve inceleme oturumun (güçlü) modeliyle kalır. harness.json içinde
# `rol_modelleri` ile değiştirilir ("" = oturumun modeli).
ROL_MODELLERI = {"kesif": "haiku"}

ROL_KARTLARI = {
    "tasarimci": ("Plan ve mimari tasarım yapar; kod yazmaz.",
                  ["Tasarım protokolünü uygula: harness/protokol/tasarim.md.",
                   "Sayı uydurma; bilinmeyeni sor ya da varsayım diye işaretle.",
                   "Kesin kuralla çelişen seçenek sunma; reddedilmiş seçeneği yeniden önerme.",
                   "Çıktın bir tasarım kaydı ve karar taslağıdır; kabul kullanıcıdadır."]),
    "uygulayici": ("Verilen görevi kurallara uyarak uygular.",
                   ["Görev kapsamındaki dosyaların dışına çıkma.",
                    "Bir kural göreve engel oluyorsa çiğneme: bildir ve dur.",
                    "Bilgi tabanına (kb/) yazma; aldığın kararı görev sonucunda bildir."]),
    "inceleyici": ("Değişikliği kurallara karşı inceler; kod düzeltmez.",
                   ["Paketteki her kural için hüküm ver: uyuyor, uymuyor ya da uygulanmaz.",
                    "Hükmünü diff'teki somut satıra dayandır; tahmin etme.",
                    "Yeşil çıktıyı kanıt sayma: neyin denetlendiğini ve neyin denetlenmediğini yaz."]),
    "kesif": ("Kodu ve bilgi tabanını okur, soruya cevap arar; hiçbir şey değiştirmez.",
              ["Yalnız oku ve ara.",
               "Bulduğunu dosya yolu ve satırla ver; emin olmadığını ayrı yaz."]),
}
TR = str.maketrans("ıİşŞğĞçÇöÖüÜâÂîÎûÛ", "iissggccoouuaaiiuu")


class HarnessHata(Exception):
    """Kullanıcıya gösterilecek, işi durduran hata (çıkış kodu 2)."""


class BicimHatasi(Exception):
    """Düğüm dosyasının başlık bloğu dar dilbilgisine uymuyor."""


def B(kod: str, ad: str, yer: str, mesaj: str, seviye: str = "kirmizi") -> dict:
    return {"kod": kod, "ad": ad, "seviye": seviye, "yer": yer, "mesaj": mesaj}


# ── Ayar ─────────────────────────────────────────────────────────────────────────────

def kok_bul(baslangic: str | os.PathLike | None = None) -> pathlib.Path:
    p = pathlib.Path(baslangic or os.getcwd()).resolve()
    for aday in (p, *p.parents):
        if (aday / "harness.json").is_file():
            return aday
    raise HarnessHata("harness.json bulunamadı: %s ve üst dizinlerinde yok" % p)


def ayar_oku(kok: pathlib.Path) -> dict:
    try:
        ham = json.loads((kok / "harness.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise HarnessHata("harness.json okunamadı: %s" % e)
    ayar = json.loads(json.dumps(VARSAYILAN_AYAR))
    for k, v in ham.items():
        if isinstance(v, dict) and isinstance(ayar.get(k), dict):
            ayar[k].update(v)
        else:
            ayar[k] = v
    if ayar["duzey"] not in (1, 2, 3):
        raise HarnessHata("harness.json: duzey 1, 2 ya da 3 olmalı (bulunan: %r)" % ayar["duzey"])
    if ayar["bicim_surumu"] != BICIM_SURUMU:
        raise HarnessHata("bilgi tabanı biçim sürümü %r, bu harness %r bekliyor — h.py goc gerekir"
                          % (ayar["bicim_surumu"], BICIM_SURUMU))
    return ayar


# ── Düğüm ayrıştırma ─────────────────────────────────────────────────────────────────

ALAN_SATIRI = re.compile(r"^([a-z_]+): (.*)$")


def ayristir(metin: str) -> tuple:
    """(alanlar, govde). Başlık bloğu: yalnız `anahtar: değer`; değer metin, tam sayı ya da [a, b]."""
    satirlar = metin.split("\n")
    if not satirlar or satirlar[0].strip() != "---":
        raise BicimHatasi("dosya '---' ile başlamıyor")
    try:
        son = next(i for i in range(1, len(satirlar)) if satirlar[i].strip() == "---")
    except StopIteration:
        raise BicimHatasi("başlık bloğu kapanmıyor ('---' yok)")
    alanlar: dict = {}
    for no, satir in enumerate(satirlar[1:son], start=2):
        m = ALAN_SATIRI.match(satir)
        if not m:
            raise BicimHatasi("satır %d: 'anahtar: değer' biçiminde değil" % no)
        ad, deger = m.group(1), m.group(2).strip()
        if ad in alanlar:
            raise BicimHatasi("satır %d: '%s' iki kez yazılmış" % (no, ad))
        if not deger:
            raise BicimHatasi("satır %d: '%s' değeri boş" % (no, ad))
        if deger.startswith("[") and deger.endswith("]"):
            alanlar[ad] = [x.strip() for x in deger[1:-1].split(",") if x.strip()]
        elif deger.isdigit():
            alanlar[ad] = int(deger)
        else:
            alanlar[ad] = deger
    return alanlar, "\n".join(satirlar[son + 1:])


def bolumle(govde: str) -> tuple:
    """(ifade, bolumler). İfade ilk paragraftır; bölümler `## Başlık` ile ayrılır."""
    bolumler: dict = {}
    bas: list = []
    ad = None
    for satir in govde.split("\n"):
        if satir.startswith("## "):
            ad = satir[3:].strip()
            bolumler[ad] = []
        elif ad is None:
            bas.append(satir)
        else:
            bolumler[ad].append(satir)
    ifade = "\n".join(bas).strip().split("\n\n")[0].strip()
    return ifade, {k: "\n".join(v).strip() for k, v in bolumler.items()}


def dugum_oku(yol: pathlib.Path, kok: pathlib.Path) -> dict:
    alanlar, govde = ayristir(yol.read_text(encoding="utf-8"))
    ifade, bolumler = bolumle(govde)
    d = dict(alanlar)
    d.update({"_yol": yol.relative_to(kok).as_posix(), "_govde": govde, "_ifade": ifade,
              "_bolumler": bolumler})
    return d


def kimlik_oku(yol: pathlib.Path) -> str:
    return str(ayristir(pathlib.Path(yol).read_text(encoding="utf-8"))[0].get("kimlik", ""))


def liste(d: dict, ad: str) -> list:
    v = d.get(ad, [])
    return v if isinstance(v, list) else [v]


GUNLUK = "GUNLUK.md"
GUNLUK_BASI = ("# Bilgi tabanı günlüğü\n\nYalnız eklenir; satırları araç yazar (`h.py yeni`, `h.py kabul`). "
               "Son kayıtlar: `grep '^## \\[' kb/GUNLUK.md | tail -5`\n\n")


def gunluge(kok: pathlib.Path, islem: str, metin: str) -> None:
    """Bilgi tabanında ne zaman ne olduğunu tek satırla, sona ekleyerek kaydeder."""
    yol = pathlib.Path(kok) / "kb" / GUNLUK
    yol.parent.mkdir(parents=True, exist_ok=True)
    if not yol.is_file():
        yol.write_text(GUNLUK_BASI, encoding="utf-8")
    with yol.open("a", encoding="utf-8") as f:
        f.write("## [%s] %s | %s\n" % (datetime.date.today().isoformat(), islem, metin))


def kb_dosyalari(kok: pathlib.Path) -> list:
    kb = kok / "kb"
    if not kb.is_dir():
        return []
    return sorted(p for p in kb.rglob("*.md")
                  if not ({"_gelen", "_arsiv"} & set(p.relative_to(kb).parts)) and p != kb / GUNLUK)


def dugumleri_oku(kok: pathlib.Path) -> tuple:
    """(dugumler, bulgular). Okunamayan dosya düşürülmez; bulgu olarak görünür."""
    dugumler, bulgular, gorulen = [], [], {}
    for p in kb_dosyalari(kok):
        goreli = p.relative_to(kok).as_posix()
        m = DOSYA_ADI.match(p.name)
        if not m:
            try:
                tur = ayristir(p.read_text(encoding="utf-8"))[0].get("tur")
            except (BicimHatasi, OSError):
                tur = None
            if tur not in KAYIT_TURLERI:
                bulgular.append(B("Z1", "taninmayan-dosya", goreli,
                                  "kb/ altında düğüm ya da kayıt olmayan dosya"))
            continue
        try:
            d = dugum_oku(p, kok)
        except BicimHatasi as e:
            bulgular.append(B("Z1", "bicim", goreli, "başlık bloğu okunamadı: %s" % e))
            continue
        eksik = [a for a in ("kimlik", "tur", "durum", "surum", "baslik") if a not in d]
        if eksik or not d["_ifade"]:
            bulgular.append(B("Z1", "zorunlu-alan", goreli, "eksik: %s" % ", ".join(
                eksik + ([] if d["_ifade"] else ["bağlayıcı ifade (ilk paragraf)"]))))
            if eksik:
                continue
        kimlik = str(d["kimlik"])
        km = KIMLIK.match(kimlik)
        if not km or d["tur"] not in ONEKLER or ONEKLER[d["tur"]] != km.group(1):
            bulgular.append(B("Z1", "onek-uyusmuyor", goreli,
                              "kimlik '%s' ile tür '%s' uyuşmuyor" % (kimlik, d["tur"])))
            continue
        if m.group(1) != kimlik:
            bulgular.append(B("Z1", "ad-uyusmuyor", goreli,
                              "dosya adı %s ile başlıyor, kimlik %s" % (m.group(1), kimlik)))
        if d["durum"] not in DURUMLAR or not isinstance(d["surum"], int) or d["surum"] < 1:
            bulgular.append(B("Z1", "zorunlu-alan", goreli, "durum ya da sürüm geçersiz"))
            continue
        if kimlik in gorulen:
            bulgular.append(B("Z1", "cift-kimlik", goreli,
                              "%s kimliği %s dosyasında da var" % (kimlik, gorulen[kimlik])))
            continue
        gorulen[kimlik] = goreli
        dugumler.append(d)
    return dugumler, bulgular


# ── Kapsam ───────────────────────────────────────────────────────────────────────────

_DESEN_ONBELLEK: dict = {}


def desen_eslesir(desen: str, yol: str) -> bool:
    """gitignore benzeri: `**` dizinleri aşar, `*` aşmaz."""
    r = _DESEN_ONBELLEK.get(desen)
    if r is None:
        parca, i = [], 0
        while i < len(desen):
            if desen.startswith("**/", i):
                parca.append("(?:.*/)?"); i += 3
            elif desen.startswith("**", i):
                parca.append(".*"); i += 2
            elif desen[i] == "*":
                parca.append("[^/]*"); i += 1
            elif desen[i] == "?":
                parca.append("[^/]"); i += 1
            else:
                parca.append(re.escape(desen[i])); i += 1
        r = _DESEN_ONBELLEK[desen] = re.compile("^" + "".join(parca) + "$")
    return bool(r.match(yol))


def dosyalari_listele(kok: pathlib.Path, ayar: dict) -> list:
    sonuc = []
    for dizin, altlar, adlar in os.walk(kok):
        # İç içe çalışma ağaçları ve depolar başka bir kopyadır; bu ağacın dosyası sayılmaz.
        altlar[:] = [a for a in altlar if a not in ATLANAN_DIZINLER
                     and not os.path.lexists(os.path.join(dizin, a, ".git"))]
        for ad in adlar:
            g = (pathlib.Path(dizin) / ad).relative_to(kok).as_posix()
            if not any(desen_eslesir(h, g) for h in ayar["haric"]):
                sonuc.append(g)
    return sorted(sonuc)


class Dizin:
    """Okunmuş bilgi tabanı: kimlikten düğüme ve türden listeye erişim."""

    def __init__(self, kok: pathlib.Path):
        self.kok = kok
        self.ayar = ayar_oku(kok)
        self.dugumler, self.okuma_bulgulari = dugumleri_oku(kok)
        self.kimlik = {d["kimlik"]: d for d in self.dugumler}

    def tur(self, ad: str, durum: str | None = "kabul") -> list:
        return [d for d in self.dugumler if d["tur"] == ad and (durum is None or d["durum"] == durum)]

    def kural_desenleri(self, kural: dict) -> list:
        desenler = []
        for oge in liste(kural, "kapsam"):
            if KIMLIK.match(oge):
                desenler += liste(self.kimlik.get(oge, {}), "yollar")
            else:
                desenler.append(oge)
        katmanlar = set(liste(kural, "kapsam_katman"))
        if katmanlar:
            for y in self.tur("yapi"):
                if y.get("katman") in katmanlar:
                    desenler += liste(y, "yollar")
        return desenler

    def her_yerde_mi(self, kural: dict) -> bool:
        return "**" in liste(kural, "kapsam")

    def yola_duser(self, kural: dict, yol: str) -> bool:
        return any(desen_eslesir(d, yol) for d in self.kural_desenleri(kural))

    def yapi_bul(self, yol: str) -> dict | None:
        adaylar = [(max(len(d) for d in liste(y, "yollar") if desen_eslesir(d, yol)), y)
                   for y in self.tur("yapi")
                   if any(desen_eslesir(d, yol) for d in liste(y, "yollar"))]
        return max(adaylar, key=lambda a: a[0])[1] if adaylar else None


def sor_yol(kok: pathlib.Path, yol: str) -> dict:
    dz = Dizin(kok)
    return {"yapi": dz.yapi_bul(yol),
            "kurallar": [k for k in dz.tur("kural") if dz.yola_duser(k, yol)]}


# ── Zincir kuralları ─────────────────────────────────────────────────────────────────

def _dayanak_coz(oge: str) -> tuple:
    kimlik, _, surum = oge.partition("@")
    return kimlik, (int(surum) if surum.isdigit() else None)


def _hedef(dz: Dizin, yer: str, kimlik: str, beklenen: str, alan: str) -> list:
    hedef = dz.kimlik.get(kimlik)
    if hedef is None:
        return [B("Z1", "olu-hedef", yer, "%s alanındaki %s yok" % (alan, kimlik))]
    if hedef["tur"] != beklenen:
        return [B("Z1", "yanlis-tip", yer, "%s alanı %s bekler, %s bir %s"
                  % (alan, beklenen, kimlik, hedef["tur"]))]
    return []


def _kural_denetle(k: dict, dz: Dizin, dosyalar: list, bugun: datetime.date) -> list:
    yer, s, ayar = k["kimlik"], [], dz.ayar
    # Z2 — dayanak
    dayanaklar = liste(k, "dayanak")
    if not dayanaklar:
        s.append(B("Z2", "dayanaksiz", yer, "kural hiçbir karara dayanmıyor"))
    for oge in dayanaklar:
        kimlik, surum = _dayanak_coz(oge)
        sorun = _hedef(dz, yer, kimlik, "karar", "dayanak")
        s += sorun
        if sorun:
            continue
        karar = dz.kimlik[kimlik]
        if karar["durum"] == "taslak":
            s.append(B("Z2", "kabulsuz-dayanak", yer, "%s henüz kabul edilmedi" % kimlik))
        elif karar["durum"] in ("ezildi", "emekli"):
            s.append(B("Z11", "ezilene-dayanan", yer, "%s %s; kural hâlâ ona dayanıyor"
                       % (kimlik, karar["durum"])))
        elif surum != karar["surum"]:
            s.append(B("Z2", "bayat-dayanak", yer, "%s sürüm %s oldu, kural %s sürümüne dayanıyor"
                       % (kimlik, karar["surum"], surum)))
    # Z4 — kapsam
    for oge in liste(k, "kapsam"):
        if KIMLIK.match(oge):
            s += _hedef(dz, yer, oge, "yapi", "kapsam")
    yol_kapsami = liste(k, "kapsam") or liste(k, "kapsam_katman")
    if not yol_kapsami and not liste(k, "olay") and not liste(k, "kapsam_tur"):
        s.append(B("Z4", "kapsamsiz", yer, "kuralın kapsamı da olayı da yok"))
    elif yol_kapsami:
        desenler = dz.kural_desenleri(k)
        if not any(desen_eslesir(d, f) for d in desenler for f in dosyalar):
            s.append(B("Z4", "bos-kapsam", yer, "kapsam hiçbir dosyayla eşleşmiyor"))
    # Z8 — denetim düzeyi ve bakış
    duzey = k.get("denetim_duzey")
    if duzey not in DENETIM_DUZEYLERI:
        s.append(B("Z8", "zorunlu-alan", yer, "denetim_duzey yok ya da geçersiz"))
    if duzey == "mekanik":
        if not liste(k, "denetim_ref"):
            s.append(B("Z6", "denetimsiz-kural", yer, "mekanik kuralın denetimi yok"))
        for oge in liste(k, "denetim_ref"):
            s += _hedef(dz, yer, oge, "denetim", "denetim_ref")
    if duzey in ("gozden-gecirme", "rehber"):
        s += _tarih_denetle("Z8", "bakissiz", "gecikmis-bakis", yer, str(k.get("bakis", "")), bugun)
        if duzey == "rehber" and not k.get("gerekce"):
            s.append(B("Z8", "zorunlu-alan", yer, "rehber düzeyindeki kural gerekçe ister"))
    # Z15 — beyan edilmiş çelişki
    for oge in liste(k, "celisir"):
        sorun = _hedef(dz, yer, oge, "kural", "celisir")
        s += sorun
        if not sorun and dz.kimlik[oge]["durum"] == "kabul" and yer < oge:
            s.append(B("Z15", "cozulmemis-celiski", yer, "%s ile çelişki beyan edilmiş, ikisi de kabul"
                       % oge))
    # Z16 — kesinlik ve sözlükler
    if k.get("kesinlik", "olagan") not in ("kesin", "olagan"):
        s.append(B("Z16", "tanimsiz-deger", yer, "kesinlik 'kesin' ya da 'olagan' olmalı"))
    if k.get("kesinlik") == "kesin":
        if duzey == "rehber":
            s.append(B("Z16", "denetimsiz-kesin", yer, "kesin kural rehber düzeyinde olamaz"))
        if not (k["_bolumler"].get("İhlal örneği") and k["_bolumler"].get("Uygun örnek")):
            s.append(B("Z16", "orneksiz-kesin", yer,
                       "kesin kural 'İhlal örneği' ve 'Uygun örnek' bölümlerini ister"))
    for alan, sozluk in (("konu", "konular"), ("rol", "roller"), ("kapsam_katman", "katmanlar")):
        for deger in liste(k, alan):
            if deger not in ayar[sozluk]:
                s.append(B("Z16", "tanimsiz-deger", yer, "%s '%s' harness.json %s listesinde yok"
                           % (alan, deger, sozluk)))
    # Z14 — ifade bütçesi
    if len(k["_ifade"]) > ayar["butce"]["ifade_karakter"]:
        s.append(B("Z14", "uzun-ifade", yer, "bağlayıcı ifade %d karakter; sınır %d"
                   % (len(k["_ifade"]), ayar["butce"]["ifade_karakter"])))
    return s


def _tarih_denetle(kod: str, yok_adi: str, gecikme_adi: str, yer: str, deger: str,
                   bugun: datetime.date) -> list:
    try:
        tarih = datetime.date.fromisoformat(deger)
    except ValueError:
        return [B(kod, yok_adi, yer, "tarih yok ya da YYYY-AA-GG biçiminde değil")]
    gun = (bugun - tarih).days
    if gun <= 0:
        return []
    return [B(kod, gecikme_adi, yer, "tarih %d gün önce geçti" % gun,
              "kirmizi" if gun > 30 else "uyari")]


def _bolumler_denetle(d: dict, gereken: tuple) -> list:
    return [B("Z18", "eksik-bolum", d["kimlik"], "eksik ya da boş bölüm: %s" % ad)
            for ad in gereken if not d["_bolumler"].get(ad)]


def _karar_denetle(kr: dict, dz: Dizin, bugun: datetime.date) -> list:
    yer, s, bolum = kr["kimlik"], [], kr["_bolumler"]
    agirlik = kr.get("agirlik")
    if agirlik not in KARAR_BOLUMLERI:
        return [B("Z18", "agirliksiz", yer, "agirlik 'tek-yonlu' ya da 'cift-yonlu' olmalı")]
    s += _bolumler_denetle(kr, KARAR_BOLUMLERI[agirlik])
    if bolum.get("Seçenekler") and len(re.findall(r"(?m)^### ", bolum["Seçenekler"])) < 2:
        s.append(B("Z18", "tek-secenek", yer, "Seçenekler altında en az iki seçenek olmalı"))
    doganlar = [d for d in dz.dugumler if d["durum"] == "kabul" and d["tur"] in ("kural", "yapi")
                and yer in {_dayanak_coz(o)[0] for o in liste(d, "dayanak")}]
    if not doganlar and not kr.get("sonucsuz_gerekce"):
        s.append(B("Z3", "sonucsuz-karar", yer, "karardan kabul edilmiş kural ya da yapı doğmamış"))
    if (agirlik == "cift-yonlu" and not bolum.get("İstisna yolu")
            and any(d.get("kesinlik") == "kesin" for d in doganlar)):
        s.append(B("Z18", "istisna-yolu-yok", yer,
                   "kesin kural doğuran karar 'İstisna yolu' bölümünü ister"))
    if agirlik == "tek-yonlu":
        if bolum.get("Ölçütler") and not re.search(r"\d", bolum["Ölçütler"]):
            s.append(B("Z18", "olcutsuz", yer, "Ölçütler bölümünde sayı taşıyan ölçüt yok"))
        dogrulama = bolum.get("Doğrulama", "")
        if dogrulama:
            denetimler = re.findall(r"DN-\d{3,}", dogrulama)
            if not denetimler and not TARIH.search(dogrulama):
                s.append(B("Z18", "dogrulamasiz", yer,
                           "Doğrulama bir denetim kimliği ya da ölçüm tarihi taşımalı"))
            for kimlik in denetimler:
                s += _hedef(dz, yer, kimlik, "denetim", "Doğrulama")
            if "birim" not in dogrulama.translate(TR).lower():
                s.append(B("Z18", "birimsiz", yer, "Doğrulama uygunluğun sayılacağı birimi söylemeli"))
        for satir in bolum.get("Varsayımlar", "").split("\n"):
            if not satir.startswith("- "):
                continue
            if "ölçüldü" in satir:
                continue
            tarih = TARIH.search(satir)
            if "varsayım" not in satir or not tarih:
                s.append(B("Z18", "varsayim-isaretsiz", yer,
                           "her varsayım 'ölçüldü' ya da tarihli 'varsayım' diye işaretlenmeli"))
            else:
                s += _tarih_denetle("Z18", "varsayim-isaretsiz", "gecikmis-varsayim", yer,
                                    tarih.group(0), bugun)
    if kr.get("baglam"):
        s += _hedef(dz, yer, str(kr["baglam"]), "tasarim", "baglam")
    return s


def _yapi_denetle(y: dict, dz: Dizin) -> list:
    yer, s = y["kimlik"], []
    if not liste(y, "yollar"):
        s.append(B("Z9", "zorunlu-alan", yer, "yapının yolları yok"))
    if dz.ayar["katmanlar"]:
        if not y.get("katman"):
            s.append(B("Z9", "zorunlu-alan", yer, "yapının katmanı yok"))
        elif y["katman"] not in dz.ayar["katmanlar"]:
            s.append(B("Z16", "tanimsiz-deger", yer, "katman '%s' harness.json katmanlar listesinde yok"
                       % y["katman"]))
    for oge in liste(y, "bagimli"):
        s += _hedef(dz, yer, oge, "yapi", "bagimli")
    for oge in liste(y, "dayanak"):
        s += _hedef(dz, yer, _dayanak_coz(oge)[0], "karar", "dayanak")
    return s


def _ezilme_denetle(dz: Dizin) -> list:
    s = []
    for d in dz.dugumler:
        if d["durum"] != "ezildi":
            continue
        yerine = d.get("yerine")
        if not yerine:
            s.append(B("Z11", "yerinesiz", d["kimlik"], "ezilen düğüm yerine geçeni göstermiyor"))
            continue
        s += _hedef(dz, d["kimlik"], str(yerine), d["tur"], "yerine")
        gorulen, simdiki = {d["kimlik"]}, dz.kimlik.get(str(yerine))
        while simdiki is not None and simdiki.get("yerine"):
            if simdiki["kimlik"] in gorulen:
                s.append(B("Z11", "yerine-dongu", d["kimlik"], "yerine zinciri döngü yapıyor"))
                break
            gorulen.add(simdiki["kimlik"])
            simdiki = dz.kimlik.get(str(simdiki["yerine"]))
    return s


def _hassas_denetle(kok: pathlib.Path) -> list:
    s = []
    for p in kb_dosyalari(kok):
        goreli = p.relative_to(kok).as_posix()
        for no, satir in enumerate(p.read_text(encoding="utf-8").split("\n"), start=1):
            for ad, desen in HASSAS_DESENLER:
                if desen.search(satir):
                    # Bulunan değer yazılmaz: yalnız yer ve desenin adı.
                    s.append(B("Z17", "hassas-veri", "%s:%d" % (goreli, no), "desen: %s" % ad))
    return s


def _butce_denetle(dz: Dizin) -> list:
    s, butce = [], dz.ayar["butce"]
    agents = dz.kok / "AGENTS.md"
    if agents.is_file() and len(agents.read_bytes()) > butce["agents_bayt"]:
        s.append(B("Z14", "agents-sisti", "AGENTS.md", "%d bayt; sınır %d"
                   % (len(agents.read_bytes()), butce["agents_bayt"])))
    for rol in dz.ayar["roller"]:
        p = _paket(dz, rol, (), ())
        if len(p["metin"]) > butce["paket_karakter"]:
            s.append(B("Z14", "paket-sisti", rol, "kesin paket %d karakter; sınır %d — küme küçültülmeli"
                       % (len(p["metin"]), butce["paket_karakter"])))
    return s


def _normatif(d: dict) -> str:
    alanlar = {"kural": ("kapsam", "kapsam_katman", "kapsam_tur", "olay", "denetim_duzey",
                         "denetim_ref", "kesinlik", "rol", "konu"),
               "karar": ("agirlik",), "yapi": ("yollar", "katman", "bagimli")}.get(d["tur"], ())
    return json.dumps([d["_ifade"]] + [d.get(a) for a in alanlar], ensure_ascii=False, sort_keys=True)


def agac_turu(kok: pathlib.Path) -> str:
    """'yok': git deposu değil · 'ana': ana çalışma ağacı · 'bagli': ayrı dallı çalışma ağacı (worktree)."""
    g = pathlib.Path(kok) / ".git"
    return "ana" if g.is_dir() else "bagli" if g.is_file() else "yok"


def ortak_kok(kok: pathlib.Path) -> pathlib.Path:
    """Ana çalışma ağacının kökü. Bütün ağaçların paylaştığı kayıtlar (görev, plan) burada durur."""
    kok = pathlib.Path(kok)
    g = kok / ".git"
    if not g.is_file():
        return kok
    try:   # bağlı ağaçta .git bir dosyadır: "gitdir: <ana>/.git/worktrees/<ad>"
        gitdir = pathlib.Path(g.read_text(encoding="utf-8").split("gitdir:", 1)[1].strip())
        gitdir = gitdir if gitdir.is_absolute() else (kok / gitdir)
        ortak = (gitdir / (gitdir / "commondir").read_text(encoding="utf-8").strip()).resolve()
        return ortak.parent
    except (OSError, IndexError):
        return kok


def commit_var(kok: pathlib.Path) -> bool:
    return subprocess.run(["git", "rev-parse", "--verify", "--quiet", "HEAD"], cwd=kok,
                          capture_output=True).returncode == 0


def dal_adi(kok: pathlib.Path) -> str:
    r = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=kok, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def _git(kok: pathlib.Path, *arg: str) -> str:
    r = subprocess.run(["git", "-c", "core.quotePath=false", *arg], cwd=kok, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise HarnessHata("git %s başarısız: %s" % (" ".join(arg[:2]), r.stderr.strip()[:200]))
    return r.stdout


def _surum_denetle(dz: Dizin) -> list:
    """Z12: bağlayıcı içerik taban dala göre değiştiyse sürüm artmış olmalı."""
    try:
        taban = _git(dz.kok, "merge-base", "HEAD", dz.ayar["taban_dal"]).strip()
    except HarnessHata as e:
        raise HarnessHata("Z12 ölçülemedi — taban dal '%s' ile karşılaştırılamıyor (%s)"
                          % (dz.ayar["taban_dal"], e))
    eski_yollar = {}
    for yol in _git(dz.kok, "ls-tree", "-r", "--name-only", taban, "kb").split("\n"):
        m = DOSYA_ADI.match(yol.rsplit("/", 1)[-1])
        if m:
            eski_yollar[m.group(1)] = yol
    s = []
    for d in dz.dugumler:
        yol = eski_yollar.get(d["kimlik"])
        if d["durum"] == "taslak" or not yol:
            continue
        try:
            alanlar, govde = ayristir(_git(dz.kok, "show", "%s:%s" % (taban, yol)))
        except BicimHatasi:
            continue
        eski = dict(alanlar, _ifade=bolumle(govde)[0])
        if eski.get("durum") == "taslak" or "tur" not in eski:
            continue
        if _normatif(eski) != _normatif(d) and d["surum"] <= int(eski.get("surum", 0)):
            s.append(B("Z12", "surumsuz-degisiklik", d["kimlik"],
                       "bağlayıcı içerik değişti ama sürüm %s kaldı" % d["surum"]))
    return s


def _cekirdek_denetle(kok: pathlib.Path, bugun: datetime.date, taban: bool,
                      uretim: bool = True) -> list:
    dz = Dizin(kok)
    s = list(dz.okuma_bulgulari)
    dosyalar = dosyalari_listele(kok, dz.ayar)
    for d in dz.dugumler:
        if d["durum"] != "kabul":
            continue
        if d["tur"] == "kural":
            s += _kural_denetle(d, dz, dosyalar, bugun)
        elif d["tur"] == "karar":
            s += _karar_denetle(d, dz, bugun)
        elif d["tur"] == "yapi":
            s += _yapi_denetle(d, dz)
        elif d["tur"] == "tasarim":
            if d.get("agirlik") not in TASARIM_BOLUMLERI:
                s.append(B("Z18", "agirliksiz", d["kimlik"], "agirlik yok ya da geçersiz"))
            else:
                s += _bolumler_denetle(d, TASARIM_BOLUMLERI[d["agirlik"]])
    s += _ezilme_denetle(dz) + _hassas_denetle(kok) + _butce_denetle(dz)
    if uretim:
        s += [B("Z13", "bayat-uretim", yol, "üretilen dosya güncel değil — h.py uret")
              for yol in uret(kok, yaz=False)]
    if taban:
        s += _surum_denetle(dz)
    for b in s:  # açık düzeyin üstündeki kurallar yalnız uyarıdır
        if _DUZEY.get(b["kod"], 1) > dz.ayar["duzey"]:
            b["seviye"] = "uyari"
    return s


_DUZEY = {("Z%d" % i): (1 if i <= 18 else 2 if i <= 23 else 3) for i in range(1, 32)}


def denetle(kok: pathlib.Path, bugun: datetime.date | None = None, taban: bool = False) -> list:
    """Zincir kurallarını denetler; bulgu listesi döner (boş liste = temiz)."""
    return _cekirdek_denetle(pathlib.Path(kok), bugun or datetime.date.today(), taban)


# ── Kanarya: kapının kör olmadığının kanıtı ──────────────────────────────────────────

_KANARYA = {
    "harness.json": "{}",
    "kb/karar/KR-001-tek-secenek.md": "---\nkimlik: KR-001\ntur: karar\ndurum: kabul\nsurum: 1\n"
    "baslik: Bozuk karar\nagirlik: cift-yonlu\n---\nTek seçenekli karar.\n\n## Bağlam\nYok.\n\n"
    "## Seçenekler\n### A — Tek\nBaşka yok.\n\n## Sonuçlar\nYok.\n",
    "kb/kural/KU-001-dayanaksiz.md": "---\nkimlik: KU-001\ntur: kural\ndurum: kabul\nsurum: 1\n"
    "baslik: Bozuk kural\ndenetim_duzey: test\n---\nDayanağı ve kapsamı olmayan kural.\n",
    "kb/kural/KU-001-kopya.md": "---\nkimlik: KU-001\ntur: kural\ndurum: kabul\nsurum: 1\n"
    "baslik: Kopya\ndenetim_duzey: test\n---\nAynı kimlik.\n",
}
_KANARYA_BEKLENEN = {"tek-secenek", "sonucsuz-karar", "dayanaksiz", "kapsamsiz", "cift-kimlik"}


def kanarya() -> list:
    """Bilerek bozulmuş örnekte beklenen bulguları arar; dönen liste eksik kalanlardır."""
    gecici = pathlib.Path(tempfile.mkdtemp(prefix="harness-kanarya-"))
    try:
        for yol, icerik in _KANARYA.items():
            (gecici / yol).parent.mkdir(parents=True, exist_ok=True)
            (gecici / yol).write_text(icerik, encoding="utf-8")
        bulunan = {b["ad"] for b in _cekirdek_denetle(gecici, datetime.date.today(), False,
                                                      uretim=False)}
    finally:
        shutil.rmtree(gecici, ignore_errors=True)
    return sorted(_KANARYA_BEKLENEN - bulunan)


# ── Ajan paketi ──────────────────────────────────────────────────────────────────────

PAKET = re.compile(r"\[\[KB-PAKET rol=(\S+) ozet=([0-9a-f]{8})\]\]\n(.*?)\n\[\[/KB-PAKET\]\]", re.S)


def _kural_satiri(k: dict, inceleme: bool = False) -> str:
    duzey = DUZEY_ADI.get(k.get("denetim_duzey"), "?")
    ref = " " + ", ".join(liste(k, "denetim_ref")) if liste(k, "denetim_ref") else ""
    dayanak = ", ".join(_dayanak_coz(o)[0] for o in liste(k, "dayanak"))
    satir = "%s@%s [%s%s] %s (%s)" % (k["kimlik"], k["surum"], duzey, ref, k["_ifade"], dayanak)
    return "[ ] " + satir + " → uyuyor / uymuyor / uygulanmaz" if inceleme else satir


def _paket(dz: Dizin, rol: str, yollar, konular) -> dict:
    konular = set(konular)
    # rol "*": tanınmayan ajan tipi — rol süzgeci uygulanmaz, bütün kesin kurallar verilir.
    kesin = [k for k in dz.tur("kural") if k.get("kesinlik") == "kesin"
             and (rol == "*" or not liste(k, "rol") or rol in liste(k, "rol"))
             and (not konular or not liste(k, "konu") or konular & set(liste(k, "konu")))]
    yoldan = [k for k in dz.tur("kural") if k not in kesin
              and any(dz.yola_duser(k, y) for y in yollar)]
    inceleme = rol == "inceleyici"
    satirlar = []
    if kesin:
        satirlar += ["Bu kurallar kesindir. Görev metniyle çelişirse kural geçerlidir: "
                     "çelişkiyi bildir ve dur.", ""] + [_kural_satiri(k, inceleme) for k in kesin]
    if yoldan:
        satirlar += ([""] if satirlar else []) + ["Bu göreve düşen diğer kurallar:"] + [
            _kural_satiri(k, inceleme) for k in yoldan]
    if rol == "tasarimci":
        kararlar = sorted({_dayanak_coz(o)[0] for k in kesin + yoldan for o in liste(k, "dayanak")})
        red = []
        for kimlik in kararlar:
            kr = dz.kimlik.get(kimlik)
            secenekler = re.findall(r"(?m)^### (.+)$", (kr or {}).get("_bolumler", {}).get("Seçenekler", ""))
            if secenekler:
                secim = (kr["_bolumler"].get("Seçim") or "").split("\n")[0]
                red.append("%s %s — değerlendirilen seçenekler: %s%s" % (
                    kimlik, kr["baslik"], "; ".join(secenekler),
                    (" · seçim: " + secim) if secim else ""))
        if red:
            satirlar += ["", "Bu kararlarda değerlendirilmiş seçenekler (reddedileni yeniden önerme):"] + red
    govde = "\n".join(satirlar) if satirlar else "(bu role verilecek kural yok)"
    ozet = hashlib.sha256(govde.encode("utf-8")).hexdigest()[:8]
    return {"metin": "[[KB-PAKET rol=%s ozet=%s]]\n%s\n[[/KB-PAKET]]" % (rol, ozet, govde),
            "ozet": ozet, "kurallar": ["%s@%s" % (k["kimlik"], k["surum"]) for k in kesin + yoldan],
            "bos": not (kesin or yoldan)}


def paket(kok: pathlib.Path, rol: str, yollar=(), konular=()) -> dict:
    """Bir role verilecek kural paketi: kesin kurallar + verilen yollara düşenler."""
    dz = Dizin(pathlib.Path(kok))
    if rol != "*" and rol not in dz.ayar["roller"]:
        raise HarnessHata("rol '%s' harness.json roller listesinde yok" % rol)
    # Desen verilmişse eşleşen dosyalara açılır: kural, görevin dokunacağı dosyalara göre seçilir.
    acik = set(yollar)
    desenler = [y for y in yollar if "*" in y or "?" in y]
    if desenler:
        acik |= {f for f in dosyalari_listele(dz.kok, dz.ayar)
                 if any(desen_eslesir(d, f) for d in desenler)}
    return _paket(dz, rol, tuple(sorted(acik)), tuple(konular))


def paket_ozeti_dogrula(metin: str) -> str | None:
    """Metindeki paketin özeti içeriğiyle tutuyorsa özeti, tutmuyorsa None döner."""
    m = PAKET.search(metin)
    if not m:
        return None
    return m.group(2) if hashlib.sha256(m.group(3).encode("utf-8")).hexdigest()[:8] == m.group(2) else None


# ── Üretim ───────────────────────────────────────────────────────────────────────────

def _agents_blogu(dz: Dizin) -> str:
    cekirdek = [k for k in dz.tur("kural")
                if dz.her_yerde_mi(k) or not (liste(k, "kapsam") or liste(k, "kapsam_katman"))]
    yapilar = dz.tur("yapi")
    s = [URETILEN_BASLA, URETILDI, "", "### Çekirdek kurallar", ""]
    s += ["- " + _kural_satiri(k) for k in cekirdek] or ["- (henüz kabul edilmiş çekirdek kural yok)"]
    s += ["", "### Yapı haritası", ""]
    s += ["- %s %s — %s — %s" % (y["kimlik"], y["baslik"], y.get("katman", "katman yok"),
                                 ", ".join(liste(y, "yollar"))) for y in yapilar] or [
        "- (henüz kabul edilmiş yapı yok)"]
    s += ["", "### Sormak", "",
          "- Bir dosyaya ne uygulanır: `python3 harness/h.py sor <yol>`",
          "- Bir düğüm nereden gelir, nereye gider: `python3 harness/h.py sor <KİMLİK>`",
          "- Bir role hangi kurallar verilir: `python3 harness/h.py paket --rol <rol>`",
          URETILEN_BITIR]
    return "\n".join(s)


def _kural_dosyasi(dz: Dizin, k: dict) -> str:
    desenler = sorted(set(dz.kural_desenleri(k)))
    return "\n".join(["---", "paths:"] + ['  - "%s"' % d for d in desenler] + [
        "---", URETILDI, "", "# %s@%s — %s" % (k["kimlik"], k["surum"], k["baslik"]), "",
        k["_ifade"], "",
        "Denetim: %s · Dayanak: %s" % (DUZEY_ADI.get(k.get("denetim_duzey"), "?"),
                                       ", ".join(liste(k, "dayanak")) or "yok"),
        "Ayrıntı: `python3 harness/h.py sor %s`" % k["kimlik"], ""])


def _ajan_dosyasi(dz: Dizin, rol: str) -> str:
    aciklama, maddeler = ROL_KARTLARI.get(rol, ("Proje rolü: %s." % rol, []))
    p = _paket(dz, rol, (), ())
    araclar = dz.ayar.get("rol_araclari", {}).get(rol, ROL_ARACLARI.get(rol))
    model = dz.ayar.get("rol_modelleri", {}).get(rol, ROL_MODELLERI.get(rol))
    baslik = (["name: %s" % rol, "description: %s" % aciklama] + (["tools: %s" % araclar] if araclar else [])
              + (["model: %s" % model] if model else []))
    return "\n".join(["---"] + baslik + ["---", URETILDI, "",
                      "# %s" % rol, "", aciklama, ""] + ["- " + m for m in maddeler] + [
        "", "## Kurallar", "", p["metin"], "",
        "Bir dosyaya uygulanan kuralları görmek için: `python3 harness/h.py sor <yol>`", ""])


def uret(kok: pathlib.Path, yaz: bool = True) -> list:
    """Üretilen dosyaları yazar (yaz=True) ya da bayat olanların listesini döner (yaz=False)."""
    kok = pathlib.Path(kok)
    dz = Dizin(kok)
    hedefler: dict = {}
    agents = kok / "AGENTS.md"
    if agents.is_file():
        metin = agents.read_text(encoding="utf-8")
        if URETILEN_BASLA not in metin or URETILEN_BITIR not in metin:
            if yaz:
                raise HarnessHata("AGENTS.md içinde üretilen blok işaretleri yok")
            hedefler["AGENTS.md"] = None
        else:
            bas, _, kalan = metin.partition(URETILEN_BASLA)
            hedefler["AGENTS.md"] = bas + _agents_blogu(dz) + kalan.partition(URETILEN_BITIR)[2]
    for k in dz.tur("kural"):
        if dz.kural_desenleri(k) and not dz.her_yerde_mi(k):
            hedefler[".claude/rules/%s.md" % k["kimlik"]] = _kural_dosyasi(dz, k)
    for rol in dz.ayar["roller"]:
        hedefler[".claude/agents/%s.md" % rol] = _ajan_dosyasi(dz, rol)
    degisen = []
    for goreli, icerik in hedefler.items():
        p = kok / goreli
        mevcut = p.read_text(encoding="utf-8") if p.is_file() else None
        if icerik is None or mevcut != icerik:
            degisen.append(goreli)
            if yaz and icerik is not None:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(icerik, encoding="utf-8")
    for dizin in (".claude/rules", ".claude/agents"):
        for p in sorted((kok / dizin).glob("*.md")) if (kok / dizin).is_dir() else []:
            goreli = p.relative_to(kok).as_posix()
            if goreli not in hedefler and URETILDI in p.read_text(encoding="utf-8"):
                degisen.append(goreli)
                if yaz:
                    p.unlink()
    return degisen


# ── Yeni düğüm ve kabul ──────────────────────────────────────────────────────────────

def _slug(metin: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", metin.translate(TR).lower()).strip("-")[:60]


def yeni(kok: pathlib.Path, tip: str, baslik: str) -> pathlib.Path:
    kok = pathlib.Path(kok)
    if tip not in ONEKLER:
        raise HarnessHata("bilinmeyen tür '%s' — geçerli: %s" % (tip, ", ".join(ONEKLER)))
    sablon = kok / "harness" / "sablon" / (tip + ".md")
    if not sablon.is_file():
        raise HarnessHata("şablon yok: %s" % sablon.relative_to(kok))
    onek = ONEKLER[tip]
    sayilar = [int(m.group(1)) for p in (kok / "kb").rglob("*.md") if (kok / "kb").is_dir()
               for m in [re.match(r"^%s-(\d{3,})" % onek, p.name)] if m]
    kimlik = "%s-%03d" % (onek, max(sayilar, default=0) + 1)
    metin = (sablon.read_text(encoding="utf-8").replace("{KIMLIK}", kimlik)
             .replace("{BASLIK}", baslik).replace("{TARIH}", datetime.date.today().isoformat()))
    hedef = kok / "kb" / tip / ("%s-%s.md" % (kimlik, _slug(baslik)))
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(metin, encoding="utf-8")
    gunluge(kok, "taslak", "%s %s" % (kimlik, baslik))
    return hedef


# Kabul anında sağlanamayan bulgular. Karar, ondan doğan kuraldan önce kabul edilir (kural kabul edilmemiş karara
# dayanamaz: Z2); o anda kararın kabul edilmiş kuralı olamaz. Bu bulgu kabulü engellemez; kapı, kural kabul edilene
# kadar kırmızı kalarak işi tamamlatır.
KABULDE_BEKLENEN = {"sonucsuz-karar"}


def kabul_notu(kok: pathlib.Path, kimlik: str) -> str | None:
    """Kabul edilmiş ama henüz kabul edilmiş kuralı ya da yapısı olmayan karar için sıradaki adımı söyler."""
    dz = Dizin(pathlib.Path(kok))
    d = dz.kimlik.get(kimlik)
    if d is None or d["tur"] != "karar" or d["durum"] != "kabul" or d.get("sonucsuz_gerekce"):
        return None
    doganlar = [o for o in dz.dugumler if o["tur"] in ("kural", "yapi")
                and kimlik in {_dayanak_coz(x)[0] for x in liste(o, "dayanak")}]
    if any(o["durum"] == "kabul" for o in doganlar):
        return None
    taslaklar = [o["kimlik"] for o in doganlar if o["durum"] == "taslak"]
    sirada = ("Sırada: %s." % ", ".join("h.py kabul " + k for k in taslaklar) if taslaklar
              else "Ona dayanan bir kural taslağı yaz ya da karara `sonucsuz_gerekce` alanını ekle.")
    return ("%s'den doğan kabul edilmiş kural ya da yapı henüz yok; o zamana kadar zincir kırmızı kalır (Z3). %s"
            % (kimlik, sirada))


def kabul_sirasi(kimlikler: list) -> list:
    """Önce kararlar, sonra ötekiler: kural, kabul edilmemiş karara dayanamaz. Yinelenen kimlik bir kez kalır."""
    return sorted(dict.fromkeys(kimlikler), key=lambda k: (not k.startswith("KR-"), k))


# Terminal dışında kabul, kapının kullanıcıya sorduğunu gösteren kayıtla çalışır. Kaydı hook soruyu gösterirken
# yazar, komut bir kez kullanır. Kapının çalışmadığı yerde (hook'suz araç, betik) kayıt olmaz ve kabul edilmez.
ONAY_DOSYASI = ".harness/onay/kabul.json"
ONAY_SURESI_SN = 900


def onay_yaz(kok: pathlib.Path, kimlikler: list, simdi: float | None = None) -> None:
    yol = pathlib.Path(kok) / ONAY_DOSYASI
    yol.parent.mkdir(parents=True, exist_ok=True)
    yol.write_text(json.dumps({"kimlikler": sorted(set(kimlikler)), "zaman": simdi or time.time()}),
                   encoding="utf-8")


def onay_kullan(kok: pathlib.Path, kimlikler: list) -> bool:
    """Onay kaydı tam bu kimlikler için ve tazeyse True. Kayıt her denemede silinir: tek kullanımlıktır."""
    yol = pathlib.Path(kok) / ONAY_DOSYASI
    try:
        kayit = json.loads(yol.read_text(encoding="utf-8"))
        yol.unlink()
        return (kayit["kimlikler"] == sorted(set(kimlikler))
                and 0 <= time.time() - float(kayit["zaman"]) <= ONAY_SURESI_SN)
    except (OSError, ValueError, KeyError, TypeError):
        return False


def kabul(kok: pathlib.Path, kimlik: str, onay: bool) -> pathlib.Path:
    """Taslağı kabul eder. `onay` kullanıcının kararıdır: terminaldeki cevabı, kapının sorusuna verdiği onay ya da
    iskeletle birlikte kabul edilmiş sayılan çekirdek paket (`kur`)."""
    kok = pathlib.Path(kok)
    if not onay:
        raise HarnessHata("kabulü yalnız kullanıcı verir; onay olmadan düğüm kabul edilmez")
    dz = Dizin(kok)
    d = dz.kimlik.get(kimlik)
    if d is None:
        raise HarnessHata("%s bulunamadı" % kimlik)
    if d["durum"] != "taslak":
        raise HarnessHata("%s taslak değil (durum: %s)" % (kimlik, d["durum"]))
    yol = kok / d["_yol"]
    eski = yol.read_text(encoding="utf-8")
    yol.write_text(eski.replace("\ndurum: taslak\n", "\ndurum: kabul\n", 1), encoding="utf-8")
    sorunlar = [b for b in _cekirdek_denetle(kok, datetime.date.today(), False, uretim=False)
                if b["seviye"] == "kirmizi" and b["ad"] not in KABULDE_BEKLENEN
                and (b["yer"] == kimlik or b["yer"].startswith(d["_yol"]))]
    if sorunlar:
        yol.write_text(eski, encoding="utf-8")
        raise HarnessHata("%s kabul edilemez:\n%s" % (kimlik, "\n".join(
            "  [%s] %s — %s" % (b["kod"], b["ad"], b["mesaj"]) for b in sorunlar)))
    uret(kok)
    gunluge(kok, "kabul", "%s@%s %s" % (kimlik, d["surum"], d["baslik"]))
    return yol


# ── Komut satırı ─────────────────────────────────────────────────────────────────────

def _bulgu_yaz(bulgular: list) -> None:
    for b in sorted(bulgular, key=lambda x: (x["seviye"] != "kirmizi", x["kod"], x["yer"])):
        isaret = "KIRMIZI" if b["seviye"] == "kirmizi" else "uyarı  "
        print("  %s [%s] %-22s %s — %s" % (isaret, b["kod"], b["ad"], b["yer"], b["mesaj"]))


def _komut_denetle(kok: pathlib.Path, arg: list) -> int:
    eksik = kanarya()
    if eksik:
        print("ÖLÇÜLEMEDİ: kapı kendi bozuk örneğinde şunları yakalayamadı: %s" % ", ".join(eksik))
        return 2
    bulgular = denetle(kok, taban="--dal" in arg)
    kirmizi = [b for b in bulgular if b["seviye"] == "kirmizi"]
    if bulgular:
        _bulgu_yaz(bulgular)
    print("denetle: %d kırmızı, %d uyarı" % (len(kirmizi), len(bulgular) - len(kirmizi))
          if bulgular else "denetle: temiz")
    return 1 if kirmizi else 0


def _dugum_ozeti(d: dict) -> str:
    return "%s@%s [%s] %s" % (d["kimlik"], d["surum"], d["durum"], d["baslik"])


def _komut_sor(kok: pathlib.Path, arg: list) -> int:
    if not arg:
        raise HarnessHata("kullanım: h.py sor <yol | KİMLİK>")
    hedef, dz = arg[0], Dizin(kok)
    if KIMLIK.match(hedef):
        d = dz.kimlik.get(hedef)
        if d is None:
            raise HarnessHata("%s bulunamadı" % hedef)
        print(_dugum_ozeti(d))
        print("  dosya : %s" % d["_yol"])
        print("  ifade : %s" % d["_ifade"])
        for oge in liste(d, "dayanak"):
            kr = dz.kimlik.get(_dayanak_coz(oge)[0])
            print("  dayanak → %s" % (_dugum_ozeti(kr) if kr else oge + " (yok)"))
        for o in dz.dugumler:
            if hedef in {_dayanak_coz(x)[0] for x in liste(o, "dayanak")}:
                print("  doğan   ← %s" % _dugum_ozeti(o))
        if d["tur"] == "kural":
            desenler = dz.kural_desenleri(d)
            dosyalar = dosyalari_listele(kok, dz.ayar)
            print("  kapsam : %s → %d dosya" % (", ".join(desenler) or "olay: " + ", ".join(
                liste(d, "olay")), sum(any(desen_eslesir(x, f) for x in desenler) for f in dosyalar)))
            print("  denetim: %s %s" % (DUZEY_ADI.get(d.get("denetim_duzey"), "?"),
                                        ", ".join(liste(d, "denetim_ref"))))
        return 0
    yol = pathlib.Path(hedef)
    goreli = (yol.resolve().relative_to(kok).as_posix() if yol.is_absolute() else yol.as_posix())
    yapi = dz.yapi_bul(goreli)
    kurallar = [k for k in dz.tur("kural") if dz.yola_duser(k, goreli)]
    print("%s" % goreli)
    print("  yapı  : %s" % (_dugum_ozeti(yapi) if yapi else "(hiçbir yapıya düşmüyor)"))
    for k in kurallar:
        print("  kural : " + _kural_satiri(k))
    if not kurallar:
        print("  kural : (bu yola düşen kabul edilmiş kural yok)")
    return 0


def _secenek(arg: list, ad: str) -> list:
    return [arg[i + 1] for i, a in enumerate(arg) if a == ad and i + 1 < len(arg)]


def _komut_paket(kok: pathlib.Path, arg: list) -> int:
    rol = (_secenek(arg, "--rol") or [None])[0]
    if not rol:
        raise HarnessHata("kullanım: h.py paket --rol <rol> [--yol <yol>]... [--konu <ad>]...")
    print(paket(kok, rol, _secenek(arg, "--yol"), _secenek(arg, "--konu"))["metin"])
    return 0


def yavas_hooklar(kok: pathlib.Path) -> dict:
    """Defterdeki yavaş hook kayıtları: kaç çağrı eşiği aştı, en uzunu kaç ms sürdü."""
    kok = pathlib.Path(kok)
    sureler = []
    for p in sorted((kok / ".harness" / "defter").glob("*.jsonl")):
        for satir in p.read_text(encoding="utf-8").split("\n"):
            try:
                kayit = json.loads(satir) if satir.strip() else {}
            except ValueError:
                continue
            if kayit.get("olay") == "yavas-hook":
                sureler.append(int(kayit.get("ms", 0)))
    return {"sayi": len(sureler), "en_uzun": max(sureler, default=0),
            "esik": ayar_oku(kok)["butce"].get("hook_ms", 300)}


def _komut_durum(kok: pathlib.Path, arg: list) -> int:
    dz = Dizin(kok)
    sayim: dict = {}
    for d in dz.dugumler:
        sayim[(d["tur"], d["durum"])] = sayim.get((d["tur"], d["durum"]), 0) + 1
    print("harness %s · düzey %s · profil %s" % (SURUM, dz.ayar["duzey"], dz.ayar["profil"] or "yok"))
    for (tur, durum), n in sorted(sayim.items()):
        print("  %-9s %-7s %d" % (tur, durum, n))
    kurallar = dz.tur("kural")
    if kurallar:
        dagilim: dict = {}
        for k in kurallar:
            dagilim[k.get("denetim_duzey", "?")] = dagilim.get(k.get("denetim_duzey", "?"), 0) + 1
        denetimli = dagilim.get("mekanik", 0) + dagilim.get("test", 0)
        print("  denetlenebilirlik: %d/%d kuralın çalışan denetimi var (%s)" % (
            denetimli, len(kurallar), ", ".join("%s %d" % kv for kv in sorted(dagilim.items()))))
        print("  kesin kural: %d" % sum(k.get("kesinlik") == "kesin" for k in kurallar))
    taslak = [d for d in dz.dugumler if d["durum"] == "taslak"]
    if taslak:
        print("  kabul bekleyen %d taslak: %s" % (len(taslak), ", ".join(d["kimlik"] for d in taslak)))
    yavas = yavas_hooklar(kok)
    if yavas["sayi"]:
        print("  yavaş hook: %d çağrı %d ms eşiğini aştı (en uzun %d ms) — sıklaşırsa dizini hook yoluna alma "
              "tetiğidir" % (yavas["sayi"], yavas["esik"], yavas["en_uzun"]))
    return 0


def _cekirdek_kabul(kok: pathlib.Path, paket_dizini: pathlib.Path) -> list:
    """Çekirdek paketin değişmemiş taslaklarını kabul eder: paket iskeletle birlikte kabul edilmiş sayılır.

    Yalnız bilgi tabanındaki kopyası paketteki dosyayla bayt bayt aynı olan taslağa dokunur. Projede değiştirilmiş
    taslak, kabul edilmiş ya da emekli edilmiş düğüm olduğu gibi kalır."""
    notlar = []
    paket = {m.group(1): p for p in sorted(paket_dizini.rglob("*.md")) for m in [DOSYA_ADI.match(p.name)] if m}
    for kimlik in kabul_sirasi(list(paket)):
        d = Dizin(kok).kimlik.get(kimlik)
        if d is None or d["durum"] != "taslak":
            continue
        if (kok / d["_yol"]).read_bytes() != paket[kimlik].read_bytes():
            notlar.append("%s taslağı paketten farklı: kabul edilmedi, kullanıcıyı bekliyor" % kimlik)
            continue
        try:
            kabul(kok, kimlik, True)
            notlar.append("çekirdek paketten kabul edildi: %s" % kimlik)
        except HarnessHata as e:
            notlar.append("%s kabul edilemedi, kullanıcıyı bekliyor: %s"
                          % (kimlik, " ".join(str(e).split("\n")[1:]).strip() or e))
    return notlar


def _komut_kur(kok: pathlib.Path, arg: list) -> int:
    notlar = []
    paket_dizini = kok / "harness" / "paket" / "cekirdek"
    if paket_dizini.is_dir():
        mevcut = {m.group(1) for p in kb_dosyalari(kok) for m in [DOSYA_ADI.match(p.name)] if m}
        for p in sorted(paket_dizini.rglob("*.md")):
            m = DOSYA_ADI.match(p.name)
            if m and m.group(1) not in mevcut:
                hedef = kok / "kb" / p.relative_to(paket_dizini)
                hedef.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(p, hedef)
                notlar.append("çekirdek paketten taslak eklendi: %s" % hedef.relative_to(kok))
    yoksay = kok / ".gitignore"
    satirlar = yoksay.read_text(encoding="utf-8").split("\n") if yoksay.is_file() else []
    eksik = [s for s in YEREL_KLASORLER if s not in satirlar]
    if eksik:   # yerel durum ve oturum ağaçları git'e girmez
        govde = "\n".join(satirlar).rstrip("\n")
        yoksay.write_text((govde + "\n" if govde else "") + "\n".join(eksik) + "\n", encoding="utf-8")
        notlar.append(".gitignore'a eklendi: %s" % ", ".join(eksik))
    oznitelik = kok / ".gitattributes"
    satirlar = oznitelik.read_text(encoding="utf-8").split("\n") if oznitelik.is_file() else []
    if GUNLUK_BIRLESIM not in satirlar:   # iki dalda eklenen günlük satırları birleşirken ikisi de kalır
        govde = "\n".join(satirlar).rstrip("\n")
        oznitelik.write_text((govde + "\n" if govde else "") + GUNLUK_BIRLESIM + "\n", encoding="utf-8")
        notlar.append(".gitattributes'a eklendi: %s" % GUNLUK_BIRLESIM)
    git_var = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=kok,
                             capture_output=True).returncode == 0
    if git_var:
        for p in (kok / "harness" / "hook" / "git").glob("*"):
            p.chmod(0o755)
        subprocess.run(["git", "config", "core.hooksPath", "harness/hook/git"], cwd=kok, check=True)
        notlar.append("git hook'ları bağlandı (core.hooksPath = harness/hook/git)")
    else:
        notlar.append("git deposu değil: git hook'ları bağlanmadı (önce `git init`, sonra yeniden `kur`)")
    if paket_dizini.is_dir():
        notlar += _cekirdek_kabul(kok, paket_dizini)
    for yol in uret(kok):
        notlar.append("üretildi: %s" % yol)
    for n in notlar:
        print("kur: " + n)
    _komut_durum(kok, [])
    return _komut_denetle(kok, [])


def _komut_kabul(kok: pathlib.Path, arg: list) -> int:
    kimlikler = kabul_sirasi([a for a in arg if not a.startswith("-")])
    if not kimlikler:
        raise HarnessHata("kullanım: h.py kabul <KİMLİK> [<KİMLİK> ...]")
    if sys.stdin.isatty() and sys.stdout.isatty():   # kullanıcının kendi terminali: soruyu komut sorar
        dz = Dizin(kok)
        for d in filter(None, map(dz.kimlik.get, kimlikler)):
            print("%s\n  %s" % (_dugum_ozeti(d), d["_ifade"]))
        if input("Kabul edilsin mi? Onay için 'evet' yaz: ").strip().lower() != "evet":
            print("kabul edilmedi.")
            return 1
    elif not onay_kullan(kok, kimlikler):            # ajanın çalıştırdığı komut: soruyu kapı sormuş olmalı
        raise HarnessHata("kabul kullanıcının onayını ister; bu kimlikler için taze bir onay kaydı yok. Claude "
                          "Code'da bu komutu hook kullanıcıya sorar ve kaydı o yazar; başka yerde komutu kullanıcı "
                          "kendi terminalinde çalıştırır.")
    for kimlik in kimlikler:
        print("kabul edildi: %s" % kabul(kok, kimlik, True).relative_to(kok))
    for not_ in filter(None, (kabul_notu(kok, k) for k in kimlikler)):
        print("not: " + not_)
    return 0


def _komut_yeni(kok: pathlib.Path, arg: list) -> int:
    if len(arg) < 2:
        raise HarnessHata("kullanım: h.py yeni <tür> \"<başlık>\"")
    print("taslak açıldı: %s" % yeni(kok, arg[0], " ".join(arg[1:])).relative_to(kok))
    return 0


def _komut_uret(kok: pathlib.Path, arg: list) -> int:
    degisen = uret(kok, yaz="--kontrol" not in arg)
    if "--kontrol" in arg:
        for yol in degisen:
            print("bayat: " + yol)
        return 1 if degisen else 0
    if "--sessiz" not in arg:
        print("uret: %s" % (", ".join(degisen) if degisen else "değişiklik yok"))
    return 0


def _komut_gorev(kok: pathlib.Path, arg: list) -> int:
    import gorev  # aynı dizinde; yalnız bu komutta yüklenir
    return gorev.komut(kok, arg)


def _komut_plan(kok: pathlib.Path, arg: list) -> int:
    import plan  # aynı dizinde; yalnız bu komutta yüklenir
    return plan.komut(kok, arg)


def _graf_komutu(ad: str):
    def kos(kok: pathlib.Path, arg: list) -> int:
        import graf  # aynı dizinde; yalnız bu komutlarda yüklenir
        return graf.komut(kok, ad, arg)
    return kos


KOMUTLAR = {"denetle": _komut_denetle, "sor": _komut_sor, "paket": _komut_paket,
            "uret": _komut_uret, "yeni": _komut_yeni, "kabul": _komut_kabul,
            "durum": _komut_durum, "kur": _komut_kur, "gorev": _komut_gorev, "plan": _komut_plan,
            # Türetilmiş görünümler: kaynak kb/ dosyalarıdır, kapılar bunlara bakmaz
            "etki": _graf_komutu("etki"), "sorgu": _graf_komutu("sorgu"), "dizin": _graf_komutu("dizin"),
            "graf": _graf_komutu("graf")}


def main(argv: list) -> int:
    if len(argv) < 2 or argv[1] not in KOMUTLAR:
        print("kullanım: h.py <%s> ..." % " | ".join(KOMUTLAR))
        return 2
    try:
        return KOMUTLAR[argv[1]](kok_bul(), argv[2:])
    except HarnessHata as e:
        print("ÖLÇÜLEMEDİ: %s" % e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    # Betik olarak koşunca bu dosya iki kez yüklenmesin: gorev.py ve plan.py `import h` der;
    # ayrı kopya olursa onların HarnessHata'sı burada yakalanmaz.
    import h as _tek_kopya
    sys.exit(_tek_kopya.main(sys.argv))
