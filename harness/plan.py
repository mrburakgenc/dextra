#!/usr/bin/env python3
"""plan.py — iş planı: space → epic → task → subtask.

  space    bir özellik (feature): adı, amacı ve yolları vardır; epicleri toplar
  epic     geliştirilecek konu: hedefi ve task'ları vardır
  task     işin kendisi: ya doğrudan koşturulur (yaprak) ya da subtask'lara bölünür (kapsayıcı)
  subtask  task'ın bir parçası; her zaman yapraktır

- Koşturulan birim yapraktır: her yaprağın bir görev kartı vardır (gorev.py) ve kendi çalışma ağacında
  koşar, incelenir, alınır.
- İşaret elle konmaz. Yaprak, görevi alınınca işaretlenir; task, epic ve space alttan yukarı türetilir.
- Önkoşulu bitmemiş yaprak koşmaz; önkoşulsuz yapraklar ayrı ağaçlarda yan yana koşabilir.
- Plan ana çalışma ağacında durur (.harness/plan/<space>/): ayrı ağaçlardaki oturumlar aynı ağacı görür.

Bağımlılık yok: Python 3.9+ standart kütüphanesi.
"""
from __future__ import annotations

import concurrent.futures
import datetime
import os
import pathlib
import re

import h
import gorev

YERTUTUCU = "(yazılmadı)"
TASK = re.compile(r"^- \[( |x)\] (\d+)\. (.+?)(?: — (GV-\d+))?(?: · önce: ([\d, ]+))? · (.*)$")
SUBTASK = re.compile(r"^  - \[( |x)\] (\d+\.\d+) (.+?) — (GV-\d+)(?: · önce: ([\d., ]+))? · (.*)$")
EPIC_BASLIGI = re.compile(r"^# (EP-\d+) — (.*)$")
EPIC_SATIRI = re.compile(r"^- \[( |x)\] (EP-\d+) — .*$")

SPACE_SABLONU = """# Space: {ad}

Anahtar: {anahtar}
Özellik düğümü: (bilgi tabanında bu özelliğin düğümü açılınca kimliği buraya yazılır)
Yollar: {yollar}
Açıldı: {tarih}

## Amaç
{amac}

## Epicler
<!-- Bu liste elle yazılmaz; epiclerin ölçülen durumundan türetilir. -->
"""

EPIC_SABLONU = """# {kimlik} — {baslik}

Space: {anahtar}
Açıldı: {tarih}

## Hedef
{hedef}

## Tasklar
<!-- Task:    python3 harness/h.py plan task {kimlik} "<başlık>" [--once 1,2] [--hedef "..." --olcut "..."] -->
<!-- Subtask: python3 harness/h.py plan subtask {kimlik} <task-no> "<başlık>" --hedef "..." --olcut "..." [--once 1,2] -->
<!-- İşaret elle konmaz: yaprak, görevi koşup incelenip alınınca kendiliğinden işaretlenir. -->
"""


# ── Yerler ───────────────────────────────────────────────────────────────────────────

def _dizin(kok: pathlib.Path) -> pathlib.Path:
    return h.ortak_kok(kok) / ".harness" / "plan"


def _space_dizini(kok: pathlib.Path, anahtar: str) -> pathlib.Path:
    d = _dizin(kok) / anahtar
    if not anahtar or anahtar.startswith("_") or not (d / "space.md").is_file():
        raise h.HarnessHata("space '%s' bulunamadı" % anahtar)
    return d


def _epic_space(kok: pathlib.Path, ep: str) -> str:
    kayit = _dizin(kok) / "_epic" / ep
    if not kayit.is_file():
        raise h.HarnessHata("%s bulunamadı" % ep)
    return kayit.read_text(encoding="utf-8").strip()


def _epic_yolu(kok: pathlib.Path, ep: str) -> pathlib.Path:
    return _dizin(kok) / _epic_space(kok, ep) / (ep + ".md")


def _epicler(kok: pathlib.Path, anahtar: str | None = None) -> list:
    dizin = _dizin(kok) / "_epic"
    kimlikler = sorted(p.name for p in dizin.glob("EP-*")) if dizin.is_dir() else []
    return [e for e in kimlikler if anahtar is None or _epic_space(kok, e) == anahtar]


def _spaceler(kok: pathlib.Path) -> list:
    dizin = _dizin(kok)
    return sorted(p.parent.name for p in dizin.glob("*/space.md")) if dizin.is_dir() else []


