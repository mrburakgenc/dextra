#!/usr/bin/env python3
"""h.py — iskelet harness'in tek girişi.

Bağımlılık yok: Python 3.9+ standart kütüphanesi ve git.
Tasarım: docs/tasarim/2026-11-20-iskelet-harness-tasarimi.md

Komutlar:  denetle · sor · paket · uret · yeni · kabul · durum · kur · gorev · plan · rapor · denetim · acik-uc · etki ·
           sorgu · dizin · graf · ajan-karari · ozet
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
import signal
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
    # rapor: işin raporları bu dizinde durur; zorunlu ise `denetle --dal` bu dalda alınıp hiçbir raporun tablosunda
    # 'alındı' satırıyla yer almayan görevi kırmızı bildirir (Z19, KR-015)
    "rapor": {"dizin": "docs/rapor", "zorunlu": True},
    # denetim: push kapısında (`denetle --dal`) ve `denetim kos` ile koşan denetim komutunun süre sınırı; aşılırsa
    # komutun süreç grubu durdurulur ve bulgu kırmızıdır (ölçülemedi)
    "denetim": {"zaman_asimi_sn": 120},
    # hook_ms: bir hook çağrısı bunu aşarsa deftere yazılır; sık aşılıyorsa dizin hook yoluna alınır (tasarım 12.2)
    "butce": {"agents_bayt": 24576, "ifade_karakter": 400, "dosya_basina_kural": 12,
              "paket_karakter": 6000, "hook_ms": 300},
    "gorev": {"komut": "claude", "model": "sonnet", "max_tur": 40, "zaman_asimi_sn": 1200,
              # izin_modu: oturum soru soramaz; "bypassPermissions" hiçbir aracı izne takmaz, sınırı kum havuzu tutar
              "izin_modu": "bypassPermissions", "butce_usd": None, "izinli_araclar": [],
              # onay "baslangic": epic yürütme, tek görev koşturma, genişletme, alma ve atma sorulur · "her-adim":
              # inceleme ve tazeleme de sorulur · "yok": yalnız atma sorulur
              "onay": "baslangic",
              "inceleme": "zorunlu", "inceleme_model": "",
              # yalitim "proje": oturum yalnız projenin ayarlarını yükler (kişisel CLAUDE.md, hook, izin, MCP gitmez)
              # kum_havuzu: komutlar işletim sistemi kum havuzunda koşar; yalnız kendi ağacına ve geçici klasöre yazar
              "yalitim": "proje", "kum_havuzu": True, "ag_izinli": [],
              # yerel_ag: kum havuzundaki komutlar yerel adresteki kapılara bağlanabilir (macOS); dinleyen bütün
              # yerel servisleri kapsar · hazirlik: ağaç açılınca, kum havuzunun dışında koşan komut (argüman listesi)
              "yerel_ag": False, "hazirlik": [],
              # on_kontrol: gorev kos ve gorev incele oturumdan önce bu komutları (her biri argüman listesi) sırayla,
              # kum havuzunun dışında, görev ağacında koşturur; biri sıfırdan farklı kodla çıkarsa oturum başlamaz
              "on_kontrol": [],
              # orkestrasyon: işçi alt ajan ve iş akışı başlatabilir (inceleyici başlatamaz) · efor, inceleme_efor:
              # oturuma --effort ile verilen düzey; boşsa bayrak komuta girmez
              "orkestrasyon": False, "efor": "", "inceleme_efor": "",
              # mcp: oturuma verilen MCP sunucuları (ad → ayar); boşsa oturum MCP sunucusu olmadan başlar
              "mcp": {},
              # mcp_roller: mcp sunucuları yalnız bu rollerdeki oturuma verilir (MCP sunucusu kum havuzunun dışındadır)
              "mcp_roller": ["uygulayici"],
              # ortam_izinli: oturuma, hazırlığa ve ön kontrole geçen ortam değişkenleri; sonu * ile biten öğe ön ektir.
              # harness.yerel.json'daki gorev.ortam_izinli bu listeye eklenir. CLAUDE* oturuma hiç geçmez
              "ortam_izinli": ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_*", "TERM", "TZ"],
              # paralel: epic yürütülürken dosyaları kesişmeyen en çok kaç yaprak yan yana koşar; 1 = sırayla
              "paralel": 1,
              # kendiliginden_devam: işçi tur ya da süre sınırında bitiş kaydı yazmadan kesilir ve ağaçta değişiklik
              # varsa aynı `gorev kos` çağrısında en çok kaç kez kendiliğinden sürdürülür; 0 = sürdürülmez
              "kendiliginden_devam": 1,
              # alma_bekleme_sn: yan yana gelen almalar sıraya girer; bir alma, öncekinin bitmesini en çok bu kadar
              # bekler, aşılırsa hiçbir şeyi değiştirmeden durur
              "alma_bekleme_sn": 600,
              # Kart ön denetimi (uyarı, engel değil): kartın yollarına bu kadardan çok dosya düşerse "kapsam geniş";
              # hedef ile ölçütün toplam uzunluğu bu kadar karakteri aşarsa "kart büyük"
              "kapsam_dosya_esigi": 60, "kart_karakter_esigi": 6000,
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


# ── Açık uç (TS-006 Yapı 19) ─────────────────────────────────────────────────────────
# Düğümün karara bağlanmamış noktası: `## Açık uçlar` bölümünde `- AU-<n>: <metin>` satırı (n düğüm içinde artar).
# Kapanan uç satırdan çıkar ve düğümün sonundaki `## Kapanan uçlar` bölümüne tarih ve kararla yazılır.

ACIK_UCLAR, KAPANAN_UCLAR = "Açık uçlar", "Kapanan uçlar"
ACIK_UC_SATIRI = re.compile(r"^- AU-(\d+)\b:?(.*)$")
ACIK_UC_KIMLIGI = re.compile(r"\b((?:KR|KU|YP|DN|TS|OZ|AK|SZ|KV)-\d{3,})/AU-(\d+)\b")


def acik_uclar(d: dict, bolum: str = ACIK_UCLAR) -> list:
    """Düğümün bir bölümündeki açık uç satırları: [(numara, metin)]."""
    return [(int(m.group(1)), m.group(2).strip()) for m in
            map(ACIK_UC_SATIRI.match, d["_bolumler"].get(bolum, "").split("\n")) if m]


def acik_uc_kimlikleri(metin) -> list:
    """Metinde geçen açık uç kimlikleri: [(düğüm kimliği, numara)], yinelenmeden."""
    return list(dict.fromkeys((m.group(1), int(m.group(2))) for m in ACIK_UC_KIMLIGI.finditer(str(metin or ""))))


def _acik_uc_denetle(d: dict) -> list:
    """Z21: aynı düğümde yinelenen numara (açık ve kapanan uçlar birlikte), metni boş açık uç ve açık uçlar bölümünde
    açık uç biçimine uymayan dolu satır (paket, sayım ve liste onu görmez)."""
    s, gorulen = [], set()
    for satir in d["_bolumler"].get(ACIK_UCLAR, "").split("\n"):
        if satir.strip() and not ACIK_UC_SATIRI.match(satir):
            s.append(B("Z21", "acik-uc-bicim", d["kimlik"], "açık uçlar bölümünde biçime uymayan satır (beklenen "
                       "'- AU-<n>: <metin>'): %s" % satir.strip()[:80]))
    for bolum in (ACIK_UCLAR, KAPANAN_UCLAR):
        for no, metin in acik_uclar(d, bolum):
            if no in gorulen:
                s.append(B("Z21", "acik-uc-yinelenen", d["kimlik"], "AU-%d numarası düğümde birden çok kez geçiyor" % no))
            gorulen.add(no)
            if bolum == ACIK_UCLAR and not metin:
                s.append(B("Z21", "acik-uc-bos", d["kimlik"], "AU-%d açık ucunun metni boş" % no))
    return s


def _bolum_araligi(satirlar: list, ad: str) -> tuple | None:
    """`## <ad>` bölümünün (başlık satırı, bitiş) aralığı; bölüm yoksa None."""
    for i, s in enumerate(satirlar):
        if s.startswith("## ") and s[3:].strip() == ad:
            return i, next((j for j in range(i + 1, len(satirlar)) if satirlar[j].startswith("## ")), len(satirlar))
    return None


def _bolume_ekle(satirlar: list, ad: str, satir: str, once: str | None = None) -> None:
    """Satırı bölümün son dolu satırının ardına ekler. Bölüm yoksa `once` bölümünün önünde, o da yoksa sonda açılır."""
    aralik = _bolum_araligi(satirlar, ad)
    if aralik:
        son = aralik[1]
        while son > aralik[0] + 1 and not satirlar[son - 1].strip():
            son -= 1
        satirlar.insert(son, satir)
        return
    sonraki = _bolum_araligi(satirlar, once) if once else None
    if sonraki:
        satirlar[sonraki[0]:sonraki[0]] = ["## " + ad, satir, ""]
        return
    while satirlar and not satirlar[-1].strip():
        satirlar.pop()
    satirlar += ["", "## " + ad, satir, ""]


def _acik_uc_dugumu(kok: pathlib.Path, kimlik: str) -> dict:
    d = Dizin(pathlib.Path(kok)).kimlik.get(kimlik)
    if d is None:
        raise HarnessHata("%s bulunamadı" % kimlik)
    return d


def acik_uc_sayilari(dz: Dizin) -> list:
    """Açık ucu olan düğümler ve açık uç sayıları: [(kimlik, sayı)]."""
    return [(d["kimlik"], len(acik_uclar(d))) for d in dz.dugumler if acik_uclar(d)]


def acik_uc_metni(kok: pathlib.Path, kimlik: str, no: int) -> str | None:
    d = Dizin(pathlib.Path(kok)).kimlik.get(kimlik)
    return dict(acik_uclar(d)).get(no) if d else None


def acik_uc_ekle(kok: pathlib.Path, kimlik: str, metin: str) -> tuple:
    """Düğüme sıradaki numarayla açık uç ekler: (düğüm, numara). Numara açık ve kapanan uçların en büyüğünden artar."""
    kok = pathlib.Path(kok)
    d, metin = _acik_uc_dugumu(kok, kimlik), " ".join(str(metin).split())
    if not metin:
        raise HarnessHata("açık ucun metni boş olamaz")
    no = max([n for b in (ACIK_UCLAR, KAPANAN_UCLAR) for n, _ in acik_uclar(d, b)], default=0) + 1
    yol = kok / d["_yol"]
    satirlar = yol.read_text(encoding="utf-8").split("\n")
    _bolume_ekle(satirlar, ACIK_UCLAR, "- AU-%d: %s" % (no, metin), once=KAPANAN_UCLAR)
    yol.write_text("\n".join(satirlar), encoding="utf-8")
    return d, no


def acik_uc_kapat(kok: pathlib.Path, kimlik: str, no: int, karar: str, tarih: str | None = None) -> str:
    """Açık ucu bölümünden çıkarır ve `## Kapanan uçlar` bölümüne tarih ve kararla yazar; kapanan ucun metnini döner.
    Son açık uç kapanınca boş kalan bölüm de silinir."""
    kok = pathlib.Path(kok)
    d, karar = _acik_uc_dugumu(kok, kimlik), " ".join(str(karar).split())
    if not karar:
        raise HarnessHata("kapatma kararı boş olamaz")
    yol = kok / d["_yol"]
    satirlar = yol.read_text(encoding="utf-8").split("\n")
    aralik = _bolum_araligi(satirlar, ACIK_UCLAR) or (0, 0)
    bulunan = [i for i in range(*aralik) if ACIK_UC_SATIRI.match(satirlar[i])
               and int(ACIK_UC_SATIRI.match(satirlar[i]).group(1)) == no]
    if not bulunan:
        raise HarnessHata("%s/AU-%d açık uç değil (açık uçlar: python3 harness/h.py acik-uc %s)" % (kimlik, no, kimlik))
    metin = ACIK_UC_SATIRI.match(satirlar.pop(bulunan[0])).group(2).strip()
    bas, son = _bolum_araligi(satirlar, ACIK_UCLAR)
    if not any(s.strip() for s in satirlar[bas + 1:son]):
        del satirlar[bas:son]
    _bolume_ekle(satirlar, KAPANAN_UCLAR, "- AU-%d (%s): %s — karar: %s"
                 % (no, tarih or datetime.date.today().isoformat(), metin, karar))
    yol.write_text("\n".join(satirlar), encoding="utf-8")
    return metin


# ── Ajan kararları (TS-006 Yapı 20) ──────────────────────────────────────────────────
# Ajanın kullanıcıya sormadan verdiği kararlar düğümün gövdesinde üç biçimde tanınır: (1) `AK-<n>` ile başlayan liste
# maddesi (hangi girintide olursa olsun; aynı numaralı ek madde, "AK-19 eki" gibi, aynı kararın parçasıdır); (2)
# başlığında "Ajan kararları" geçen bölümün üst düzey liste maddeleri; (3) "Ajan kararı" sözüyle başlayan paragraf:
# bulunduğu bölüm tek karar öbeğidir ve başlığıyla gösterilir. İki biçime uyan madde bir kez sayılır; kod bloğu atlanır.

AJAN_KARARI_KARAKTER = 160   # gösterilen ilk cümlenin sınırı
KABUL_AJAN_KARARI = 20       # kabul sorusunda listelenen en çok karar; fazlası sayıyla söylenir
_LISTE_MADDESI = re.compile(r"^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$")
_AJAN_KARARI_NO = re.compile(r"AK-(\d+)\b")
_MD_BASLIK = re.compile(r"^(#{1,6})\s+(.*)$")
_KISALTMA = ("bkz", "örn", "ör", "orn", "vb", "vs")   # ardındaki nokta cümleyi bitirmez


def ilk_cumle(metin: str) -> str:
    """Metnin ilk cümlesi (nokta, ünlem ya da soru işaretinin ardından boşluk ya da son; rakamdan ya da kısaltmadan
    sonraki nokta cümleyi bitirmez); sınırı aşarsa kesilir."""
    for m in re.finditer(r"[.!?](?=\s|$)", metin):
        onceki = re.search(r"\w*$", metin[:m.start()]).group(0)
        if m.group(0) == "." and (onceki[-1:].isdigit() or onceki.lower() in _KISALTMA):
            continue
        metin = metin[:m.end()]
        break
    cumle = metin.strip()
    return cumle if len(cumle) <= AJAN_KARARI_KARAKTER else cumle[:AJAN_KARARI_KARAKTER - 1].rstrip() + "…"


def ajan_kararlari(d: dict) -> list:
    """Düğümün ajan kararları, metindeki sırayla, her biri ilk cümlesiyle (karar öbeği bölümün başlığıyla)."""
    kararlar: dict = {}
    baslik, baslik_no, ajan_duzeyi, kod = None, None, None, None
    for no, satir in enumerate(d["_govde"].split("\n")):
        cit = satir.lstrip()[:3]
        if cit in ("```", "~~~") and cit == (kod or cit):   # kod bloğu yalnız açtığı işaretle kapanır
            kod = None if kod else cit
            continue
        if kod:
            continue
        b, m = _MD_BASLIK.match(satir), _LISTE_MADDESI.match(satir)
        if b:
            baslik, baslik_no = b.group(2).strip(), no
            if ajan_duzeyi is None or len(b.group(1)) <= ajan_duzeyi:   # alt başlık "Ajan kararları" bölümünü bitirmez
                ajan_duzeyi = len(b.group(1)) if "ajan kararları" in baslik.lower() else None
        elif m and _AJAN_KARARI_NO.match(m.group(2)):
            kararlar.setdefault(("AK", int(_AJAN_KARARI_NO.match(m.group(2)).group(1))), m.group(2))
        elif m and ajan_duzeyi and not m.group(1):
            kararlar[("madde", no)] = m.group(2)
        elif not m and not ajan_duzeyi and satir.startswith("Ajan kararı"):
            kararlar.setdefault(("bolum", baslik_no), baslik or satir)
    return [ilk_cumle(k) for k in kararlar.values()]


def ajan_karari_sayimi(dz: Dizin) -> str | None:
    """Durum ve oturum başı için: taslaklardaki ajan kararlarının toplamı ve en çok taşıyan üç düğüm; yoksa None."""
    sayilar = [(d["kimlik"], len(ajan_kararlari(d))) for d in dz.dugumler if d["durum"] == "taslak"]
    sayilar = sorted([s for s in sayilar if s[1]], key=lambda s: -s[1])
    return ("%d, %d taslak düğümde (en çok: %s)" % (sum(n for _, n in sayilar), len(sayilar),
                                                    ", ".join("%s %d" % s for s in sayilar[:3]))) if sayilar else None


def ajan_karari_satirlari(d: dict) -> list:
    """Kabul sorusunun düğüm başına ek satırları: ajan kararlarının sayısı ve ilk cümleleri (en çok yirmisi)."""
    kararlar = ajan_kararlari(d)
    if not kararlar:
        return []
    satirlar = ["  ajan kararı: %d (sana sorulmadan verildi; kabul edersen bunları da teyit edersin):" % len(kararlar)]
    satirlar += ["    - " + k for k in kararlar[:KABUL_AJAN_KARARI]]
    if len(kararlar) > KABUL_AJAN_KARARI:
        satirlar.append("    … ilk %d gösterildi, toplam %d (hepsi: python3 harness/h.py ajan-karari %s)"
                        % (KABUL_AJAN_KARARI, len(kararlar), d["kimlik"]))
    return satirlar


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
        bagli = [dz.kimlik[o] for o in liste(k, "denetim_ref") if dz.kimlik.get(o, {}).get("tur") == "denetim"]
        if bagli and not any(komutu_var(d) or d.get("cesit") == "yerlesik" for d in bagli):
            s.append(B("Z6", "komutsuz-denetim", yer, "mekanik kuralın denetimlerinin hiçbirinde komut yok ve hiçbiri "
                       "yerleşik değil — denetim düğümüne `komut:` ya da `cesit: yerlesik` yaz", "uyari"))
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
    # Sözlük de bütçeye girer: konulu kavramın hangi işe düşeceği işe bağlıdır; en kötü durum bütün kabul edilmiş
    # kavramların pakete girmesidir (TS-009 Yapı 12)
    sozluk = len("\n\n" + _sozluk_blogu(dz.tur("kavram"))) if dz.tur("kavram") else 0
    for rol in dz.ayar["roller"]:
        p = _paket(dz, rol, (), ())
        if len(p["metin"]) + sozluk > butce["paket_karakter"]:
            s.append(B("Z14", "paket-sisti", rol, "kesin paket %d karakter%s; sınır %d — küme küçültülmeli"
                       % (len(p["metin"]) + sozluk, " (sözlük %d dahil)" % sozluk if sozluk else "",
                          butce["paket_karakter"])))
    return s


def _normatif(d: dict) -> str:
    alanlar = {"kural": ("kapsam", "kapsam_katman", "kapsam_tur", "olay", "denetim_duzey",
                         "denetim_ref", "kesinlik", "rol", "konu"),
               "karar": ("agirlik",), "yapi": ("yollar", "katman", "bagimli"),
               "denetim": ("komut",)}.get(d["tur"], ())   # komut kapıda koşar: değişmesi sürüm ister
    # Açık uçlar da bağlayıcıdır (işçi o noktada durur): kabul edilmiş düğümde eklemek ya da kapatmak sürüm ister
    uclar = acik_uclar(d)
    return json.dumps([d["_ifade"]] + [d.get(a) for a in alanlar] + ([uclar] if uclar else []),
                      ensure_ascii=False, sort_keys=True)


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
        eski = dict(alanlar, _ifade=bolumle(govde)[0], _bolumler=bolumle(govde)[1])
        if eski.get("durum") == "taslak" or "tur" not in eski:
            continue
        if _normatif(eski) != _normatif(d) and d["surum"] <= int(eski.get("surum", 0)):
            s.append(B("Z12", "surumsuz-degisiklik", d["kimlik"],
                       "bağlayıcı içerik değişti ama sürüm %s kaldı" % d["surum"]))
    return s


def _cekirdek_denetle(kok: pathlib.Path, bugun: datetime.date, taban: bool,
                      uretim: bool = True, komutlar: bool = True) -> list:
    dz = Dizin(kok)
    s = list(dz.okuma_bulgulari)
    dosyalar = dosyalari_listele(kok, dz.ayar)
    for d in dz.dugumler:
        s += _acik_uc_denetle(d)   # taslakta da: açık uç çoğu zaman taslak düğümdedir
        # taslakta da: kavramın tanımı sözlük satırıdır; boş tanımı Z1 (zorunlu-alan) zaten yakalar
        if d["tur"] == "kavram" and len(d["_ifade"]) > dz.ayar["butce"]["ifade_karakter"]:
            s.append(B("Z14", "uzun-tanim", d["kimlik"], "kavramın tanımı %d karakter; sınır %d"
                       % (len(d["_ifade"]), dz.ayar["butce"]["ifade_karakter"])))
        if d["tur"] == "kavram":   # yazım hatalı konu kavramı hiçbir pakete sokmaz: kuraldaki Z16 denetiminin aynısı
            s += [B("Z16", "tanimsiz-deger", d["kimlik"], "konu '%s' harness.json konular listesinde yok" % deger)
                  for deger in liste(d, "konu") if deger not in dz.ayar["konular"]]
        if d["tur"] == "denetim" and komut_hatasi(d):   # taslakta da: elle `denetim kos` taslağı da koşturur
            s.append(B("Z1", "gecersiz-komut", d["kimlik"], komut_hatasi(d)))
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
        if dz.ayar["rapor"]["zorunlu"]:
            import rapor  # aynı dizinde; yalnız taban dalla karşılaştırmada yüklenir
            s += rapor.dal_bulgulari(kok, dz.ayar)
        # Z20: yalnız push kapısında koşar; bayraksız denetle, commit kapısı ve ajanın push kancası koşturmaz
        for d in (kapi_denetimleri(dz) if komutlar else []):
            r = denetim_kos(kok, d, dz.ayar["denetim"]["zaman_asimi_sn"])
            if r["sonuc"] == "sure-asimi":
                s.append(B("Z20", "denetim-olculemedi", d["kimlik"], "%s sn içinde bitmedi, durduruldu — ölçülemedi%s"
                           % (r["sinir"], _son_satirlar(r))))
            elif r["sonuc"] == "kaldi":
                s.append(B("Z20", "denetim-kaldi", d["kimlik"], "komut %d koduyla kaldı%s"
                           % (r["kod"], _son_satirlar(r))))
    for b in s:  # açık düzeyin üstündeki kurallar yalnız uyarıdır
        if _DUZEY.get(b["kod"], 1) > dz.ayar["duzey"]:
            b["seviye"] = "uyari"
    return s


_DUZEY = {("Z%d" % i): (1 if i <= 18 else 2 if i <= 23 else 3) for i in range(1, 32)}
_DUZEY["Z19"] = 1   # rapor denetimi düzeyle değil `rapor.zorunlu` ayarıyla açılıp kapanır (KR-015)
_DUZEY["Z20"] = 1   # kabul edilmiş mekanik kuralın denetimi her düzeyde kırmızıdır (TS-006 Yapı 2)
_DUZEY["Z21"] = 1   # açık uç biçimi her düzeyde kırmızıdır: numara, soru ve kapatmanın adresidir (TS-006 Yapı 19)


# ── Denetim düğümleri ────────────────────────────────────────────────────────────────

SON_SATIR = 10   # kalan denetimin çıktısından gösterilen satır sayısı


# Denetim komutunun alt sürecine verilir (değeri denetimin kimliği); varken `denetle --dal` ve `denetim kos` denetim
# komutu koşturmaz: aracı çağıran bir denetim komutu iç içe koşum ve özyineleme doğurmaz. Git'in push kapısı
# (hook/git/pre-push) aracı çağırmadan önce değişkeni siler: gerçek gönderme değişkene hiç güvenmez.
ICICE = "HARNESS_DENETIM_KOSUYOR"


def komut_metni(d: dict) -> str:
    """Kabuğa verilecek metin. Baş bloğun ayrıştırıcısı tırnak açmaz: bütünüyle tek ya da çift tırnağa alınmış
    komutun (`komut: "[ -f harness.json ]"`) dış tırnağı burada açılır; içinde aynı tırnak geçen metne dokunulmaz."""
    v = d["komut"]
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'" and v[0] not in v[1:-1]:
        return v[1:-1]
    return v


def komut_hatasi(d: dict) -> str | None:
    """Denetimin `komut` alanı geçersizse nedeni; alan yoksa ya da geçerliyse None."""
    if "komut" not in d:
        return None
    if isinstance(d["komut"], list):   # `komut: [ -f x ]` baş blokta liste okunur
        return ("komut köşeli parantezle başladığı için liste okundu — komutu tırnak içine al "
                "(örnek: komut: \"[ -f harness.json ]\")")
    if not isinstance(d["komut"], str) or not komut_metni(d).strip():
        return "komut alanı boş olmayan bir metin olmalı"
    return None


def komutu_var(d: dict) -> bool:
    """Denetim düğümünün koşturulabilir komutu var mı. `komut` alanı yoksa düğüm yerleşik ya da elle sayılır."""
    return "komut" in d and komut_hatasi(d) is None


def _sonlandirildi(no: int, _cerceve) -> None:
    raise SystemExit(128 + no)


def kapi_denetimleri(dz: Dizin) -> list:
    """Push kapısında koşan denetimler: kabul edilmiş, kabul edilmiş mekanik bir kuralın denetim_ref alanında geçen
    ve komutu olanlar. Taslak denetim, taslak kurala bağlı denetim ve komutsuz denetim koşmaz."""
    refler = {o for k in dz.tur("kural") if k.get("denetim_duzey") == "mekanik" for o in liste(k, "denetim_ref")}
    return [d for d in dz.tur("denetim") if d["kimlik"] in refler and komutu_var(d)]


def denetim_kos(kok: pathlib.Path, d: dict, sinir: float) -> dict:
    """Denetimin komutunu deponun kökünde kabukla koşturur. Sınır aşılırsa komutun bütün süreç grubu durdurulur.
    Dönen: kimlik, sonuc (gecti · kaldi · sure-asimi), kod, sure (sn), sinir, son (çıktının son satırları).
    Bu süreç kesilirse (klavyeden kesme ya da sonlandırma sinyali) komutun süreç grubu da durdurulur. Bilinen sınır:
    kendi oturumunu açan (setsid) torun süreç bu gruptan çıkar ve izlenemez."""
    bas = time.monotonic()
    p = subprocess.Popen(komut_metni(d), shell=True, cwd=kok, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                         stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                         start_new_session=True, env=dict(os.environ, **{ICICE: d["kimlik"]}))
    eski = signal.signal(signal.SIGTERM, _sonlandirildi)   # öntanımlı sonlandırma temizliksiz çıkar
    try:
        cikti = p.communicate(timeout=sinir)[0]
        sonuc = "gecti" if p.returncode == 0 else "kaldi"
    except BaseException as e:   # süre aşımı, klavyeden kesme ya da sonlandırma sinyali
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:   # grup sınırla öldürme arasında kendiliğinden bitti
            pass
        if not isinstance(e, subprocess.TimeoutExpired):
            raise
        cikti = p.communicate()[0]
        sonuc = "sure-asimi"
    finally:
        signal.signal(signal.SIGTERM, eski if eski is not None else signal.SIG_DFL)
    return {"kimlik": d["kimlik"], "sonuc": sonuc, "kod": p.returncode, "sure": time.monotonic() - bas,
            "sinir": sinir, "son": [x for x in cikti.rstrip().split("\n") if x.strip()][-SON_SATIR:]}


def _son_satirlar(r: dict) -> str:
    return (": " + " | ".join(r["son"])) if r["son"] else ""


def denetle(kok: pathlib.Path, bugun: datetime.date | None = None, taban: bool = False,
            komutlar: bool = True) -> list:
    """Zincir kurallarını denetler; bulgu listesi döner (boş liste = temiz). `komutlar` yanlışsa taban dalla
    karşılaştırmada denetim komutları koşmaz (ajanın push kancası)."""
    return _cekirdek_denetle(pathlib.Path(kok), bugun or datetime.date.today(), taban, komutlar=komutlar)


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
TASLAK = re.compile(r"\n\n\[\[KB-TASLAK\]\]\n.*?\n\[\[/KB-TASLAK\]\]", re.S)
ACIK_UC_BLOGU = re.compile(r"\n\n\[\[KB-ACIK-UC\]\]\n.*?\n\[\[/KB-ACIK-UC\]\]", re.S)
SOZLUK_BLOGU = re.compile(r"\n\n\[\[KB-SOZLUK\]\]\n.*?\n\[\[/KB-SOZLUK\]\]", re.S)
SOZLUK_YONERGESI = ("Sözlük (bilgi; bağlayıcı değil): bu işte terimleri bu anlamda kullan; ayraçtaki eş anlamlıları "
                    "kullanma.")
ACIK_UC_YONERGESI = ("Açık uçlar (karara bağlanmamış noktalar): bu noktalardan birinde seçim yapman gerekirse seçme: "
                     "soruyla dur ve sorunda açık ucun kimliğini yaz (örnek KR-010/AU-1). Cevabı kullanıcı verir.")


def _kural_satiri(k: dict, inceleme: bool = False) -> str:
    duzey = DUZEY_ADI.get(k.get("denetim_duzey"), "?")
    ref = " " + ", ".join(liste(k, "denetim_ref")) if liste(k, "denetim_ref") else ""
    dayanak = ", ".join(_dayanak_coz(o)[0] for o in liste(k, "dayanak"))
    satir = "%s@%s [%s%s] %s (%s)" % (k["kimlik"], k["surum"], duzey, ref, k["_ifade"], dayanak)
    return "[ ] " + satir + " → uyuyor / uymuyor / uygulanmaz" if inceleme else satir


def _sozluk_blogu(kavramlar: list) -> str:
    satirlar = ["- %s: %s%s" % (kv["baslik"], " ".join(kv["_ifade"].split()),
                                " (kullanma: %s)" % ", ".join(liste(kv, "kacin")) if liste(kv, "kacin") else "")
                for kv in kavramlar]
    return "\n".join(["[[KB-SOZLUK]]", SOZLUK_YONERGESI, ""] + satirlar + ["[[/KB-SOZLUK]]"])


def _paket(dz: Dizin, rol: str, yollar, konular, dayanak=()) -> dict:
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
    metin = "[[KB-PAKET rol=%s ozet=%s]]\n%s\n[[/KB-PAKET]]" % (rol, ozet, govde)
    # Taslak bloğu: aynı yol ve konu eşlemesiyle seçilen, kabul bekleyen kurallar. Özetin (damganın) dışındadır.
    taslak = [k for k in dz.tur("kural", "taslak")
              if (k.get("kesinlik") == "kesin" and (rol == "*" or not liste(k, "rol") or rol in liste(k, "rol"))
                  and (not konular or not liste(k, "konu") or konular & set(liste(k, "konu"))))
              or any(dz.yola_duser(k, y) for y in yollar)]
    taslak_kararlar = [kr for kr in dz.tur("karar", "taslak")
                       if kr["kimlik"] in {_dayanak_coz(o)[0] for k in taslak for o in liste(k, "dayanak")}]
    tam = metin
    if taslak:   # satırlar "- " ile başlar: hüküm istenen kural satırı (KU-NNN@N) sayılmaz
        blok = ["[[KB-TASLAK]]", "Taslak (bağlayıcı değil; bilgi): aşağıdakiler henüz kabul edilmedi. Bilgi için "
                "verilir; kabul edilmeden bağlayıcı değildir, onlara aykırılık engel değil öneridir."]
        if inceleme:
            blok.append("İnceleyici: taslağa aykırılığı bulgu olarak yaz, önemini \"oneri\" yap; hüküm listesine koyma.")
        blok += [""] + ["- %s@%s %s: %s (%s)" % (k["kimlik"], k["surum"], k["baslik"], k["_ifade"],
                                                  ", ".join(_dayanak_coz(o)[0] for o in liste(k, "dayanak")))
                        for k in taslak]
        if taslak_kararlar:
            blok += ["", "Dayandıkları taslak kararlar:"] + ["- %s %s" % (kr["kimlik"], kr["baslik"])
                                                             for kr in taslak_kararlar]
        tam += "\n\n" + "\n".join(blok + ["[[/KB-TASLAK]]"])
    # Açık uç bloğu (TS-006 Yapı 19): işe düşen düğümlerin (bağlayıcı kurallar ve kararları, taslak bloğundakiler,
    # işin dayanakları) karara bağlanmamış noktaları. Özetin (damganın) dışındadır; açık uç yoksa yazılmaz.
    bagli_kararlar = [_dayanak_coz(o)[0] for k in kesin + yoldan for o in liste(k, "dayanak")]
    dugumler = {d["kimlik"]: d for d in kesin + yoldan + taslak + taslak_kararlar}
    for kimlik in bagli_kararlar + list(dayanak):
        dugumler.setdefault(kimlik, dz.kimlik.get(kimlik))
    uclar = ["- %s/AU-%d: %s" % (k, no, m) for k, d in dugumler.items() if d for no, m in acik_uclar(d)]
    if uclar:
        tam += "\n\n" + "\n".join(["[[KB-ACIK-UC]]", ACIK_UC_YONERGESI, ""] + uclar + ["[[/KB-ACIK-UC]]"])
    # Sözlük bloğu (TS-009 Yapı 12): kabul edilmiş kavramlardan konusuz olan her pakete, konulu olan yalnız işin
    # konularından biriyle kesişiyorsa girer. Bilgidir; özetin (damganın) dışındadır; kavram yoksa yazılmaz.
    kavramlar = [kv for kv in dz.tur("kavram") if not liste(kv, "konu") or konular & set(liste(kv, "konu"))]
    if kavramlar:
        tam += "\n\n" + _sozluk_blogu(kavramlar)
    return {"metin": metin, "tam": tam,
            "ozet": ozet, "kurallar": ["%s@%s" % (k["kimlik"], k["surum"]) for k in kesin + yoldan],
            "bos": not (kesin or yoldan), "sozluk": [kv["kimlik"] for kv in kavramlar],
            "taslaklar": [k["kimlik"] for k in taslak] + [kr["kimlik"] for kr in taslak_kararlar]}


def paket(kok: pathlib.Path, rol: str, yollar=(), konular=(), dayanak=()) -> dict:
    """Bir role verilecek kural paketi: kesin kurallar + verilen yollara düşenler. `dayanak`, işin dayandığı düğümlerdir;
    yalnız açık uç bloğuna girer."""
    dz = Dizin(pathlib.Path(kok))
    if rol != "*" and rol not in dz.ayar["roller"]:
        raise HarnessHata("rol '%s' harness.json roller listesinde yok" % rol)
    # Desen verilmişse eşleşen dosyalara açılır: kural, görevin dokunacağı dosyalara göre seçilir.
    acik = set(yollar)
    desenler = [y for y in yollar if "*" in y or "?" in y]
    if desenler:
        acik |= {f for f in dosyalari_listele(dz.kok, dz.ayar)
                 if any(desen_eslesir(d, f) for d in desenler)}
    return _paket(dz, rol, tuple(sorted(acik)), tuple(konular), tuple(dayanak))


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


# Kancanın soruyu gösterirken bıraktığı tek kullanımlık izin işareti (--taslakla, açık uç cevabı, açık uç kapatma).
# İşaret, kancanın gördüğü komutun araca ulaşacak bağımsız değişkenlerinin özetine bağlıdır; araç aynı özeti kendi
# bağımsız değişkenlerinden hesaplar ve yalnız eşleşen taze işareti tüketir: reddedilmiş sorunun işareti, bağımsız
# değişkenleri farklı bir komutu koşturamaz. Güvencenin sınırı: bağımsız değişkenleri birebir aynı olup kancanın çağrı
# olarak tanımadığı bir komut ($H değişkeni, h.p? kalıbı gibi), işaretin ömrü içinde (IZIN_SURESI_SN) reddedilmiş
# sorunun işaretini tüketebilir. Kanca aynı tür ve hedef için yeni soru sorarken eski işareti siler: reddedilmiş
# sorunun işareti sonraki soruyla geçersiz olur.
IZIN_SURESI_SN = 120
IZIN_HEDEFI = re.compile(r"[A-Z]{2}-[0-9]+")   # düğüm, görev ya da epic kimliği; işaretin dosya adı yalnız bundan kurulur


def komut_ozeti(argv: list) -> str:
    """Komut satırının `h.py` ardındaki bağımsız değişkenlerinin (komut adı dahil) özeti."""
    return hashlib.sha256(json.dumps([str(a) for a in argv], ensure_ascii=False).encode("utf-8")).hexdigest()


def izin_isareti(kok: pathlib.Path, tur: str, hedef: str) -> pathlib.Path:
    """İşaretin yolu. Hedef düğüm, görev ya da epic kimliği değilse ya da yol izin klasörünün dışına çıkıyorsa
    HarnessHata: işaret yazılmaz, okunmaz, silinmez."""
    klasor = ortak_kok(pathlib.Path(kok)) / ".harness" / "onay"
    yol = klasor / ("%s-%s.json" % (tur, hedef))
    if not IZIN_HEDEFI.fullmatch(str(hedef)) or yol.resolve().parent != klasor.resolve():
        raise HarnessHata("izin işaretinin hedefi geçersiz: %r (düğüm, görev ya da epic kimliği olmalı)" % (hedef,))
    return yol


def izin_yaz(kok: pathlib.Path, tur: str, hedef: str, ozet: str | None, veri: dict | None = None,
             simdi: float | None = None) -> None:
    yol = izin_isareti(kok, tur, hedef)
    yol.parent.mkdir(parents=True, exist_ok=True)
    yol.write_text(json.dumps(dict(veri or {}, zaman=simdi or time.time(), ozet=ozet), ensure_ascii=False),
                   encoding="utf-8")


def izin_sil(kok: pathlib.Path, tur: str, hedef: str) -> None:
    izin_isareti(kok, tur, hedef).unlink(missing_ok=True)


def izin_tuket(kok: pathlib.Path, tur: str, hedef: str, ozet: str | None) -> bool:
    """İşaret taze ve bu komutun özetine bağlıysa tüketilir ve True döner. Süresi geçmiş işaret silinir; başka bir
    komuta bağlı taze işarete dokunulmaz (sorusu henüz cevaplanmamış olabilir)."""
    yol = izin_isareti(kok, tur, hedef)
    try:
        isaret = json.loads(yol.read_text(encoding="utf-8"))
        taze = 0 <= time.time() - float(isaret["zaman"]) <= IZIN_SURESI_SN
        eslesir = ozet is not None and isaret.get("ozet") == ozet
        if eslesir or not taze:
            yol.unlink()
        return taze and eslesir
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
    icice = "--dal" in arg and os.environ.get(ICICE)
    if icice:
        print("denetle: denetim komutları koşturulmadı — %s denetiminin komutunun içinden çağrıldı (iç içe koşum yok)"
              % icice)
    bulgular = denetle(kok, taban="--dal" in arg, komutlar=not icice)
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
        if d["tur"] == "kavram":
            konular = liste(d, "konu")
            roller = [r for r in dz.ayar["roller"] if hedef in _paket(dz, r, (), konular)["sozluk"]]
            print("  kaçın : %s" % (", ".join(liste(d, "kacin")) or "(yok)"))
            print("  sözlük: %s" % (("%s paketinde, %s" % (", ".join(roller), "konusu %s olan işlerde" % ", ".join(
                konular) if konular else "her işte")) if roller else "hiçbir pakete girmez (durum: %s)" % d["durum"]))
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
    print(paket(kok, rol, _secenek(arg, "--yol"), _secenek(arg, "--konu"))["tam"])
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


def soz_dizini(kok: pathlib.Path) -> pathlib.Path:
    """Söz defteri (TS-009 Yapı 13): ana çalışma ağacında durur; çalışma ağacı silinince defter kaybolmaz."""
    return ortak_kok(kok) / ".harness" / "soz"


def sozler(kok: pathlib.Path, gun: str | None = None, agac: str | None = None, sonra: str | None = None) -> list:
    """Söz defterinin kayıtları zaman sırasıyla; her kayda dosyasının adı `oturum` olarak eklenir. `gun`: zamanı o
    günde (YYYY-AA-GG) olanlar; `agac`: o çalışma ağacında yazılanlar; `sonra`: zamanı bu andan (ISO) yeni olanlar
    (o andan beri değişmemiş dosya okunmaz)."""
    esik = datetime.datetime.fromisoformat(sonra).timestamp() if sonra else None
    kayitlar = []
    for p in sorted(soz_dizini(kok).glob("*.jsonl")):
        if esik is not None and p.stat().st_mtime < esik:
            continue
        for satir in p.read_text(encoding="utf-8").split("\n"):
            try:
                k = json.loads(satir) if satir.strip() else None
            except ValueError:
                continue
            if not isinstance(k, dict):
                continue
            zaman = str(k.get("zaman", ""))
            if (gun and not zaman.startswith(gun)) or (agac and k.get("agac") != agac) or (sonra and zaman < sonra):
                continue
            kayitlar.append(dict(k, oturum=p.stem))
    return sorted(kayitlar, key=lambda k: str(k.get("zaman", "")))


def kisalt(metin, sinir: int) -> str:
    """Boşlukları teke indirir; `sinir` karakteri aşan metni sonuna '…' koyarak o sınıra keser."""
    metin = " ".join(str(metin).split())
    return metin if len(metin) <= sinir else metin[:sinir - 1] + "…"


def _komut_soz(kok: pathlib.Path, arg: list) -> int:
    gun, agac = (_secenek(arg, "--gun") or [None])[0], (_secenek(arg, "--agac") or [None])[0]
    if gun:
        try:
            datetime.date.fromisoformat(gun)
        except ValueError:
            raise HarnessHata("kullanım: h.py soz [--gun YYYY-AA-GG] [--agac AD]")
    kayitlar = sozler(kok, gun, agac)
    for k in kayitlar:
        print("%s · %s · %s · %s\n  %s" % (k.get("zaman"), k.get("agac"), k.get("tur"), k["oturum"],
                                          str(k.get("metin", "")).replace("\n", "\n  ")))
    print("soz: %d kayıt" % len(kayitlar))
    return 0


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
    uclar = acik_uc_sayilari(dz)
    if uclar:
        print("  açık uç: %d (%s) — liste: python3 harness/h.py acik-uc" % (
            sum(n for _, n in uclar), ", ".join("%s %d" % ku for ku in uclar)))
    ajan = ajan_karari_sayimi(dz)
    if ajan:
        print("  ajan kararı: %s — liste: python3 harness/h.py ajan-karari" % ajan)
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
            print("\n".join(["%s\n  %s" % (_dugum_ozeti(d), d["_ifade"])] + ajan_karari_satirlari(d)))
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


def _kapatma_izni(kok: pathlib.Path, arg: list, kimlik: str, no: int, karar: str) -> None:
    """Açık uç kapatma kullanıcının kararıdır: kancanın bu komuta bıraktığı taze işaret ya da kullanıcının kendi
    uçbiriminde verdiği onay; ikisi de yoksa kapatılmaz."""
    if izin_tuket(kok, "acik-uc-kapat", kimlik, komut_ozeti(["acik-uc"] + arg)):
        return
    if sys.stdin.isatty() and sys.stdout.isatty():   # kullanıcının kendi terminali: soruyu komut sorar
        print("%s/AU-%d — %s\nyazılacak karar: %s" % (kimlik, no, acik_uc_metni(kok, kimlik, no) or "(bulunamadı)",
                                                      karar))
        if input("Açık uç kapatılsın mı? Onay için 'evet' yaz: ").strip().lower() == "evet":
            return
        raise HarnessHata("%s/AU-%d kapatılmadı: kullanıcı onaylamadı" % (kimlik, no))
    raise HarnessHata("%s/AU-%d kapatılmadı: kapatma kullanıcının onayını ister ve bu komut için taze bir onay "
                      "işareti yok. Claude Code'da bu komutu kanca kullanıcıya sorar ve işareti o bırakır (komut "
                      "`python3 harness/h.py acik-uc kapat ...` biçiminde tek komut olarak yazılmalı); başka yerde "
                      "komutu kullanıcı kendi terminalinde çalıştırır." % (kimlik, no))


def _komut_acik_uc(kok: pathlib.Path, arg: list) -> int:
    no = re.fullmatch(r"AU-(\d+)", arg[2]) if arg[:1] == ["kapat"] and len(arg) > 2 else None
    if arg[:1] == ["ekle"] and len(arg) > 2:
        d, n = acik_uc_ekle(kok, arg[1], " ".join(arg[2:]))
        print("eklendi: %s/AU-%d (%s)" % (arg[1], n, d["_yol"]))
        if d["durum"] != "taslak":
            print("not: %s %s durumunda; açık uç bağlayıcı içeriktir, sürümü artır (Z12)" % (arg[1], d["durum"]))
        return 0
    if no and _secenek(arg, "--karar"):
        karar = _secenek(arg, "--karar")[0]
        _kapatma_izni(kok, arg, arg[1], int(no.group(1)), karar)
        durum = _acik_uc_dugumu(kok, arg[1])["durum"]
        metin = acik_uc_kapat(kok, arg[1], int(no.group(1)), karar)
        print("kapandı: %s/AU-%s — %s\n  karar: %s (Kapanan uçlar bölümünde)" % (arg[1], no.group(1), metin, karar))
        if durum != "taslak":
            print("not: %s %s durumunda; açık uç bağlayıcı içeriktir, kapatmak onu değiştirir: sürümü artır (Z12)"
                  % (arg[1], durum))
        return 0
    if len(arg) > 1 or (arg and not KIMLIK.match(arg[0])):
        raise HarnessHata('kullanım: h.py acik-uc [<KİMLİK>] | acik-uc ekle <KİMLİK> "<metin>" | '
                          'acik-uc kapat <KİMLİK> AU-<n> --karar "<metin>"')
    dz = Dizin(kok)
    if arg and arg[0] not in dz.kimlik:
        raise HarnessHata("%s bulunamadı" % arg[0])
    dugumler = [dz.kimlik[arg[0]]] if arg else dz.dugumler
    toplam = 0
    for d in dugumler:
        for n, metin in acik_uclar(d):
            print("%s/AU-%d [%s] %s" % (d["kimlik"], n, d["durum"], metin))
            toplam += 1
    print("%d açık uç%s" % (toplam, (", %d düğümde" % sum(bool(acik_uclar(d)) for d in dugumler)) if toplam else ""))
    return 0


def _komut_ajan_karari(kok: pathlib.Path, arg: list) -> int:
    if len(arg) > 1 or (arg and not KIMLIK.match(arg[0])):
        raise HarnessHata("kullanım: h.py ajan-karari [<KİMLİK>]")
    dz = Dizin(kok)
    if arg and arg[0] not in dz.kimlik:
        raise HarnessHata("%s bulunamadı" % arg[0])
    toplam, dugum = 0, 0
    for d in [dz.kimlik[arg[0]]] if arg else dz.dugumler:
        kararlar = ajan_kararlari(d)
        if kararlar:
            print("%s [%s] %d ajan kararı — %s" % (d["kimlik"], d["durum"], len(kararlar), d["baslik"]))
            print("\n".join("  - " + k for k in kararlar))
            toplam, dugum = toplam + len(kararlar), dugum + 1
    print("%d ajan kararı%s" % (toplam, (", %d düğümde" % dugum) if toplam else ""))
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


def _komut_rapor(kok: pathlib.Path, arg: list) -> int:
    import rapor  # aynı dizinde; yalnız bu komutta yüklenir
    return rapor.komut(kok, arg)


def _komut_denetim(kok: pathlib.Path, arg: list) -> int:
    dz = Dizin(kok)
    if arg[:1] == ["durum"]:
        denetimler = dz.tur("denetim", None)
        for d in denetimler:
            kurallar = ["%s (%s, %s)" % (k["kimlik"], k["durum"], DUZEY_ADI.get(k.get("denetim_duzey"), "?"))
                        for k in dz.tur("kural", None) if d["kimlik"] in liste(k, "denetim_ref")]
            komut = ("`%s`" % d["komut"] if komutu_var(d) else "geçersiz" if "komut" in d
                     else "yok — yerleşik" if d.get("cesit") == "yerlesik" else "yok — yerleşik ya da elle")
            print("  %s [%s] %s\n      kural: %s · komut: %s" % (d["kimlik"], d["durum"], d["baslik"],
                                                              ", ".join(kurallar) or "bağlı kural yok", komut))
        print("denetim durum: %d denetim, %d komutlu, %d push kapısında koşar" % (
            len(denetimler), sum(map(komutu_var, denetimler)), len(kapi_denetimleri(dz))))
        return 0
    if arg[:1] != ["kos"]:
        raise HarnessHata("kullanım: h.py denetim <kos [DN-NNN ...] | durum>")
    kimlikler = arg[1:]
    for k in kimlikler:
        if dz.kimlik.get(k, {}).get("tur") != "denetim":
            raise HarnessHata("%s bir denetim düğümü değil" % k)
    icice = os.environ.get(ICICE)
    if icice:
        print("denetim kos: denetim komutları koşturulmadı — %s denetiminin komutunun içinden çağrıldı (iç içe "
              "koşum yok)" % icice)
        return 0
    # Elle çağrıda taslak denetim de koşar; kimlik verilmezse komutu olan taslak ve kabul edilmiş denetimler koşar.
    secilen = ([dz.kimlik[k] for k in kimlikler] if kimlikler
               else [d for d in dz.dugumler if d["tur"] == "denetim" and d["durum"] in ("taslak", "kabul")])
    sinir = dz.ayar["denetim"]["zaman_asimi_sn"]
    gecen, kalan, kosmayan, gecersiz = 0, 0, [], []
    for d in secilen:
        if komut_hatasi(d):
            gecersiz.append(d)
            continue
        if not komutu_var(d):
            kosmayan.append(d["kimlik"])
            continue
        r = denetim_kos(kok, d, sinir)
        if r["sonuc"] == "gecti":
            gecen += 1
            print("  geçti  %s (%.1f sn) %s" % (d["kimlik"], r["sure"], d["baslik"]))
            continue
        kalan += 1
        print("  KALDI  %s (%.1f sn) %s — %s" % (d["kimlik"], r["sure"], d["baslik"],
                                                 "%s sn sınırı aşıldı, durduruldu" % sinir
                                                 if r["sonuc"] == "sure-asimi" else "çıkış kodu %d" % r["kod"]))
        for satir in r["son"]:
            print("      | " + satir)
    for k in kosmayan:
        print("  koşturulamaz  %s: komutu yok (yerleşik ya da elle)" % k)
    for d in gecersiz:
        print("  GEÇERSİZ  %s: komutu geçersiz — %s" % (d["kimlik"], komut_hatasi(d)))
    print("denetim kos: %d geçti, %d kaldı%s%s" % (gecen, kalan, ", %d koşturulamaz" % len(kosmayan)
                                                   if kosmayan else "", ", %d geçersiz" % len(gecersiz)
                                                   if gecersiz else ""))
    return 1 if kalan or gecersiz else 2 if kimlikler and kosmayan else 0


# ozet komutunun 3. bölümü: kapıların kodu ve ayarı sayılan yollar; tabandaki korunan_ayar desenleri bunlara eklenir
KAPI_DOSYALARI = ("harness/**", ".claude/**", ".github/**", "harness.json", "AGENTS.md", "CLAUDE.md",
                  "**/eslint.config.*", "**/tsconfig*.json", "**/vitest.config*.ts", "**/package.json",
                  "pnpm-lock.yaml", "pnpm-workspace.yaml")
FARK_TURU = {"A": "eklendi", "M": "değişti", "T": "değişti", "D": "silindi"}


def _komut_ozet(kok: pathlib.Path, arg: list) -> int:
    """PR özeti: ortak atadan uca kabule geçen düğümler ve kapı dosyaları. Kapı değildir, karar vermez.

    İçerik yalnız git nesnelerinden okunur; uçtaki kod çalışmaz, böylece sunucuda taban dalın koduyla koşar.
    --taban verilmezse taban dal uçtaki harness.json'dan okunur, yani uç onu değiştirebilir: sunucuda ve
    güvenilmeyen uçta --taban açıkça verilir.
    """
    if len(arg) % 2 or any(a not in ("--taban", "--uc") for a in arg[::2]):
        raise HarnessHata("kullanım: h.py ozet [--taban <başvuru>] [--uc <başvuru>] — --taban verilmezse taban "
                          "dal uçtaki harness.json'dan okunur (uç değiştirebilir); sunucuda --taban açıkça verilir")
    uc = (_secenek(arg, "--uc") or ["HEAD"])[0]
    taban = (_secenek(arg, "--taban") or [None])[0]
    if not taban:
        try:
            taban = json.loads(_git(kok, "show", "%s:harness.json" % uc)).get("taban_dal")
        except (HarnessHata, ValueError, AttributeError):
            taban = None
        taban = taban if isinstance(taban, str) and taban else VARSAYILAN_AYAR["taban_dal"]
    for bas in (uc, taban):
        if subprocess.run(["git", "rev-parse", "--verify", "--quiet", bas + "^{commit}"], cwd=kok,
                          capture_output=True).returncode != 0:
            raise HarnessHata("başvuru bulunamadı: %s" % bas)
    ata = _git(kok, "merge-base", taban, uc).strip()
    try:
        korunan = json.loads(_git(kok, "show", "%s:harness.json" % taban)).get("korunan_ayar") or []
    except (HarnessHata, ValueError):
        korunan = []
    eski, yeni, okunamadi, kapi, bozuk = {}, {}, [], [], set()
    for satir in _git(kok, "diff", "--name-status", "--no-renames", ata, uc).splitlines():
        tur, yol = satir.split("\t", 1)
        if any(desen_eslesir(d, yol) for d in (*KAPI_DOSYALARI, *korunan)):
            kapi.append("- `%s`: %s" % (yol, FARK_TURU.get(tur[0], tur)))
        m = DOSYA_ADI.match(yol.rsplit("/", 1)[-1])
        if not yol.startswith("kb/") or not m or {"_gelen", "_arsiv"} & set(yol.split("/")):
            continue
        if tur != "A":
            try:
                eski[m.group(1)] = ayristir(_git(kok, "show", "%s:%s" % (ata, yol)))[0]
            except BicimHatasi:
                eski[m.group(1)] = {"durum": "okunamadı"}
        if tur != "D":
            try:
                yeni[m.group(1)] = ayristir(_git(kok, "show", "%s:%s" % (uc, yol)))[0]
            except BicimHatasi as e:
                okunamadi.append("- `%s`: okunamadı (%s)" % (yol, e))
                bozuk.add(m.group(1))   # bozuk dosya silinmiş sayılmasın: yalnız okunamadı diye geçer
    gecen, degisen = [], []
    for kimlik in sorted((set(eski) | set(yeni)) - bozuk):
        e, y = eski.get(kimlik), yeni.get(kimlik)
        ad = "%s (%s) %s" % (kimlik, (y or e).get("tur", "?"), (y or e).get("baslik", ""))
        if y and y.get("durum") == "kabul" and (not e or e.get("durum") != "kabul"):
            gecen.append("- %s: %s → kabul, sürüm %s" % (ad, e.get("durum", "?") if e else "yeni", y.get("surum")))
        elif e and e.get("durum") == "kabul" and not y:
            degisen.append("- %s: kabul düğümü silindi (sürüm %s)" % (ad, e.get("surum")))
        elif e and e.get("durum") == "kabul" and y.get("durum") != "kabul":
            degisen.append("- %s: kabul → %s, sürüm %s → %s" % (ad, y.get("durum"), e.get("surum"), y.get("surum")))
        elif e and e.get("durum") == "kabul":
            artmadi = not (isinstance(y.get("surum"), int) and isinstance(e.get("surum"), int)
                           and y["surum"] > e["surum"])
            degisen.append("- %s: sürüm %s → %s%s" % (ad, e.get("surum"), y.get("surum"),
                                                     " (sürüm artmadı)" if artmadi else ""))
    print("# PR özeti: %s → %s (ortak ata %s)\n" % (taban, uc, ata[:10]))
    for baslik, satirlar in (("Kabule geçen düğümler", gecen + okunamadi),
                             ("Kabul edilmiş düğümde değişiklik", degisen),
                             ("Kapı dosyalarında değişiklik", kapi)):
        print("## %s\n%s\n" % (baslik, "\n".join(satirlar) or "yok"))
    return 0


def _graf_komutu(ad: str):
    def kos(kok: pathlib.Path, arg: list) -> int:
        import graf  # aynı dizinde; yalnız bu komutlarda yüklenir
        return graf.komut(kok, ad, arg)
    return kos


KOMUTLAR = {"denetle": _komut_denetle, "sor": _komut_sor, "paket": _komut_paket,
            "uret": _komut_uret, "yeni": _komut_yeni, "kabul": _komut_kabul,
            "durum": _komut_durum, "kur": _komut_kur, "gorev": _komut_gorev, "plan": _komut_plan,
            "rapor": _komut_rapor, "denetim": _komut_denetim, "acik-uc": _komut_acik_uc,
            "ajan-karari": _komut_ajan_karari, "soz": _komut_soz, "ozet": _komut_ozet,
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
