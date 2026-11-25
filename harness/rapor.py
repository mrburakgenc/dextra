#!/usr/bin/env python3
"""rapor.py — işin raporu: açılır (`yeni`), görev tablosu kayıtlardan üretilir (`uret`), raporsuz görev aranır (`durum`).

Rapor elle yazılan bölümlerle aracın ürettiği görev tablosundan oluşur (KR-015, KU-016). Tablo iki işaret satırı
arasındadır ve görev kayıtlarından (ana çalışma ağacında .harness/gorev/) üretilir; elle yazılmaz.
Push kapısı (`h.py denetle --dal`) bu dalda alınmış olup hiçbir raporda geçmeyen görevi kırmızı bildirir (Z19).

Bağımlılık yok: Python 3.9+ standart kütüphanesi ve git.
"""
from __future__ import annotations

import datetime
import json
import pathlib
import re

import gorev
import h

BASLA = "<!-- otomatik:basla -->"
BITIR = "<!-- otomatik:bitir -->"
# Şablondaki her elle yazılan bölüm bu biçimde tek satırlık yer tutucu taşır; denetim onu boş sayar.
YER_TUTUCU = re.compile(r"^_\(doldurulacak:.*\)_$")
ZORUNLU_BOLUMLER = ("Kısa özet", "Kullanıcıdan beklenenler")
# Atılan görevin aşama hücresindeki "yerine GV-NNN" yerine geçen görevi bu rapora koymaz (o kendi satırıyla girer).
GOREV_KIMLIGI = re.compile(r"(?<!yerine )\bGV-\d+\b")
ALMA_BASLIGI = re.compile(r"^(GV-\d+):")   # `gorev al` commit'i böyle başlar
CIZGI = "—"
BASLIK_SINIRI = 90
NOT_SATIRI = ("Bu bölümü araç üretir (`python3 harness/h.py rapor uret <dosya>`); sayılar aracın kayıtlarından "
              "(`.harness/gorev/`) okunur, elle yazılmaz. Süre ve maliyet her görevin koşu geçmişindeki BÜTÜN işçi "
              "koşularının ve incelemelerinin toplamıdır; 'Koşu' kolonu işçi koşusu / inceleme sayısıdır. Koşu geçmişi "
              "olmayan eski görevde yalnız son işçi koşusu ve son inceleme sayılır, 'Koşu' kolonu boş kalır.")
TABLO_BASI = ("| Görev | Plan | Başlık | Aşama | Koşu | İşçi (dk) | İnceleme (dk) | Dolar | Dosya "
              "| İncelemenin bulguları | Cevaplanan soru |\n|---|---|---|---|---|---|---|---|---|---|---|")


# ── Raporlar ─────────────────────────────────────────────────────────────────────────

def _raporlar(kok: pathlib.Path, ayar: dict) -> dict:
    """Rapor dizinindeki her raporun metni (yol → metin)."""
    dizin = pathlib.Path(kok) / ayar["rapor"]["dizin"]
    return {p: p.read_text(encoding="utf-8") for p in sorted(dizin.rglob("*.md"))} if dizin.is_dir() else {}


def _geciyor_mu(kimlik: str, metin: str) -> bool:
    """Kimlik metinde tam sözcük olarak geçiyor mu (GV-0071, GV-007'yi taşımaz)."""
    return re.search(r"(?<!yerine )\b%s\b" % re.escape(kimlik), metin) is not None


def _bolum_bos_mu(metin: str, ad: str) -> bool:
    """`## [N. ]<ad>...` bölümü yoksa, boşsa ya da yalnız yer tutucu taşıyorsa True."""
    govde = None
    for satir in metin.split("\n"):
        if satir.startswith("## "):
            if govde is not None:
                break
            if re.sub(r"^\d+\.\s*", "", satir[3:].strip()).startswith(ad):
                govde = []
        elif govde is not None:
            govde.append(satir.strip())
    return not [s for s in govde or [] if s and not YER_TUTUCU.match(s)]