def _yaz(yol: pathlib.Path, metin: str) -> None:
    gecici = yol.with_name(yol.name + ".yaz")   # yarım yazılmış dosyayı başka oturum okumasın
    gecici.write_text(metin, encoding="utf-8")
    os.replace(gecici, yol)


def _temiz(baslik: str) -> str:
    """Başlıktaki satır ayıraçlarını düzeltir; yoksa satır geri okunamaz."""
    return re.sub(r"\s+", " ", baslik.replace(" · ", " - ").replace(" — ", " - ")).strip()


def _zorunlu(kok: pathlib.Path) -> bool:
    return h.ayar_oku(pathlib.Path(kok))["gorev"].get("inceleme", "zorunlu") == "zorunlu"


# ── Satırlar ─────────────────────────────────────────────────────────────────────────

def _kutu(isaret: bool) -> str:
    return "x" if isaret else " "


def _task_satiri(t: dict) -> str:
    return "- [%s] %s. %s%s%s · %s" % (
        _kutu(t["isaret"]), t["no"], t["baslik"], (" — " + t["gorev"]) if t["gorev"] else "",
        (" · önce: " + ", ".join(t["once"])) if t["once"] else "", t["durum"])


def _subtask_satiri(a: dict) -> str:
    return "  - [%s] %s %s — %s%s · %s" % (
        _kutu(a["isaret"]), a["no"], a["baslik"], a["gorev"],
        (" · önce: " + ", ".join(a["once"])) if a["once"] else "", a["durum"])


def _bolum_sonu(satirlar: list, baslik: str) -> int:
    """`## baslik` bölümünün son dolu satırından sonraki sıra; bölüm yoksa sona ekler."""
    try:
        bas = next(i for i, s in enumerate(satirlar) if s.strip() == "## " + baslik)
    except StopIteration:
        satirlar += ["", "## " + baslik]
        bas = len(satirlar) - 1
    son = next((i for i in range(bas + 1, len(satirlar)) if satirlar[i].startswith("## ")), len(satirlar))
    while son > bas + 1 and not satirlar[son - 1].strip():
        son -= 1
    return son


# ── Okuma ve türetme ─────────────────────────────────────────────────────────────────

def _gorev_asamasi(kok: pathlib.Path, kimlik: str, zorunlu: bool) -> tuple:
    kayit = gorev._kayit(kok, kimlik)
    d = gorev._json_oku(kayit / "durum.json")
    if not d:
        return False, "görev kaydı yok"
    return gorev.asama(d, gorev._json_oku(kayit / "rapor.json"), zorunlu, gorev.kosu_isareti(kayit))


def _coz(metin: str) -> tuple:
    """Epic dosyasından başlığı ve task ağacını çıkarır (durumlar dosyadan değil kayıttan gelir)."""
    baslik, tasklar = "", []
    for satir in metin.split("\n"):
        b = EPIC_BASLIGI.match(satir)
        if b and not baslik:
            baslik = b.group(2)
        m = TASK.match(satir)
        if m:
            tasklar.append({"no": m.group(2), "baslik": m.group(3), "gorev": m.group(4),
                            "once": re.findall(r"\d+", m.group(5) or ""), "subtasklar": []})
            continue
        m = SUBTASK.match(satir)
        if m and tasklar and m.group(2).split(".")[0] == tasklar[-1]["no"]:
            tasklar[-1]["subtasklar"].append({"no": m.group(2), "baslik": m.group(3), "gorev": m.group(4),
                                              "once": re.findall(r"\d+\.\d+", m.group(5) or "")})
    return baslik, tasklar


