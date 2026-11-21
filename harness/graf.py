"""graf.py — zincirin türetilmiş görünümleri: SQLite dizini, sorgu, etki ve çizim.

Kaynak her zaman kb/ altındaki dosyalardır. Buradaki her çıktı onlardan kurulur, silinip yeniden kurulabilir
ve hiçbir kapı ona güvenmez: hook'lar ve `denetle` dosyaları okur. Sorgular diskteki dizine değil, her seferinde
dosyalardan bellekte yeniden kurulan dizine sorulur; bu yüzden bayat cevap veremezler.

Bağımlılık yok: sqlite3 Python'un standart kütüphanesindedir.
"""
from __future__ import annotations

import hashlib
import html as html_kacis
import os
import pathlib
import re
import sqlite3
import subprocess

import h

DIZIN_DOSYASI = ".harness/dizin.db"
CIZIM_DOSYASI = ".harness/graf.html"

TABLOLAR = (
    ("dugum", "kimlik TEXT PRIMARY KEY, tur TEXT, durum TEXT, surum INTEGER, baslik TEXT, ifade TEXT, yol TEXT, "
              "kesinlik TEXT, denetim_duzey TEXT, agirlik TEXT",
     "her karar, kural, yapı, denetim ve tasarım için bir satır (taslaklar dahil)"),
    ("kenar", "kaynak TEXT, bag TEXT, hedef TEXT, surum INTEGER",
     "düğümden düğüme adlı bağ: dayanak, kapsam, denetim_ref, bagimli, baglam, yerine, celisir"),
    ("desen", "dugum TEXT, desen TEXT", "kuralın ya da yapının çözülmüş yol desenleri"),
    ("dosya", "dugum TEXT, yol TEXT", "o desenlerin bu çalışma ağacında eşleştiği dosyalar"),
    ("alan", "dugum TEXT, ad TEXT, deger TEXT", "başlık bloğundaki her alan; liste alanı öğe başına bir satır"),
    ("meta", "anahtar TEXT PRIMARY KEY, deger TEXT", "dizin neyden kuruldu: kaynağın imzası, commit, harness sürümü"),
)
ORNEKLER = (
    ("Bir karardan doğan kurallar", "select kaynak from kenar where bag = 'dayanak' and hedef = 'KR-001'"),
    ("Bir dosyaya düşen kurallar", "select dugum from dosya where yol = 'src/a.ts'"),
    ("Bir role giden kurallar", "select dugum from alan where ad = 'rol' and deger = 'inceleyici'"),
    ("Çok adımlı: bir düğüme bağlı her şey",
     "with recursive z(k) as (select 'KR-001' union select kaynak from kenar join z on hedef = k) select k from z"),
)
# Bir düğüm değişince ona bu bağlarla bağlanan düğümler de etkilenir (bağın kaynağı, hedefine bağımlıdır).
ETKI_BAGLARI = ("dayanak", "kapsam", "bagimli", "baglam", "denetim_ref")
ETKI_SORGUSU = """
with recursive e(kimlik, adim, bag) as (
  select ?, 0, ''
  union
  select k.kaynak, e.adim + 1, k.bag from kenar k join e on k.hedef = e.kimlik
  where k.bag in (%s) and e.adim < (select count(*) from dugum)
)
select kimlik, adim, bag from e where kimlik != ? order by adim, bag, kimlik
"""
# Yalnız okuma: SELECT, sütun okuma, işlev ve özyinelemeli sorgu. Yazma, PRAGMA ve ATTACH reddedilir.
OKUMA_ISLEMLERI = {20, 21, 31, 33}
DOSYA_SINIRI = 20

SEKIL = {"karar": ('{{"', '"}}'), "kural": ('["', '"]'), "yapi": ('[["', '"]]'), "denetim": ('[/"', '"/]'),
         "tasarim": ('(["', '"])')}
SINIFLAR = ("  classDef taslak stroke-dasharray: 5 4", "  classDef pasif opacity: 0.45",
            "  classDef eksik stroke:#c0392b,stroke-dasharray: 2 3", "  classDef uc stroke:#999,color:#666")
SAYFA = """<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Zincir grafı</title>
<style>body{font:14px system-ui,sans-serif;margin:24px}p{color:#666}</style>
</head>
<body>
<h1>Zincir grafı</h1>
<p>Bu sayfa bir görünümdür: kb/ altındaki dosyalardan üretildi (%s), elle düzenlenmez.
Yeniden üretmek için: <code>python3 harness/h.py graf --html</code>. Kesik çizgili düğüm taslaktır.</p>
<pre class="mermaid">
%s</pre>
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, securityLevel: "strict" });
</script>
</body>
</html>
"""