def _blok(metin: str, yol: pathlib.Path) -> tuple:
    """Otomatik bloğun içinin (başı, sonu) konumu."""
    bas, son = metin.find(BASLA), metin.find(BITIR)
    if bas < 0 or son < bas:
        raise h.HarnessHata("%s içinde otomatik blok işaretleri yok (%s ... %s)" % (yol, BASLA, BITIR))
    return bas + len(BASLA), son


# ── Görev tablosu ────────────────────────────────────────────────────────────────────

def _oku(yol: pathlib.Path) -> dict | None:
    """Kayıt dosyası; yoksa ya da bozuksa None."""
    try:
        veri = json.loads(yol.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return veri if isinstance(veri, dict) else None


def _sayi(kayit: dict | None, *anahtarlar: str) -> float | None:
    for a in anahtarlar:
        kayit = kayit.get(a) if isinstance(kayit, dict) else None
    return float(kayit) if isinstance(kayit, (int, float)) and not isinstance(kayit, bool) else None


def _asama(d: dict) -> str:
    if d.get("durum") == "atildi":
        return "atıldı" + (" · yerine %s" % d["yerine"] if d.get("yerine") else "")
    if d.get("alindi"):
        return "alındı"
    if d.get("durum") == "taslak":
        return "bekliyor"
    if d.get("inceleme") == "gecti":
        return "incelendi"
    if d.get("inceleme") in ("kaldi", "sorunlu"):
        return "incelemede kaldı"
    return str(d.get("durum") or CIZGI)


def _kayitli_gorevler(kok: pathlib.Path) -> list:
    ana = gorev._kayit(kok)
    return [p.name for p in ana.iterdir() if p.is_dir() and re.fullmatch(r"GV-\d+", p.name)] if ana.is_dir() else []


def _satir(kok: pathlib.Path, kimlik: str) -> dict:
    kayit = gorev._kayit(kok, kimlik)
    d = _oku(kayit / "durum.json")
    rapor = _oku(kayit / "rapor.json")
    inceleme = _oku(kayit / "inceleme-rapor.json")
    cevaplar = {"cevaplar": []} if not (kayit / "cevaplar.json").exists() else _oku(kayit / "cevaplar.json")
    gecmis = gorev.kosu_gecmisi(kayit)
    if gecmis:   # bütün koşuların toplamı
        isciler = [_sayi(k, "sure_sn") or 0 for k in gecmis if k.get("tip") == "isci"]
        incelemeler = [_sayi(k, "sure_sn") or 0 for k in gecmis if k.get("tip") == "inceleme"]
        isci_sn = sum(isciler) if isciler else None
        inceleme_sn = sum(incelemeler) if incelemeler else None
        maliyetler = [m for m in (_sayi(k, "maliyet_usd") for k in gecmis) if m is not None]
        kosu = "%d / %d" % (len(isciler), len(incelemeler))
    else:        # geçmişi olmayan eski görev: son koşu ve son inceleme
        isci_sn, inceleme_sn = _sayi(rapor, "sure_sn"), _sayi(inceleme, "sure_sn")
        maliyetler = [m for m in (_sayi(rapor, "kullanim", "total_cost_usd"),
                                  _sayi(inceleme, "kullanim", "total_cost_usd")) if m is not None]
        kosu = CIZGI
    dolar = sum(maliyetler) if maliyetler else None
    degisen = (rapor or {}).get("degisen")
    bulgular = (inceleme or {}).get("bulgular")
    cevap = (cevaplar or {}).get("cevaplar")
    if d is not None:
        baslik = " ".join(str(d.get("baslik") or CIZGI).split()).replace("|", "/")[:BASLIK_SINIRI]
        plan = " ".join(str(x) for x in (d.get("plan"), d.get("adim")) if x) or CIZGI
    hucreler = [
        kimlik,
        plan if d is not None else CIZGI,
        baslik if d is not None else CIZGI,
        _asama(d) if d is not None else CIZGI,
        kosu,
        "%.1f" % (isci_sn / 60) if isci_sn is not None else CIZGI,
        "%.1f" % (inceleme_sn / 60) if inceleme_sn is not None else CIZGI,
        "%.2f" % dolar if dolar is not None else CIZGI,
        str(len(degisen)) if isinstance(degisen, list) else CIZGI,
        ("%d engel, %d öneri" % tuple(sum(isinstance(b, dict) and b.get("onem") == onem for b in bulgular)
                                      for onem in ("engel", "oneri"))) if isinstance(bulgular, list) else CIZGI,
        str(len(cevap)) if isinstance(cevap, list) else CIZGI,
    ]
    return {"metin": "| " + " | ".join(hucreler) + " |", "alindi": bool(d and d.get("alindi")),
            "dakika": sum((x or 0) for x in (isci_sn, inceleme_sn)) / 60, "dolar": dolar or 0}


def tablo(kok: pathlib.Path, kimlikler) -> str:
    """Otomatik bloğun içeriği: not, toplam satırı ve görev tablosu."""
    satirlar = [_satir(kok, k) for k in sorted(set(kimlikler), key=lambda k: int(k[3:]))]
    toplam = ("Tabloda %d görev var, %d tanesi alındı. Koşuların ve incelemelerin toplamı: %.1f dakika, "
              "%.2f dolar." % (len(satirlar), sum(s["alindi"] for s in satirlar),
                               sum(s["dakika"] for s in satirlar), sum(s["dolar"] for s in satirlar)))
    return "\n".join([NOT_SATIRI, "", toplam, "", TABLO_BASI] + [s["metin"] for s in satirlar])


def uret(kok: pathlib.Path, dosya) -> pathlib.Path:
    """Raporun otomatik bloğunu yeniden üretir; bloğun dışına dokunmaz.

    Tablo, bloğun içinde zaten yazılı kimlikleri ve başka hiçbir raporda geçmeyen kayıtlı görevlerin hepsini taşır."""
    kok = pathlib.Path(kok)
    ayar = h.ayar_oku(kok)
    yol = pathlib.Path(dosya) if pathlib.Path(dosya).is_absolute() else kok / dosya
    if not yol.is_file():
        raise h.HarnessHata("rapor bulunamadı: %s" % dosya)
    metin = yol.read_text(encoding="utf-8")
    bas, son = _blok(metin, yol)
    baska = [t for p, t in _raporlar(kok, ayar).items() if p.resolve() != yol.resolve()]
    kimlikler = set(GOREV_KIMLIGI.findall(metin[bas:son])) | {
        k for k in _kayitli_gorevler(kok) if not any(_geciyor_mu(k, t) for t in baska)}
    yeni_metin = metin[:bas] + "\n" + tablo(kok, kimlikler) + "\n" + metin[son:]
    if yeni_metin != metin:
        yol.write_text(yeni_metin, encoding="utf-8")
    return yol


def yeni(kok: pathlib.Path, konu: str, tarih: str | None = None) -> pathlib.Path:
    """Rapor dizininde `<tarih>-<konu>.md` dosyasını şablondan açar ve görev tablosunu üretir; var olanın üzerine yazmaz."""
    kok = pathlib.Path(kok)
    ayar = h.ayar_oku(kok)
    tarih = tarih or datetime.date.today().isoformat()
    try:
        datetime.date.fromisoformat(tarih)
    except ValueError:
        raise h.HarnessHata("tarih YYYY-AA-GG biçiminde olmalı (verilen: %s)" % tarih)
    sablon = kok / "harness" / "sablon" / "rapor.md"
    if not sablon.is_file():
        raise h.HarnessHata("şablon yok: %s" % sablon.relative_to(kok))
    hedef = kok / ayar["rapor"]["dizin"] / ("%s-%s.md" % (tarih, h._slug(konu)))
    if hedef.exists():
        raise h.HarnessHata("%s zaten var; üzerine yazılmaz. Tablosunu yenilemek için: python3 harness/h.py rapor "
                            "uret %s" % (hedef.relative_to(kok), hedef.relative_to(kok)))
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(sablon.read_text(encoding="utf-8").replace("{KONU}", konu).replace("{TARIH}", tarih),
                     encoding="utf-8")
    return uret(kok, hedef)


# ── Denetim (Z19) ────────────────────────────────────────────────────────────────────

def dal_bulgulari(kok: pathlib.Path, ayar: dict) -> list:
    """Z19: taban dala göre bu dalda alınmış (`GV-NNN:` başlıklı commit) olup hiçbir raporda geçmeyen görev ve bu
    görevleri taşıyan raporda boş bırakılmış zorunlu bölüm. Eski raporlar (bu dalın görevini taşımayan) sınanmaz."""
    kok = pathlib.Path(kok)
    try:
        taban = h._git(kok, "merge-base", "HEAD", ayar["taban_dal"]).strip()
    except h.HarnessHata as e:
        raise h.HarnessHata("Z19 ölçülemedi — taban dal '%s' ile karşılaştırılamıyor (%s)" % (ayar["taban_dal"], e))
    basliklar = h._git(kok, "log", "--format=%s", "%s..HEAD" % taban).split("\n")
    kimlikler = sorted({m.group(1) for s in basliklar for m in [ALMA_BASLIGI.match(s)] if m},
                       key=lambda k: int(k[3:]))
    raporlar = _raporlar(kok, ayar)
    s = [h.B("Z19", "raporsuz-gorev", k, "bu dalda alındı ama %s altındaki hiçbir raporda geçmiyor — raporu aç: "
             "python3 harness/h.py rapor yeni \"<konu>\" (var olan raporun tablosunu yenilemek için: rapor uret "
             "<dosya>)" % ayar["rapor"]["dizin"])
         for k in kimlikler if not any(_geciyor_mu(k, t) for t in raporlar.values())]
    for yol, metin in raporlar.items():
        if not any(_geciyor_mu(k, metin) for k in kimlikler):
            continue
        s += [h.B("Z19", "bos-rapor-bolumu", yol.relative_to(kok).as_posix(),
                  "'%s' bölümü boş ya da yalnız yer tutucu taşıyor — elle yaz" % ad)
              for ad in ZORUNLU_BOLUMLER if _bolum_bos_mu(metin, ad)]
    return s


# ── Komut satırı ─────────────────────────────────────────────────────────────────────

def komut(kok: pathlib.Path, arg: list) -> int:
    if arg[:1] == ["yeni"]:
        konu = " ".join(a for i, a in enumerate(arg[1:], 1)
                        if not a.startswith("--") and not arg[i - 1].startswith("--"))
        if not konu:
            raise h.HarnessHata('kullanım: h.py rapor yeni "<konu>" [--tarih YYYY-AA-GG]')
        yol = yeni(kok, konu, (h._secenek(arg, "--tarih") or [None])[0])
        print("rapor açıldı: %s\nelle yazılacak bölümlerde '_(doldurulacak: ...)_' satırlarının yerine yaz; "
              "sonra: python3 harness/h.py rapor durum" % yol.relative_to(kok))
        return 0
    if arg[:1] == ["uret"] and len(arg) > 1:
        print("rapor üretildi: %s" % uret(kok, arg[1]))
        return 0
    if arg[:1] == ["durum"]:
        try:
            bulgular = dal_bulgulari(kok, h.ayar_oku(kok))
        except h.HarnessHata as e:
            print("rapor durum: %s" % e)
            return 0
        for b in bulgular:
            print("  %s %s — %s" % (b["ad"], b["yer"], b["mesaj"]))
        print("rapor durum: %d raporsuz görev, %d boş bölüm" % (
            sum(b["ad"] == "raporsuz-gorev" for b in bulgular), sum(b["ad"] == "bos-rapor-bolumu" for b in bulgular))
              if bulgular else "rapor durum: bu dalda raporsuz görev ve boş bölümlü rapor yok")
        return 0
    raise h.HarnessHata('kullanım: h.py rapor <yeni "<konu>" [--tarih YYYY-AA-GG] | uret <dosya> | durum>')