def _turet(kok: pathlib.Path, tasklar: list) -> dict:
    """Yaprakların durumunu görev kayıtlarından okur; task ve epic durumunu alttan yukarı türetir."""
    zorunlu = _zorunlu(kok)
    alinan = atilan = yaprak = 0
    for t in tasklar:
        for a in t["subtasklar"]:
            a["isaret"], a["durum"] = _gorev_asamasi(kok, a["gorev"], zorunlu)
        if t["gorev"]:
            t["isaret"], t["durum"] = _gorev_asamasi(kok, t["gorev"], zorunlu)
            t["kapali"] = t["isaret"] or t["durum"] == "atıldı"
            yapraklar = [t]
        else:
            yapraklar = t["subtasklar"]
            n, al, at = len(yapraklar), sum(a["isaret"] for a in yapraklar), sum(a["durum"] == "atıldı" for a in yapraklar)
            t["isaret"] = al > 0 and al + at == n
            t["kapali"] = n > 0 and al + at == n
            t["durum"] = ("%d/%d subtask alındı%s" % (al, n, (" · %d atıldı" % at) if at else "")) if n \
                else "subtask bekliyor"
        yaprak += len(yapraklar)
        alinan += sum(y["isaret"] for y in yapraklar)
        atilan += sum(y["durum"] == "atıldı" for y in yapraklar)
    isaret = bool(tasklar) and all(t["kapali"] for t in tasklar) and any(t["isaret"] for t in tasklar)
    return {"isaret": isaret, "yaprak": yaprak, "alinan": alinan,
            "durum": "%d/%d iş alındı%s" % (alinan, yaprak, (" · %d atıldı" % atilan) if atilan else "")}


def oku(kok: pathlib.Path, ep: str) -> dict:
    """Epic'i okur: task ağacı, her düğümün türetilmiş işareti ve durumu."""
    anahtar = _epic_space(kok, ep)
    baslik, tasklar = _coz(_epic_yolu(kok, ep).read_text(encoding="utf-8"))
    return dict({"kimlik": ep, "baslik": baslik, "space": anahtar, "tasklar": tasklar}, **_turet(kok, tasklar))


def _space_oku(kok: pathlib.Path, anahtar: str) -> dict:
    metin = (_space_dizini(kok, anahtar) / "space.md").read_text(encoding="utf-8")
    ad = re.search(r"(?m)^# Space: (.*)$", metin)
    yollar = re.search(r"(?m)^Yollar: (.*)$", metin)
    return {"anahtar": anahtar, "ad": ad.group(1).strip() if ad else anahtar,
            "yollar": [y.strip() for y in (yollar.group(1) if yollar else "").split(",")
                       if y.strip() and not y.strip().startswith("(")]}


def hazir(kok: pathlib.Path, ep: str) -> list:
    """Şimdi koşturulabilecek yapraklar: koşmamış, kendi ve task'ının önkoşulları bitmiş olanlar."""
    tasklar = oku(kok, ep)["tasklar"]
    biten = {t["no"] for t in tasklar if t["isaret"]}
    sonuc = []
    for t in tasklar:
        if not set(t["once"]) <= biten:
            continue
        if t["gorev"]:
            if t["durum"] == "bekliyor":
                sonuc.append({"no": t["no"], "gorev": t["gorev"], "baslik": t["baslik"]})
            continue
        alinan = {a["no"] for a in t["subtasklar"] if a["isaret"]}
        sonuc += [{"no": a["no"], "gorev": a["gorev"], "baslik": a["baslik"]} for a in t["subtasklar"]
                  if a["durum"] == "bekliyor" and set(a["once"]) <= alinan]
    return sonuc


def onkosul_denetle(kok: pathlib.Path, d: dict) -> None:
    """Görevin yaprağı önkoşullarını bekliyorsa durdurur: önce task'ın, sonra subtask'ın önkoşulları."""
    no = str(d.get("adim") or "")
    tasklar = {t["no"]: t for t in oku(kok, d["plan"])["tasklar"]}
    t = tasklar.get(no.split(".")[0])
    if not t:
        return
    for o in t["once"]:
        if o in tasklar and not tasklar[o]["isaret"]:
            raise h.HarnessHata("%s koşturulamadı: %s içinde önce task %s tamamlanmalı (%s)"
                                % (d["kimlik"], d["plan"], o, tasklar[o]["durum"]))
    altlar = {a["no"]: a for a in t["subtasklar"]}
    for o in altlar.get(no, {}).get("once", []):
        if o in altlar and not altlar[o]["isaret"]:
            raise h.HarnessHata("%s koşturulamadı: %s içinde önce %s alınmalı (%s: %s)"
                                % (d["kimlik"], d["plan"], o, altlar[o]["gorev"], altlar[o]["durum"]))


# ── Yazma ────────────────────────────────────────────────────────────────────────────