# ── Graf ─────────────────────────────────────────────────────────────────────────────

def kenarlar(dz: h.Dizin) -> list:
    """Düğümden düğüme bağlar: (kaynak, bağ, hedef, sürüm). Yol desenleri kenar değildir; `desen` tablosundadır."""
    s = set()
    for d in dz.dugumler:
        k = d["kimlik"]
        for oge in h.liste(d, "dayanak"):
            hedef, surum = h._dayanak_coz(oge)
            s.add((k, "dayanak", hedef, surum))
        s |= {(k, "kapsam", o, None) for o in h.liste(d, "kapsam") if h.KIMLIK.match(o)}
        for alan in ("denetim_ref", "bagimli", "celisir"):
            s |= {(k, alan, o, None) for o in h.liste(d, alan)}
        for alan in ("yerine", "baglam"):
            if d.get(alan):
                s.add((k, alan, str(d[alan]), None))
    return sorted(s, key=lambda x: x[:3])


def _desenler(dz: h.Dizin, d: dict) -> list:
    if d["tur"] == "kural":
        return sorted(set(dz.kural_desenleri(d)))
    return sorted(set(h.liste(d, "yollar"))) if d["tur"] == "yapi" else []


def imza(kok: pathlib.Path) -> str:
    """Dizinin kaynağının (harness.json ve kb/ düğümleri) özeti; kaynak değişince değişir."""
    kok = pathlib.Path(kok)
    ozet = hashlib.sha256()
    for p in [kok / "harness.json", *h.kb_dosyalari(kok)]:
        ozet.update(p.relative_to(kok).as_posix().encode("utf-8") + b"\0" + p.read_bytes() + b"\0")
    return ozet.hexdigest()