def space(kok: pathlib.Path, ad: str, amac: str | None = None, yollar: list | None = None) -> pathlib.Path:
    """Bir özellik (feature) için space açar; anahtarı addan türer."""
    anahtar = h._slug(ad)
    if not anahtar:
        raise h.HarnessHata("space adı boş olamaz")
    dizin = _dizin(kok) / anahtar
    dizin.parent.mkdir(parents=True, exist_ok=True)
    try:
        dizin.mkdir()
    except FileExistsError:
        raise h.HarnessHata("space '%s' zaten var" % anahtar)
    yol = dizin / "space.md"
    yol.write_text(SPACE_SABLONU.format(ad=_temiz(ad), anahtar=anahtar, amac=amac or YERTUTUCU,
                                        yollar=", ".join(yollar or []) or "(verilmedi)",
                                        tarih=datetime.date.today().isoformat()), encoding="utf-8")
    return yol


def epic(kok: pathlib.Path, anahtar: str, baslik: str, hedef: str | None = None) -> pathlib.Path:
    """Space'in altında bir epic açar; kimliği depo çapında sıralıdır."""
    dizin = _space_dizini(kok, anahtar)
    sira = _dizin(kok) / "_epic"
    sira.mkdir(parents=True, exist_ok=True)
    n = max([int(p.name[3:]) for p in sira.glob("EP-*") if p.name[3:].isdigit()], default=0)
    while True:   # iki oturum aynı anda epic açarsa kimlik çakışmaz
        n += 1
        ep = "EP-%03d" % n
        try:
            with (sira / ep).open("x", encoding="utf-8") as f:
                f.write(anahtar + "\n")
            break
        except FileExistsError:
            continue
    yol = dizin / (ep + ".md")
    yol.write_text(EPIC_SABLONU.format(kimlik=ep, baslik=_temiz(baslik), anahtar=anahtar, hedef=hedef or YERTUTUCU,
                                       tarih=datetime.date.today().isoformat()), encoding="utf-8")
    _space_guncelle(kok, anahtar)
    return yol


def _yaprak_ac(kok, ep_bilgi, no, baslik, yer, rol, yollar, konular, hedef, olcut) -> str:
    sp = _space_oku(kok, ep_bilgi["space"])
    yollar = list(yollar or sp["yollar"])
    if not yollar:
        raise h.HarnessHata("%s %s için yol gerekli: `--yol <desen>` ver ya da space'e yol tanımla"
                            % (ep_bilgi["kimlik"], no))
    tam_yer = "%s (space) › %s %s (epic) › %s" % (sp["ad"], ep_bilgi["kimlik"], ep_bilgi["baslik"], yer)
    return gorev.yeni(kok, baslik, rol or "uygulayici", yollar, list(konular or []), hedef=hedef, olcut=olcut,
                      plan=ep_bilgi["kimlik"], adim=no, yer=tam_yer).parent.name


def task(kok: pathlib.Path, ep: str, baslik: str, rol: str | None = None, yollar: list | None = None,
         konular: list | None = None, once: list | None = None,
         hedef: str | None = None, olcut: str | None = None) -> tuple:
    """Epic'e task ekler: (task no, görev kimliği ya da None).

    Hedef ve ölçüt verilirse task yapraktır ve görev kartı açılır; verilmezse subtask'lara
    bölünecek bir kapsayıcıdır."""
    if bool(hedef) != bool(olcut):
        raise h.HarnessHata("task doğrudan koşturulacaksa hedef ve ölçüt birlikte verilir; "
                            "subtask'lara bölünecekse ikisi de verilmez")
    yol = _epic_yolu(kok, ep)
    bilgi = oku(kok, ep)
    baslik = _temiz(baslik)
    once = sorted({str(int(o)) for o in once or []}, key=int)
    olmayan = [o for o in once if o not in {t["no"] for t in bilgi["tasklar"]}]
    if olmayan:
        raise h.HarnessHata("%s içinde task %s yok; önkoşul olarak verilemez" % (ep, ", ".join(olmayan)))
    no = str(max([int(t["no"]) for t in bilgi["tasklar"]], default=0) + 1)
    kimlik = _yaprak_ac(kok, bilgi, no, baslik, "%s. %s (task)" % (no, baslik), rol, yollar, konular,
                        hedef, olcut) if hedef else None
    satirlar = yol.read_text(encoding="utf-8").split("\n")
    satirlar.insert(_bolum_sonu(satirlar, "Tasklar"), _task_satiri(
        {"isaret": False, "no": no, "baslik": baslik, "gorev": kimlik, "once": once,
         "durum": "bekliyor" if kimlik else "subtask bekliyor"}))
    _yaz(yol, "\n".join(satirlar).rstrip("\n") + "\n")
    guncelle(kok, ep)
    return no, kimlik


def subtask(kok: pathlib.Path, ep: str, task_no, baslik: str, rol: str | None = None,
            yollar: list | None = None, konular: list | None = None, once: list | None = None,
            hedef: str | None = None, olcut: str | None = None) -> tuple:
    """Task'ın altına subtask ekler ve görev kartını açar: (subtask no, görev kimliği)."""
    if not hedef or not olcut:
        raise h.HarnessHata("subtask koşturulan birimdir; hedef ve ölçüt zorunludur")
    task_no = str(int(task_no))
    bilgi = oku(kok, ep)
    t = next((x for x in bilgi["tasklar"] if x["no"] == task_no), None)
    if t is None:
        raise h.HarnessHata("%s içinde task %s yok" % (ep, task_no))
    if t["gorev"]:   # yaprak task bölünüyor: hiç koşmadıysa kendi görevi kapanır
        if gorev._json_oku(gorev._kayit(kok, t["gorev"]) / "durum.json").get("durum") != "taslak":
            raise h.HarnessHata("%s task %s koşturulmuş (%s); subtask'lara bölünemez. Yeni bir task aç."
                                % (ep, task_no, t["gorev"]))
        gorev.at(kok, t["gorev"])
    baslik = _temiz(baslik)
    once = ["%s.%s" % (task_no, str(o).split(".")[-1]) for o in once or []]
    olmayan = [o for o in once if o not in {a["no"] for a in t["subtasklar"]}]
    if olmayan:
        raise h.HarnessHata("%s içinde %s yok; önkoşul olarak verilemez" % (ep, ", ".join(olmayan)))
    no = "%s.%d" % (task_no, max([int(a["no"].split(".")[1]) for a in t["subtasklar"]], default=0) + 1)
    kimlik = _yaprak_ac(kok, bilgi, no, baslik, "%s. %s (task) › %s %s (subtask)" % (task_no, t["baslik"], no, baslik),
                        rol, yollar, konular, hedef, olcut)
    yol = _epic_yolu(kok, ep)
    satirlar = yol.read_text(encoding="utf-8").split("\n")
    yer = next(i for i, s in enumerate(satirlar) if (TASK.match(s) or [None] * 3)[2] == task_no)
    if t["gorev"]:   # task artık kapsayıcı: satırından görev kimliği düşer
        satirlar[yer] = _task_satiri(dict(t, gorev=None, isaret=False, durum="subtask bekliyor"))
    son = yer + 1
    while son < len(satirlar) and SUBTASK.match(satirlar[son]):
        son += 1
    satirlar.insert(son, _subtask_satiri({"isaret": False, "no": no, "baslik": baslik, "gorev": kimlik,
                                          "once": once, "durum": "bekliyor"}))
    _yaz(yol, "\n".join(satirlar).rstrip("\n") + "\n")
    guncelle(kok, ep)
    return no, kimlik


def _space_guncelle(kok: pathlib.Path, anahtar: str) -> None:
    """Space dosyasındaki epic listesini epiclerin türetilmiş durumundan yeniden yazar."""
    yol = _space_dizini(kok, anahtar) / "space.md"
    satirlar = [s for s in yol.read_text(encoding="utf-8").split("\n") if not EPIC_SATIRI.match(s)]
    yer = _bolum_sonu(satirlar, "Epicler")
    for ep in _epicler(kok, anahtar):
        e = oku(kok, ep)
        satirlar.insert(yer, "- [%s] %s — %s · %s" % (_kutu(e["isaret"]), ep, e["baslik"], e["durum"]))
        yer += 1
    _yaz(yol, "\n".join(satirlar).rstrip("\n") + "\n")


def guncelle(kok: pathlib.Path, ep: str) -> None:
    """Epic'in task ve subtask satırlarını görev kayıtlarından yeniden yazar; gerisine dokunmaz."""
    yol = _epic_yolu(kok, ep)
    metin = yol.read_text(encoding="utf-8")
    _, tasklar = _coz(metin)
    _turet(kok, tasklar)
    yeni = {t["no"]: _task_satiri(t) for t in tasklar}
    yeni.update({a["no"]: _subtask_satiri(a) for t in tasklar for a in t["subtasklar"]})
    satirlar = []
    for satir in metin.split("\n"):
        m = TASK.match(satir) or SUBTASK.match(satir)
        satirlar.append(yeni.get(m.group(2), satir) if m else satir)
    _yaz(yol, "\n".join(satirlar))
    _space_guncelle(kok, _epic_space(kok, ep))