def _commit(kok: pathlib.Path) -> str:
    r = subprocess.run(["git", "rev-parse", "--verify", "--quiet", "HEAD"], cwd=kok, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def _metin(deger) -> str | None:
    return None if deger is None else ", ".join(map(str, deger)) if isinstance(deger, list) else str(deger)


def baglan(kok: pathlib.Path) -> sqlite3.Connection:
    """Dizini dosyalardan bellekte kurar ve bağlantısını döner. Her çağrı baştan kurar: bayatlayacak bir şey yok."""
    kok = pathlib.Path(kok)
    dz = h.Dizin(kok)
    dosyalar = h.dosyalari_listele(kok, dz.ayar)
    b = sqlite3.connect(":memory:")
    for ad, sutunlar, _ in TABLOLAR:
        b.execute("create table %s (%s)" % (ad, sutunlar))
    for d in dz.dugumler:
        k = d["kimlik"]
        b.execute("insert into dugum values (?,?,?,?,?,?,?,?,?,?)",
                  (k, d["tur"], d["durum"], d["surum"], str(d["baslik"]), d["_ifade"], d["_yol"],
                   _metin(d.get("kesinlik")), _metin(d.get("denetim_duzey")), _metin(d.get("agirlik"))))
        b.executemany("insert into alan values (?,?,?)",
                      [(k, ad, str(oge)) for ad in d if not ad.startswith("_") for oge in h.liste(d, ad)])
        desenler = _desenler(dz, d)
        b.executemany("insert into desen values (?,?)", [(k, x) for x in desenler])
        b.executemany("insert into dosya values (?,?)",
                      [(k, f) for f in dosyalar if any(h.desen_eslesir(x, f) for x in desenler)])
    b.executemany("insert into kenar values (?,?,?,?)", kenarlar(dz))
    b.executemany("insert into meta values (?,?)", [("imza", imza(kok)), ("commit", _commit(kok)),
                                                    ("harness", h.SURUM), ("bicim_surumu", str(h.BICIM_SURUMU))])
    b.commit()
    return b


def yaz(kok: pathlib.Path) -> pathlib.Path:
    """Dizini başka araçların açabilmesi için dosyaya döker (yerel; git'e girmez). Var olanın üstüne baştan yazar."""
    kok = pathlib.Path(kok)
    hedef = kok / DIZIN_DOSYASI
    hedef.parent.mkdir(parents=True, exist_ok=True)
    gecici = hedef.with_name(hedef.name + ".yeni")
    if gecici.exists():
        gecici.unlink()
    bellek = baglan(kok)
    disk = sqlite3.connect(str(gecici))
    try:
        bellek.backup(disk)
    finally:
        disk.close()
        bellek.close()
    os.replace(gecici, hedef)
    return hedef


def _yalniz_oku(islem, *_):
    return sqlite3.SQLITE_OK if islem in OKUMA_ISLEMLERI else sqlite3.SQLITE_DENY


def sorgu(kok: pathlib.Path, sql: str, parametreler=()) -> tuple:
    """(sütun adları, satırlar). Sorgu taze kurulmuş dizine sorulur ve yalnız okuyabilir."""
    b = baglan(kok)
    try:
        b.set_authorizer(_yalniz_oku)
        try:
            imlec = b.execute(sql, tuple(parametreler))
            satirlar = imlec.fetchall()
        except (sqlite3.Error, sqlite3.Warning) as e:
            raise h.HarnessHata("sorgu çalışmadı (yalnız tek bir SELECT kabul edilir): %s" % e)
        return [s[0] for s in imlec.description or []], satirlar
    finally:
        b.close()


def etki(kok: pathlib.Path, kimlik: str) -> dict:
    """Bu düğüm değişirse ne etkilenir: ona (adım adım) bağlı düğümler, kurallarının dosyaları ve denetimleri."""
    b = baglan(kok)
    try:
        dugum = {s[0]: {"kimlik": s[0], "tur": s[1], "durum": s[2], "surum": s[3], "baslik": s[4]}
                 for s in b.execute("select kimlik, tur, durum, surum, baslik from dugum")}
        if kimlik not in dugum:
            raise h.HarnessHata("%s bulunamadı" % kimlik)
        baglilar, gorulen = [], set()
        for k, adim, bag in b.execute(ETKI_SORGUSU % ",".join("?" * len(ETKI_BAGLARI)),
                                      (kimlik, *ETKI_BAGLARI, kimlik)):
            if k in dugum and k not in gorulen:   # en kısa yol ilk gelir; sonrakiler aynı düğümün uzun yollarıdır
                gorulen.add(k)
                baglilar.append(dict(dugum[k], adim=adim, bag=bag))
        etkilenen = [kimlik] + [x["kimlik"] for x in baglilar]
        yer = ",".join("?" * len(etkilenen))
        dosyalar = [s[0] for s in b.execute(
            "select distinct f.yol from dosya f join dugum d on d.kimlik = f.dugum "
            "where d.tur = 'kural' and f.dugum in (%s) order by f.yol" % yer, etkilenen)]
        denetimler = [s[0] for s in b.execute(
            "select distinct hedef from kenar where bag = 'denetim_ref' and kaynak in (%s) order by hedef" % yer,
            etkilenen)]
        return {"dugum": dugum[kimlik], "baglilar": baglilar, "dosyalar": dosyalar, "denetimler": denetimler}
    finally:
        b.close()


# ── Çizim ────────────────────────────────────────────────────────────────────────────

def _cid(kimlik: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "_", kimlik)


def _etiket(metin) -> str:
    return (str(metin).replace("&", "#amp;").replace('"', "#quot;").replace("<", "#lt;").replace(">", "#gt;"))


def mermaid(kok: pathlib.Path) -> str:
    """Zinciri Mermaid akış çizimi olarak verir. Aynı depoda hep aynı metni üretir."""
    kok = pathlib.Path(kok)
    dz = h.Dizin(kok)
    dosyalar = h.dosyalari_listele(kok, dz.ayar)
    baglar = kenarlar(dz)
    s, siniflar, uclar = ["flowchart LR"], [], {}
    for d in sorted(dz.dugumler, key=lambda x: x["kimlik"]):
        ac, kapa = SEKIL.get(d["tur"], ('["', '"]'))
        s.append("  %s%s%s · %s%s" % (_cid(d["kimlik"]), ac, d["kimlik"], _etiket(d["baslik"]), kapa))
        if d["durum"] == "taslak":
            siniflar.append("  class %s taslak" % _cid(d["kimlik"]))
        elif d["durum"] in ("ezildi", "emekli"):
            siniflar.append("  class %s pasif" % _cid(d["kimlik"]))
    for k in sorted({hedef for _, _, hedef, _ in baglar if hedef not in dz.kimlik}):
        s.append('  %s["%s (yok)"]' % (_cid(k), _etiket(k)))
        siniflar.append("  class %s eksik" % _cid(k))
    for kaynak, bag, hedef, _ in baglar:
        s.append("  %s -->|%s| %s" % (_cid(kaynak), bag, _cid(hedef)))

    def uc(etiket: str, sekil: tuple) -> str:
        if etiket not in uclar:
            uclar[etiket] = "U%d" % (len(uclar) + 1)
            s.append("  %s%s%s%s" % (uclar[etiket], sekil[0], _etiket(etiket), sekil[1]))
            siniflar.append("  class %s uc" % uclar[etiket])
        return uclar[etiket]

    for d in sorted(dz.dugumler, key=lambda x: x["kimlik"]):
        alan = "yollar" if d["tur"] == "yapi" else "kapsam"
        for desen in h.liste(d, alan):
            if h.KIMLIK.match(desen):
                continue
            n = sum(h.desen_eslesir(desen, f) for f in dosyalar)
            s.append("  %s -.->|%s| %s" % (_cid(d["kimlik"]), alan, uc("%s · %d dosya" % (desen, n), ('("', '")'))))
        for olay in h.liste(d, "olay"):
            s.append("  %s -.->|olay| %s" % (_cid(d["kimlik"]), uc("olay: %s" % olay, ('(("', '"))'))))
    return "\n".join(s + list(SINIFLAR) + siniflar) + "\n"


def html(kok: pathlib.Path) -> str:
    """Çizimi tarayıcıda açılacak tek sayfa olarak verir (çizen kütüphane internetten yüklenir)."""
    kok = pathlib.Path(kok)
    kaynak = "kaynak imzası %s" % imza(kok)[:12] + ((" · commit %s" % _commit(kok)[:12]) if _commit(kok) else "")
    return SAYFA % (html_kacis.escape(kaynak), html_kacis.escape(mermaid(kok), quote=False))


# ── Komut satırı ─────────────────────────────────────────────────────────────────────

def _tanitim() -> str:
    s = ["Dizin, kb/ dosyalarından her sorguda yeniden kurulur; yalnız okunur. Tablolar:"]
    s += ["  %-6s %s\n         (%s)" % (ad, aciklama, re.sub(r" (TEXT|INTEGER)( PRIMARY KEY)?", "", sutunlar))
          for ad, sutunlar, aciklama in TABLOLAR]
    s += ["", "Örnekler:"] + ["  %s:\n    python3 harness/h.py sorgu \"%s\"" % o for o in ORNEKLER]
    return "\n".join(s)


def _ozet(d: dict) -> str:
    return "%s@%s [%s] %s" % (d["kimlik"], d["surum"], d["durum"], d["baslik"])


def komut(kok: pathlib.Path, ad: str, arg: list) -> int:
    kok = pathlib.Path(kok)
    if ad == "dizin":
        yol = yaz(kok)
        b = sqlite3.connect(str(yol))
        try:
            sayi = [b.execute("select count(*) from %s" % t).fetchone()[0] for t in ("dugum", "kenar", "dosya")]
        finally:
            b.close()
        print("dizin: %s — %d düğüm, %d kenar, %d dosya eşleşmesi" % (yol.relative_to(kok), *sayi))
        print("  bu bir görünümdür: kaynak kb/ dosyalarıdır, kapılar bu dosyaya bakmaz; kb değişince yeniden kur.")
        print("  aç: sqlite3 %s   ·   sor: python3 harness/h.py sorgu \"<SELECT>\"" % yol.relative_to(kok))
        return 0
    if ad == "sorgu":
        if not arg:
            print(_tanitim())
            return 0
        basliklar, satirlar = sorgu(kok, " ".join(arg))
        print("\t".join(basliklar))
        for satir in satirlar:
            print("\t".join("" if x is None else str(x) for x in satir))
        return 0
    if ad == "etki":
        if not arg:
            raise h.HarnessHata("kullanım: h.py etki <KİMLİK>")
        e = etki(kok, arg[0])
        print("%s — değişirse:" % _ozet(e["dugum"]))
        for bagli in e["baglilar"]:
            print("  %d. adım  %s  ← %s" % (bagli["adim"], _ozet(bagli), bagli["bag"]))
        if not e["baglilar"]:
            print("  (buna bağlı başka düğüm yok)")
        n = len(e["dosyalar"])
        if n:
            fazla = " … ve %d dosya daha" % (n - DOSYA_SINIRI) if n > DOSYA_SINIRI else ""
            print("  kuralların düştüğü dosyalar (%d): %s%s" % (n, ", ".join(e["dosyalar"][:DOSYA_SINIRI]), fazla))
        if e["denetimler"]:
            print("  yeniden koşacak denetimler: %s" % ", ".join(e["denetimler"]))
        print("  görülmeyen: koddaki etiketler (@kural, @dogrular) bu sürümde taranmıyor.")
        return 0
    if ad == "graf":
        if "--html" in arg:
            yol = kok / CIZIM_DOSYASI
            yol.parent.mkdir(parents=True, exist_ok=True)
            yol.write_text(html(kok), encoding="utf-8")
            print("graf: %s — tarayıcıda aç: open %s" % (yol.relative_to(kok), yol.relative_to(kok)))
            return 0
        print(mermaid(kok), end="")
        return 0
    raise h.HarnessHata("bilinmeyen komut: %s" % ad)