# ── Yürütme ──────────────────────────────────────────────────────────────────────────

def _kesisir(a: list, b: list) -> bool:
    """İki yaprağın dosya desenleri aynı dosyaya düşebilir mi. Desenin joker öncesindeki sabit kısmına bakar:
    biri öbürünün başıysa kesişir sayılır (temkinli; yanlış "kesişir" yalnız yan yana koşuyu engeller)."""
    sabit = [re.split(r"[*?\[]", d, maxsplit=1)[0] for d in a], [re.split(r"[*?\[]", d, maxsplit=1)[0] for d in b]
    return not a or not b or any(x.startswith(y) or y.startswith(x) for x in sabit[0] for y in sabit[1])


def _kos_incele(kok: pathlib.Path, ep: str, y: dict, zorunlu: bool, bildir) -> tuple | None:
    """Bir yaprağı koşturur ve inceletir: temizse None, değilse (aşama, neden). Yan yana çağrılabilir."""
    kimlik = y["gorev"]
    bildir("%s %s (%s) — %s: işçi koşuyor" % (ep, y["no"], kimlik, y["baslik"]))
    try:
        rapor = gorev.kos(kok, kimlik)
    except h.HarnessHata as e:
        return "kosum", str(e)
    adlar = sorted({s["ad"] for s in rapor["sorunlar"]} | {u["ad"] for u in rapor.get("uyarilar") or []})
    if rapor["durum"] != "tamam" or adlar:
        return "kosum", ", ".join(adlar) or "işçi işi bitirmedi (%s)" % rapor["durum"]
    if zorunlu:
        bildir("%s %s (%s): inceleniyor" % (ep, y["no"], kimlik))
        inc = gorev.incele(kok, kimlik)
        if inc["sonuc"] != "gecti":
            ayrinti = sorted({s["ad"] for s in inc["sorunlar"]}) + [
                "%s:%s %s" % (b.get("dosya"), b.get("satir"), b.get("aciklama")) for b in inc["bulgular"]
                if b.get("onem") == "engel"] + ["%s uymuyor" % k.get("kimlik") for k in inc["kurallar"]
                                                if k.get("hukum") == "uymuyor"]
            return "inceleme", "inceleme %s: %s" % (
                "kaldı" if inc["sonuc"] == "kaldi" else "sorunlu", "; ".join(ayrinti) or "ayrıntı raporda")
    return None


def yurut(kok: pathlib.Path, ep: str, en_cok: int | None = None, bildir=None) -> dict:
    """Epic'in hazır yapraklarını yürütür: koştur → incelet → al. İlk sorunda durur.

    Kullanıcı bu komutu bir kez onaylar; yapraklar için ayrıca sorulmaz. Sorunlu, uyarılı ya da incelemede
    kalan iş alınmaz: yürütme orada durur ve nedeni döner; karar kullanıcınındır.
    `gorev.paralel` 1'den büyükse dosya desenleri kesişmeyen hazır yapraklar yan yana koşar ve incelenir;
    alma her zaman sırayladır (birleştirme aynı dala yapılır). Aynı turda temiz çıkan yaprak alınır, sorunlu
    olan durdurur."""
    bildir = bildir or (lambda _: None)
    zorunlu = _zorunlu(kok)
    paralel = max(1, int(h.ayar_oku(pathlib.Path(kok))["gorev"].get("paralel") or 1))
    alinan, duran = [], None
    while duran is None and (en_cok is None or len(alinan) < en_cok):
        hazirlar = hazir(kok, ep)
        if not hazirlar:
            break
        sinir = paralel if en_cok is None else min(paralel, en_cok - len(alinan))
        tur = []
        for y in hazirlar:
            yollar = gorev._durum_oku(kok, y["gorev"], gorev._kayit(kok, y["gorev"]))["yollar"]
            if len(tur) < sinir and not any(_kesisir(yollar, o["yollar"]) for o in tur):
                tur.append(dict(y, yollar=yollar))
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(tur)) as havuz:
            nedenler = list(havuz.map(lambda y: _kos_incele(kok, ep, y, zorunlu, bildir), tur))
        for y, neden in zip(tur, nedenler):
            if neden is None:
                try:
                    gorev.al(kok, y["gorev"])
                except h.HarnessHata as e:
                    neden = ("alma", str(e))
                else:
                    alinan.append(y["gorev"])
                    bildir("%s %s (%s): alındı" % (ep, y["no"], y["gorev"]))
            if neden is not None and duran is None:
                duran = {"no": y["no"], "gorev": y["gorev"], "baslik": y["baslik"], "asama": neden[0], "neden": neden[1]}
    return {"epic": ep, "alinan": alinan, "duran": duran, "kalan": [y["no"] for y in hazir(kok, ep)],
            "bitti": oku(kok, ep)["isaret"]}


def yurutme_ozeti(kok: pathlib.Path, ep: str) -> str:
    """Epic yürütülmeden önce kullanıcıya gösterilen özet: tek onay bunun içindir."""
    e = oku(kok, ep)
    g = h.ayar_oku(pathlib.Path(kok))["gorev"]
    bekleyen = [y for t in e["tasklar"] for y in ([t] if t["gorev"] else t["subtasklar"]) if y["durum"] == "bekliyor"]
    kum = ("kum havuzu açık (komutlar yalnız kendi ağacına ve geçici klasöre yazar)" if g.get("kum_havuzu", True)
           else "KUM HAVUZU KAPALI (komutlar diskin her yerine yazabilir)")
    adimlar = "işçi oturumu → inceleyici oturumu → bu dala birleştirme" if _zorunlu(kok) \
        else "işçi oturumu → bu dala birleştirme (inceleme kapalı)"
    if int(g.get("paralel") or 1) > 1:
        adimlar += "; dosyaları kesişmeyen en çok %s yaprak yan yana koşar, birleştirme sırayladır" % g["paralel"]
    return ("%s — %s (space: %s)\n%d yaprak koşturulacak; her biri sırayla: %s\n%s\n"
            "model: %s · yaprak başına en çok %s tur, %s sn%s\nizin modu: %s · %s\n"
            "Dal: %s. İlk sorunda durur ve sana döner; yapraklar için ayrıca sorulmaz."
            % (ep, e["baslik"], e["space"], len(bekleyen), adimlar,
               "\n".join("  %s %s (%s)" % (y["no"], y["baslik"], y["gorev"]) for y in bekleyen) or "  (bekleyen yaprak yok)",
               g["model"], g["max_tur"], g["zaman_asimi_sn"],
               (", oturum başına harcama tavanı %s USD" % g["butce_usd"]) if g.get("butce_usd") else "",
               g["izin_modu"], kum, h.dal_adi(pathlib.Path(kok)) or "?"))


# ── Özetler ──────────────────────────────────────────────────────────────────────────

def ozet_satiri(kok: pathlib.Path, ep: str) -> str:
    e = oku(kok, ep)
    siradaki = ", ".join("%s (%s)" % (y["no"], y["gorev"]) for y in hazir(kok, ep)) or "yok"
    return "%s/%s — %s: %s · şimdi koşturulabilir: %s" % (e["space"], ep, e["baslik"], e["durum"], siradaki)


def acik_planlar(kok: pathlib.Path) -> list:
    """Bitmemiş epiclerin özet satırları (oturum başında gösterilir)."""
    return [ozet_satiri(kok, ep) for ep in _epicler(kok) if not oku(kok, ep)["isaret"]]


def _agac_yaz(kok: pathlib.Path, ep: str) -> None:
    guncelle(kok, ep)
    print("  " + ozet_satiri(kok, ep))
    for t in oku(kok, ep)["tasklar"]:
        print("    " + _task_satiri(t)[2:])
        for a in t["subtasklar"]:
            print("      " + _subtask_satiri(a)[4:])


def komut(kok: pathlib.Path, arg: list) -> int:
    secenek = lambda ad: (h._secenek(arg, ad) or [None])[0]   # noqa: E731
    serbest = [a for i, a in enumerate(arg[1:], 1) if not a.startswith("--") and not arg[i - 1].startswith("--")]
    sayilar = lambda metin: re.findall(r"\d+", metin or "")   # noqa: E731
    if arg[:1] == ["space"] and serbest:
        yol = space(kok, " ".join(serbest), amac=secenek("--amac"), yollar=h._secenek(arg, "--yol"))
        print("space açıldı: %s (anahtar: %s)\nsıradaki: python3 harness/h.py plan epic %s \"<başlık>\" --hedef \"...\""
              % (yol, yol.parent.name, yol.parent.name))
        return 0
    if arg[:1] == ["epic"] and len(serbest) >= 2:
        yol = epic(kok, serbest[0], " ".join(serbest[1:]), hedef=secenek("--hedef"))
        print("epic açıldı: %s\nsıradaki: python3 harness/h.py plan task %s \"<başlık>\" ..." % (yol, yol.stem))
        return 0
    if arg[:1] == ["task"] and len(serbest) >= 2:
        no, kimlik = task(kok, serbest[0], " ".join(serbest[1:]), rol=secenek("--rol"),
                          yollar=h._secenek(arg, "--yol"), konular=h._secenek(arg, "--konu"),
                          once=sayilar(secenek("--once")), hedef=secenek("--hedef"), olcut=secenek("--olcut"))
        print("%s task %s eklendi: %s" % (serbest[0], no, ("görev %s\nsıradaki: python3 harness/h.py gorev kos %s"
              % (kimlik, kimlik)) if kimlik else "kapsayıcı; subtask ekle: python3 harness/h.py plan subtask %s %s "
              "\"<başlık>\" --hedef \"...\" --olcut \"...\"" % (serbest[0], no)))
        return 0
    if arg[:1] == ["subtask"] and len(serbest) >= 3:
        no, kimlik = subtask(kok, serbest[0], serbest[1], " ".join(serbest[2:]), rol=secenek("--rol"),
                             yollar=h._secenek(arg, "--yol"), konular=h._secenek(arg, "--konu"),
                             once=sayilar(secenek("--once")), hedef=secenek("--hedef"), olcut=secenek("--olcut"))
        print("%s subtask %s eklendi: görev %s\nsıradaki: python3 harness/h.py gorev kos %s"
              % (serbest[0], no, kimlik, kimlik))
        return 0
    if arg[:1] == ["yurut"] and serbest:
        en_cok = sayilar(secenek("--en-cok"))
        s = yurut(kok, serbest[0], en_cok=int(en_cok[0]) if en_cok else None,
                  bildir=lambda satir: print(satir, flush=True))
        print("%s: %d yaprak alındı%s" % (serbest[0], len(s["alinan"]), " · epic bitti" if s["bitti"] else ""))
        if s["duran"]:
            d = s["duran"]
            print("DURDU: %s %s (%s) — %s aşamasında: %s" % (serbest[0], d["no"], d["gorev"], d["asama"], d["neden"]))
            print("  rapor: python3 harness/h.py gorev durum · karar senin: yeniden koştur ya da `gorev at %s`" % d["gorev"])
        elif s["kalan"]:
            print("kalan hazır yapraklar: %s" % ", ".join(s["kalan"]))
        _agac_yaz(kok, serbest[0])
        return 1 if s["duran"] else 0
    if arg[:1] == ["durum"]:
        hedef = serbest[0] if serbest else None
        if hedef and hedef.startswith("EP-"):
            _agac_yaz(kok, hedef)
            return 0
        spaceler = [hedef] if hedef else _spaceler(kok)
        for anahtar in spaceler:
            sp = _space_oku(kok, anahtar)
            epicler = _epicler(kok, anahtar)
            biten = sum(oku(kok, e)["isaret"] for e in epicler)
            print("Space: %s (%s) — %d/%d epic tamam" % (sp["ad"], anahtar, biten, len(epicler)))
            for ep in epicler:
                _agac_yaz(kok, ep)
        if not spaceler:
            print("space yok; açmak için: python3 harness/h.py plan space \"<özellik adı>\" --yol <desen>")
        return 0
    raise h.HarnessHata(
        'kullanım: h.py plan <space "<ad>" [--amac "..."] [--yol Y]... | epic <space> "<başlık>" [--hedef "..."] | '
        'task EP-NNN "<başlık>" [--once 1,2] [--hedef "..." --olcut "..."] [--rol R] [--yol Y]... | '
        'subtask EP-NNN <task-no> "<başlık>" --hedef "..." --olcut "..." [--once 1,2] | '
        'yurut EP-NNN [--en-cok N] | durum [<space> | EP-NNN]>')
