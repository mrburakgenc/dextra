#!/usr/bin/env python3
"""ajan_hook.py — Claude Code hook'larının ortak mantığı.

Çağrı: hook.sh <olay>   (girdi: hook JSON'u stdin'de; çıktı: karar JSON'u stdout'ta)

  oturum-basi        SessionStart      durum özeti; sıkıştırma sonrası "gösterildi" kaydını sıfırlar
  istem              UserPromptSubmit  plan modunda tasarımcı paketini bir kez ekler
  duzenleme-oncesi   PreToolUse Edit|Write   korunan yollar, kabul yasağı, okundu kapısı; işçide geçen yolun kaydı
  duzenleme-sonrasi  PostToolUse Edit|Write  bilgi tabanı düğümü değiştiyse bulguları söyler
  komut-oncesi       PreToolUse Bash   yasak bayraklar, kabul, görev koşturma onayı, push kapısı
  ajan-dogarken      SubagentStart     rolün kesin paketini alt ajanın bağlamına ekler
  ajan-baslatma      PreToolUse Agent  görev başlığı ve güncel paket olmadan başlatmayı reddeder
  workflow-baslatma  PreToolUse Workflow  paketi script'e verdirir, yardımcı dışı ajan çağrısını reddeder
  durus              Stop              zincir kırmızıysa bir kez engeller; işçide bitiş kaydı ister

Hata politikası: hook oturumu kilitlemez; iç hatada geçirir. Tek istisna push ve görev koşturma:
orada iç hata reddetmektir. Son söz her zaman git hook'undadır.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import pathlib
import posixpath
import re
import shlex
import subprocess
import sys
import time

_BASLANGIC = time.monotonic()   # hook süresi buradan ölçülür: içe aktarmalar ve zinciri okumak dahil
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import h  # noqa: E402
import gorev  # noqa: E402
import plan  # noqa: E402

WORKFLOW_YARDIMCISI = (
    "const ajan = (rol, gorev, sec) =>\n"
    "  agent(args.kb_paket[rol] + \"\\n\\n\" + gorev, Object.assign({ agentType: rol }, sec || {}))")
OGRETICI = ("Öğretici mod açık: her tasarım seçiminde tekniğin adını, neyi kazandırıp neyi "
            "kaybettirdiğini ve alternatifini söyle. Tek yönlü kararların ilk taslağını kullanıcı "
            "yazar; sen eksik bölümü ve zayıf gerekçeyi göstererek çürütmeye çalışırsın.")
HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
PUSH = re.compile(r"\bgit\b[^|;&\n]*\bpush\b|\bgh\s+pr\s+(?:create|merge)\b")   # çözümlenemeyen komut için
KOMUT_AYIRICI = ";&|()\n`"
GIT_DEGERLI_SECENEK = ("-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix")
GH_DEGERLI_SECENEK = ("-R", "--repo")
KABUK = ("sh", "bash", "zsh", "dash")   # -c seçeneğinin değeri komuttur
YASAK_BAYRAK = re.compile(r"--no-verify\b|core\.hooksPath|include\.path")
# Hook yolunu yalnız okuyan tek biçim serbesttir; anahtarın geçtiği başka her komut (atama, silme, -c, alıntı)
# reddedilir. Dar tutulur: kapıyı gevşeten istisna, kapının kendisinden geniş olmamalı.
HOOK_YOLU_OKUMA = re.compile(r"\bgit(?:\s+-C\s+\S+)?\s+config(?:\s+--(?:local|global|system|worktree))?\s+--get(?:-all)?"
                             r"\s+(?:core\.hooksPath|include\.path)(?=[ \t]*(?:$|[;&|)]))", re.M)
KAPI_AYARI = ("harness.json", ".claude/settings.json", ".claude/settings.local.json")
# Git'in genel seçenekleri atlanır, ilk alt komuta bakılır: `git -C .. commit` de yakalanır, `git log --grep commit` yakalanmaz.
_GIT = r"\bgit(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?|-\w))*\s+"
GIT_YAZMA = re.compile(_GIT + r"(?:push|commit|merge|rebase|reset|checkout|switch|worktree|stash|tag|cherry-pick|revert|"
                              r"pull|am|update-ref|branch(?!\s*(?:$|[|;&\n]|--show-current|--list|-a\b|-r\b|-v|"
                              r"--contains|--merged|--no-merged)))\b")
TIRNAKLI = re.compile(r"'[^']*'|\"(?:[^\"\\]|\\.)*\"")
YONLENDIRME = re.compile(r"(?<![<>=\-])&?\d*>>?\s*([^\s|;&<>]+)")
GECICI_HEDEF = re.compile(r"^(?:&|/dev/null$|/dev/std|/tmp/|/private/tmp/|\$TMPDIR|\$\{TMPDIR\})")
YERINDE_DEGISTIREN = re.compile(r"\btee\b|\bsed\s+(?:-\S+\s+)*-i|\bperl\s+(?:-\S+\s+)*-\S*i\S*\b")
KABUL_KOMUTU = re.compile(r"h\.py[\"']?\s+kabul\b((?:[ \t]+[A-Z]{2}-\d{3,})*)")
# Bu izin modlarında onay sorusu gösterilmez (biri soruları atlar, öteki soru gerektiren her çağrıyı reddeder).
SORU_GOSTERMEYEN_MODLAR = ("bypassPermissions", "dontAsk")
GOREV_ISLEM = re.compile(r"h\.py[\"']?\s+gorev\s+(kos|incele|al|at|tazele|genislet)\s+(GV-\d+)")
GENISLET_YOLU = re.compile(r"--yol[ \t]+(\"[^\"]*\"|'[^']*'|[^\s;&|]+)")
PLAN_YURUT = re.compile(r"h\.py[\"']?\s+plan\s+yurut\s+(EP-\d+)")
GOREV_SORUSU = {"kos": "Bu görev ayrı bir oturumda, kendi çalışma ağacında koşturulacak",
                "incele": "Bu görev, işi yapmayan ikinci bir oturuma inceletilecek",
                "al": "Bu görevin işi birleştirilecek", "at": "Bu görevin işi silinecek",
                "tazele": "Bu görevin ağacı oturum dalının ucuna getirilecek",
                "genislet": "Bu görevin dosya listesi genişletilecek (kapsam genişletmek karardır)"}
KANIT = re.compile(r"\.harness/gorev/GV-\d+/(?:(?:durum|rapor|inceleme-rapor|bitis|inceleme)\.json|kosular\.jsonl)$")
PLAN_DOSYASI = re.compile(r"\.harness/plan/.+\.md$")
CD = re.compile(r"^\s*cd\s+(\"[^\"]+\"|'[^']+'|[^\s;&|]+)\s*(?:&&|;)")
ANA_AGAC_REDDI = ("Bu oturum ana çalışma ağacında. Her oturum kendi çalışma ağacında (worktree) çalışır: "
                  "EnterWorktree aracıyla kendi ağacına geç (ya da oturumu `claude --worktree <ad>` ile başlat) "
                  "ve düzenlemeyi orada yap. Görev kartı ve plan gibi ortak kayıtlar komutla yazılır: "
                  "`python3 harness/h.py gorev ...`, `python3 harness/h.py plan ...`.")
GOREV_BASLIGI = re.compile(r"(?m)^\[gorev\]\s*(.*)$")
URETILEN_YOLLAR = (".claude/rules/", ".claude/agents/")


# ── Yardımcılar ──────────────────────────────────────────────────────────────────────

def _karar(olay: str, karar: str, gerekce: str) -> dict:
    return {"hookSpecificOutput": {"hookEventName": olay, "permissionDecision": karar,
                                   "permissionDecisionReason": gerekce}}


def _red(gerekce: str) -> dict:
    return _karar("PreToolUse", "deny", "[harness] " + gerekce)


def _baglam(olay: str, metin: str) -> dict:
    return {"hookSpecificOutput": {"hookEventName": olay, "additionalContext": metin}}


def _kok(yol: str | None) -> pathlib.Path | None:
    try:
        return h.kok_bul(yol) if yol else None
    except h.HarnessHata:
        return None


def _oturum(kok: pathlib.Path, sid: str) -> tuple:
    yol = kok / ".harness" / "oturum" / (re.sub(r"[^A-Za-z0-9_.-]", "_", sid or "oturumsuz") + ".json")
    try:
        return yol, json.loads(yol.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return yol, {}


def _oturum_yaz(yol: pathlib.Path, veri: dict) -> None:
    yol.parent.mkdir(parents=True, exist_ok=True)
    yol.write_text(json.dumps(veri, ensure_ascii=False), encoding="utf-8")


def _deftere(kok: pathlib.Path, sid: str, kayit: dict) -> None:
    yol = kok / ".harness" / "defter" / (re.sub(r"[^A-Za-z0-9_.-]", "_", sid or "oturumsuz") + ".jsonl")
    yol.parent.mkdir(parents=True, exist_ok=True)
    kayit = dict({"zaman": datetime.datetime.now().isoformat(timespec="seconds")}, **kayit)
    with yol.open("a", encoding="utf-8") as f:
        f.write(json.dumps(kayit, ensure_ascii=False) + "\n")


def _komut_dizini(metin: str, cwd: str | None) -> str | None:
    """Komut `cd <yer> &&` ile başlıyorsa işin yapılacağı klasör orasıdır; kapı o depoya bakar."""
    m = CD.match(metin)
    if not m:
        return cwd
    hedef = pathlib.Path(os.path.expanduser(m.group(1).strip("\"'")))
    return str(hedef if hedef.is_absolute() else pathlib.Path(cwd or ".") / hedef)


def _dosyaya_yazar(metin: str) -> bool:
    """Komut bir dosyaya yazıyor mu: çıktı yönlendirmesi (geçici klasör dışına), tee, yerinde değiştirme.

    Sezgiseldir: tırnak içleri tek bir sözcük sayılır, başka yollar (bir betiğin kendi yazdığı dosya) görülmez.
    Kesin ölçü koşumdan sonraki git farkıdır; bu kapı işi düzenleme araçlarına yönlendirmek içindir."""
    duz = TIRNAKLI.sub("TIRNAK", metin)
    if YERINDE_DEGISTIREN.search(duz):
        return True
    return any(not GECICI_HEDEF.match(m.group(1)) for m in YONLENDIRME.finditer(duz))


def _kapi_ayari_mi(ayar: dict, goreli: str) -> bool:
    """Kapıların davranışını belirleyen dosya mı: harness ayarı, hook ayarı ya da projenin koruduğu denetim ayarı."""
    return goreli in KAPI_AYARI or any(h.desen_eslesir(d, goreli) for d in ayar.get("korunan_ayar") or [])


def _heredoc_at(metin: str) -> str:
    """Heredoc gövdeleri komut değil veridir (örnek: commit mesajı); taramadan önce atılır."""
    cikti, bekleyen = [], []
    for satir in metin.split("\n"):
        if bekleyen:
            if satir.strip() == bekleyen[0]:
                bekleyen.pop(0)
            continue
        cikti.append(satir)
        bekleyen = [m.group(2) for m in HEREDOC.finditer(satir)]
    return "\n".join(cikti)


def _yerine_koymalar(metin: str) -> list:
    """Tek tırnak dışındaki (tırnaksız ya da çift tırnaklı) komut yerine koyma gövdeleri: $( … ) ve ters tırnak.
    Kapanmamış gövde metnin sonuna dek sürer."""
    govdeler, i, tirnak = [], 0, None
    while i < len(metin):
        c = metin[i]
        if tirnak == "'":
            tirnak = None if c == "'" else tirnak
        elif c == "\\":
            i += 1
        elif c == '"':
            tirnak = None if tirnak else '"'
        elif c == "'" and not tirnak:
            tirnak = "'"
        elif c == "`":
            son = metin.find("`", i + 1)
            son = len(metin) if son < 0 else son
            govdeler.append(metin[i + 1:son])
            i = son
        elif metin.startswith("$(", i):
            son, derinlik = i + 2, 1
            while son < len(metin):
                derinlik += {"(": 1, ")": -1}.get(metin[son], 0)
                if not derinlik:
                    break
                son += 1
            govdeler.append(metin[i + 2:son])
            i = son
        i += 1
    return govdeler


def _alt_komutlar(sozcukler: list, degerli: tuple) -> list:
    """Seçenekler (değer alanlar değeriyle birlikte) atlanınca kalan sözcükler; ilki alt komuttur."""
    kalan, i = [], 0
    while i < len(sozcukler):
        if sozcukler[i].startswith("-"):
            i += 2 if sozcukler[i] in degerli else 1
        else:
            kalan.append(sozcukler[i])
            i += 1
    return kalan


def push_mu(metin: str) -> bool:
    """Komut gerçekten gönderiyor mu. Komut ayırıcılarla (; & | ve satır sonu, alt kabuk ayraçları, ters tırnak)
    parçalara, parçalar boşluğa göre kabuk sözcüklerine bölünür; tırnak içi metin tek sözcüktür, komut sayılmaz.
    Komutun konumuna bakılmaz: parçanın herhangi bir sözcüğünün dosya adı git ise ve ondan sonra git'in seçenekleri
    atlanınca gelen alt komut push ise, ya da dosya adı gh olan sözcükten sonra (seçenekler atlanarak) `pr create|merge`
    geliyorsa push'tur; böylece her sarmalayıcı (time, nice, xargs, sudo, if … then) kendiliğinden kapsanır.
    Kabukta çalışan iç metin aynı tanıyıcıya yeniden verilir: tek tırnak dışındaki $( … ) ve ters tırnak gövdeleri,
    sh/bash/zsh/dash için -c değeri ve eval'in bağımsız değişkenleri. Çözümlenemeyen komutta (kapanmamış tırnak,
    yorumdaki kesme işareti) sözcük desenine düşülür: kapı ölçemediğini geçirmez."""
    if any(push_mu(g) for g in _yerine_koymalar(metin)):
        return True
    lex = shlex.shlex(metin, posix=True, punctuation_chars=KOMUT_AYIRICI)
    lex.whitespace = " \t\r"   # satır sonu ayırıcıdır
    lex.whitespace_split = True   # sözcük yalnız boşlukta ve ayırıcıda biter ($REPO, a@b:c tek sözcük kalır)
    lex.commenters = ""        # shlex sözcük ortasındaki '#' işaretini de yorum sayar; kabuk saymaz
    try:
        sozcukler = list(lex)
    except ValueError:
        return bool(PUSH.search(metin))
    parca = []
    for s in sozcukler + [";"]:
        if not (s and all(c in KOMUT_AYIRICI for c in s)):
            parca.append(s)
            continue
        for i, sozcuk in enumerate(parca):
            ad, sonra = posixpath.basename(sozcuk), parca[i + 1:]
            if (ad == "git" and _alt_komutlar(sonra, GIT_DEGERLI_SECENEK)[:1] == ["push"]
                    or ad == "gh" and _alt_komutlar(sonra, GH_DEGERLI_SECENEK)[:2] in (["pr", "create"],
                                                                                        ["pr", "merge"])
                    or ad == "eval" and push_mu(" ".join(sonra))
                    or ad in KABUK and any(re.fullmatch(r"-[A-Za-z]*c[A-Za-z]*", secenek) and push_mu(deger)
                                           for secenek, deger in zip(sonra, sonra[1:]))):
                return True
        parca = []
    return False


def _kirmizilar(kok: pathlib.Path) -> list:
    eksik = h.kanarya()
    if eksik:
        raise h.HarnessHata("kapı kendi bozuk örneğinde şunları yakalayamadı: %s" % ", ".join(eksik))
    git_var = subprocess.run(["git", "rev-parse", "--verify", "--quiet", h.ayar_oku(kok)["taban_dal"]],
                             cwd=kok, capture_output=True).returncode == 0
    return [b for b in h.denetle(kok, taban=git_var) if b["seviye"] == "kirmizi"]


def _bulgu_metni(bulgular: list, sinir: int = 12) -> str:
    satirlar = ["[%s] %s %s — %s" % (b["kod"], b["ad"], b["yer"], b["mesaj"]) for b in bulgular[:sinir]]
    if len(bulgular) > sinir:
        satirlar.append("… ve %d bulgu daha: python3 harness/h.py denetle" % (len(bulgular) - sinir))
    return "\n".join(satirlar)


def _rol(ayar: dict, ajan_tipi: str | None) -> str:
    if ajan_tipi in ayar["ajan_rolleri"]:
        return ayar["ajan_rolleri"][ajan_tipi]
    return ajan_tipi if ajan_tipi in ayar["roller"] else "*"


# ── Olaylar ──────────────────────────────────────────────────────────────────────────

def oturum_basi(girdi: dict, ortam: dict) -> dict | None:
    kok = _kok(girdi.get("cwd"))
    if kok is None:
        return None
    yol, o = _oturum(kok, girdi.get("session_id", ""))
    if girdi.get("source") == "compact":   # bağlam sıkıştı: gösterilen kurallar artık bağlamda olmayabilir
        o.pop("gosterilen", None)
        o.pop("plan_paketi", None)
        _oturum_yaz(yol, o)
    dz = h.Dizin(kok)
    kurallar = dz.tur("kural")
    taslak = [d["kimlik"] for d in dz.dugumler if d["durum"] == "taslak"]
    kirmizi = [b for b in h.denetle(kok) if b["seviye"] == "kirmizi"]
    satirlar = ["[harness] %d kabul edilmiş kural (%d kesin), %d karar, %d yapı." % (
        len(kurallar), sum(k.get("kesinlik") == "kesin" for k in kurallar),
        len(dz.tur("karar")), len(dz.tur("yapi")))]
    tur = h.agac_turu(kok)
    if tur == "bagli":
        satirlar.append("Çalışma ağacı: %s · dal: %s." % (kok.name, h.dal_adi(kok) or "?"))
    elif tur == "ana" and h.commit_var(kok):
        if dz.ayar.get("oturum_agaci") == "zorunlu":
            satirlar.append("Bu oturum ana çalışma ağacında: burada düzenleme reddedilir. Her oturum kendi "
                            "çalışma ağacında çalışır; işe başlamadan EnterWorktree aracıyla kendi ağacına geç.")
    else:
        satirlar.append("Bu klasör git deposu değil ya da ilk commit atılmamış: oturum ağacı kuralı ve görev "
                        "koşturma çalışmaz (önce git init ve ilk commit).")
    try:
        satirlar += ["Açık epic: " + s for s in plan.acik_planlar(kok)]
    except (h.HarnessHata, OSError, ValueError):
        pass
    kosanlar = []
    for p in sorted(gorev._kayit(kok).glob("GV-*")):
        isaret = gorev.kosu_isareti(p)
        if isaret:
            kosanlar.append("%s %s" % (p.name, gorev.kosu_metni(isaret)))
    if kosanlar:
        satirlar.append("Koşan görev: %s." % ", ".join(kosanlar))
    if taslak:
        satirlar.append("Kabul bekleyen %d taslak: %s. Kabulü yalnız kullanıcı verir: kullanıcı isterse "
                        "`python3 harness/h.py kabul <KİMLİK>` çalıştırılır ve hook ona sorar."
                        % (len(taslak), ", ".join(taslak)))
    satirlar.append("Zincir temiz." if not kirmizi else
                    "Zincirde %d kırmızı bulgu var:\n%s" % (len(kirmizi), _bulgu_metni(kirmizi, 6)))
    if dz.ayar.get("ogretici"):
        satirlar.append(OGRETICI)
    return _baglam("SessionStart", "\n".join(satirlar))


def istem(girdi: dict, ortam: dict) -> dict | None:
    kok = _kok(girdi.get("cwd"))
    if kok is None or girdi.get("permission_mode") != "plan":
        return None
    yol, o = _oturum(kok, girdi.get("session_id", ""))
    if o.get("plan_paketi"):
        return None
    p = h.paket(kok, "tasarimci")
    if p["bos"]:
        return None
    o["plan_paketi"] = True
    _oturum_yaz(yol, o)
    _deftere(kok, girdi.get("session_id", ""), {"olay": "paket-verildi", "ajan": "ana", "rol": "tasarimci",
                                                "ozet": p["ozet"], "kurallar": p["kurallar"]})
    return _baglam("UserPromptSubmit", "Plan modu: tasarım protokolü harness/protokol/tasarim.md.\n\n" + p["metin"])


def _yeni_metinler(arac_girdisi: dict) -> str:
    parcalar = [str(arac_girdisi.get(a, "")) for a in ("content", "new_string", "new_source")]
    parcalar += [str(e.get("new_string", "")) for e in arac_girdisi.get("edits") or [] if isinstance(e, dict)]
    return "\n".join(parcalar)


def duzenleme_oncesi(girdi: dict, ortam: dict) -> dict | None:
    arac = girdi.get("tool_input") or {}
    dosya = arac.get("file_path") or arac.get("notebook_path")
    if not dosya:
        return None
    hedef = pathlib.Path(dosya)
    hedef = hedef if hedef.is_absolute() else pathlib.Path(girdi.get("cwd") or ".") / hedef
    kok = _kok(str(hedef.parent))
    if kok is None:
        return None
    goreli = hedef.resolve().relative_to(kok.resolve()).as_posix() \
        if str(hedef.resolve()).startswith(str(kok.resolve())) else None
    if goreli is None:
        return None
    isci = ortam.get("HARNESS_GOREV")
    if isci and ortam.get("HARNESS_ROL") == "inceleyici":   # inceleyici hiçbir şeyi değiştirmez
        if goreli == ".harness/gorev/%s/inceleme.json" % isci:
            return None
        return _red("%s inceleyicisi dosya değiştirmez; bulduğunu yalnız inceleme kaydına yazar: "
                    ".harness/gorev/%s/inceleme.json" % (isci, isci))
    if isci:   # ayrı oturumda koşan işçi: yalnız görevinin dosyaları ve kendi bitiş kaydı
        if goreli == ".harness/gorev/%s/bitis.json" % isci:
            return None
        if goreli.startswith(".harness/"):
            return _red("%s işçisi yerel durum klasörüne yazamaz; yalnız kendi bitiş kaydını yazar: "
                        ".harness/gorev/%s/bitis.json" % (isci, isci))
        if goreli.startswith("kb/"):
            return _red("%s işçisi bilgi tabanına yazamaz; kararını bitiş kaydında bildir." % isci)
        if _kapi_ayari_mi(h.ayar_oku(kok), goreli):
            return _red("%s görev oturumu kapıların ayarını değiştiremez: %s. Denetim işe engel oluyorsa bitiş "
                        "kaydına durumu 'soru' yaz." % (isci, goreli))
        if not gorev.sahiplik(kok, isci, goreli):
            return _red("%s görevinin dosyaları arasında değil: %s. Gerekliyse bitiş kaydına durumu "
                        "'soru' yaz ve dur." % (isci, goreli))
    elif KANIT.match(goreli):   # ölçümü araç üretir; elle yazılan kayıt kanıt olmaz
        return _red("Görevin ölçüm kayıtları elle yazılmaz; onları `python3 harness/h.py gorev ...` üretir. "
                    "Sonuç yanlışsa görevi yeniden koştur ya da incelet.")
    elif PLAN_DOSYASI.match(goreli):
        mevcut = set(hedef.read_text(encoding="utf-8").split("\n")) if hedef.is_file() else set()
        if any(s.lstrip().startswith("- [x]") and s not in mevcut for s in _yeni_metinler(arac).split("\n")):
            return _red("Plan işareti elle konmaz: yaprak, görevi koşup incelenip alınınca kendiliğinden "
                        "işaretlenir (`python3 harness/h.py gorev al GV-NNN`); task, epic ve space ondan türer.")
    if goreli.startswith(".harness/"):
        return None
    ayar = h.ayar_oku(kok)
    if ayar.get("oturum_agaci") == "zorunlu" and h.agac_turu(kok) == "ana" and h.commit_var(kok):
        return _red(ANA_AGAC_REDDI)
    if _kapi_ayari_mi(ayar, goreli) and not ayar.get("harness_gelistirme"):
        return _karar("PreToolUse", "ask", "[harness] %s kapıların ayarıdır (hook'lar, izinler, denetim). Denetimi "
                      "gevşetmek, kodu düzeltmekten kolaydır; bu değişikliği sen onayla." % goreli)
    if goreli.startswith(URETILEN_YOLLAR):
        return _red("%s üretilen bir dosya; kaynağı kb/ altında. Düğümü değiştir, sonra "
                    "`python3 harness/h.py uret`." % goreli)
    if goreli.startswith("harness/") and not ayar.get("harness_gelistirme"):
        return _red("harness/ klasörü projede düzenlenmez; iskelet deposunda değişir ve güncellenir.")
    if goreli == "kb/" + h.GUNLUK:
        return _red("Bilgi tabanı günlüğü elle yazılmaz ve satırı silinmez; kayıtları `python3 harness/h.py yeni` "
                    "ve `kabul` kendiliğinden ekler.")
    if goreli.startswith("kb/"):
        if girdi.get("agent_id"):
            return _red("Alt ajan bilgi tabanına yazamaz; tek yazar ana oturumdur. Önerini sonucunda bildir.")
        mevcut = hedef.read_text(encoding="utf-8") if hedef.is_file() else ""
        if re.search(r"(?m)^durum: kabul\s*$", _yeni_metinler(arac)) and not re.search(
                r"(?m)^durum: kabul\s*$", mevcut):
            return _red("Bir düğümü kabul durumuna yalnız kullanıcı getirir; dosyada durumu elle çevirme. Taslak "
                        "olarak bırak, kullanıcıya özetle ve `python3 harness/h.py kabul <KİMLİK>` çalıştır: "
                        "hook kullanıcıya sorar, onaylarsa düğüm kabul edilir.")
    # Okundu kapısı: bu dosyaya düşen yapı ve kurallar bu aktöre gösterildi mi?
    dz = h.Dizin(kok)
    yapi = dz.yapi_bul(goreli)
    kurallar = [k for k in dz.tur("kural") if not dz.her_yerde_mi(k) and dz.yola_duser(k, goreli)]
    ogeler = ([yapi] if yapi else []) + kurallar
    if not ogeler:
        return None
    sid, aktor = girdi.get("session_id", ""), girdi.get("agent_id") or "ana"
    yol, o = _oturum(kok, sid)
    gosterilen = set(o.setdefault("gosterilen", {}).get(aktor, []))
    eksik = [d for d in ogeler if "%s@%s" % (d["kimlik"], d["surum"]) not in gosterilen]
    if not eksik:
        return None
    o["gosterilen"][aktor] = sorted(gosterilen | {"%s@%s" % (d["kimlik"], d["surum"]) for d in eksik})
    _oturum_yaz(yol, o)
    _deftere(kok, sid, {"olay": "gosterildi", "ajan": aktor, "dosya": goreli,
                        "kurallar": ["%s@%s" % (d["kimlik"], d["surum"]) for d in eksik]})
    satirlar = ["%s için %d kayıt bu oturumda henüz gösterilmedi. Oku, sonra düzenlemeyi yeniden dene."
                % (goreli, len(eksik)), ""]
    for d in eksik:
        if d["tur"] == "yapi":
            satirlar.append("%s@%s %s — %s%s" % (
                d["kimlik"], d["surum"], d["baslik"], d["_ifade"],
                (" Bağımlı olabileceği yapılar: %s." % ", ".join(h.liste(d, "bagimli")))
                if h.liste(d, "bagimli") else ""))
        else:
            satirlar.append(h._kural_satiri(d))
    satirlar += ["", "Ayrıntı: python3 harness/h.py sor %s" % goreli]
    return _red("\n".join(satirlar))


def duzenleme_kapisi(girdi: dict, ortam: dict) -> dict | None:
    """Düzenleme kapısı. İşçi oturumunda kapının geçirdiği yol görevin kaydına yazılır; koşu sonunda bu kayıtta
    olmayan değişen dosya 'kapı dışı yazım' sayılır (gorev.kapi_disi)."""
    karar = duzenleme_oncesi(girdi, ortam)
    arac, isci = girdi.get("tool_input") or {}, ortam.get("HARNESS_GOREV")
    dosya = arac.get("file_path") or arac.get("notebook_path")
    if karar is None and isci and dosya:
        hedef = (pathlib.Path(girdi.get("cwd") or ".") / dosya).resolve()   # mutlak yol birleştirmede korunur
        kok = _kok(str(hedef.parent))
        if kok is not None and hedef.is_relative_to(kok.resolve()):
            gorev.kapidan_gecti(kok, isci, hedef.relative_to(kok.resolve()).as_posix())
    return karar


def duzenleme_sonrasi(girdi: dict, ortam: dict) -> dict | None:
    dosya = (girdi.get("tool_input") or {}).get("file_path")
    kok = _kok(str(pathlib.Path(dosya).parent)) if dosya else None
    if kok is None:
        return None
    goreli = pathlib.Path(dosya).resolve().relative_to(kok.resolve()).as_posix()
    if not goreli.startswith("kb/"):
        return None
    m = h.DOSYA_ADI.match(pathlib.Path(dosya).name)
    kimlik = m.group(1) if m else ""
    ilgili = [b for b in h.denetle(kok) if b["yer"] == kimlik or b["yer"].startswith(goreli)
              or b["ad"] == "bayat-uretim"]
    if not ilgili:
        return None
    return _baglam("PostToolUse", "[harness] %s için bulgular:\n%s" % (goreli, _bulgu_metni(ilgili)))


def _kabul_sorusu(girdi: dict, ortam: dict, metin: str) -> dict:
    """Kabul komutunu ajan çalıştırır, kararı kullanıcı verir: kapı düğümü gösterip sorar, onay kaydını bırakır."""
    if ortam.get("HARNESS_GOREV") or girdi.get("agent_id"):
        return _red("Kabulü yalnız kullanıcı verir; görev oturumu ve alt ajan kabul komutunu çalıştıramaz. "
                    "Taslağı bırak ve bildir; soruyu ana oturum kullanıcıya sordurur.")
    mod = girdi.get("permission_mode")
    if mod in SORU_GOSTERMEYEN_MODLAR:
        return _red("Kabul kullanıcının onayını ister, ama bu izin modunda (%s) onay sorusu gösterilmez. İzin modu "
                    "değiştirilir ya da komutu kullanıcı kendi terminalinde çalıştırır: "
                    "`python3 harness/h.py kabul <KİMLİK>`." % mod)
    cagrilar = KABUL_KOMUTU.findall(metin)
    kimlikler = h.kabul_sirasi(" ".join(cagrilar).split())
    if len(cagrilar) != 1 or not kimlikler:
        return _red("Kabul tek çağrıda ve kimlikleriyle istenir; karar ile kuralları birlikte verilebilir: "
                    "`python3 harness/h.py kabul KR-004 KU-007 KU-008`.")
    kok = _kok(_komut_dizini(metin, girdi.get("cwd"))) or _kok(girdi.get("cwd"))
    if kok is None:
        return _red("Kabul sorulamadı: bu klasörde harness.json yok.")
    dz, satirlar = h.Dizin(kok), []
    for kimlik in kimlikler:
        d = dz.kimlik.get(kimlik)
        if d is None:
            return _red("%s bulunamadı; kabul sorulmadı." % kimlik)
        if d["durum"] != "taslak":
            return _red("%s taslak değil (durum: %s); kabul sorulmadı." % (kimlik, d["durum"]))
        satirlar += ["%s@%s %s — %s" % (kimlik, d["surum"], d["tur"], d["baslik"]), "  " + d["_ifade"],
                     "  dosya: " + d["_yol"]]
    h.onay_yaz(kok, kimlikler)
    return _karar("PreToolUse", "ask", "[harness] Onaylarsan şu taslaklar kabul edilir ve bağlayıcı olur:\n"
                  + "\n".join(satirlar))


def komut_oncesi(girdi: dict, ortam: dict) -> dict | None:
    metin = _heredoc_at(str((girdi.get("tool_input") or {}).get("command", "")))
    if YASAK_BAYRAK.search(HOOK_YOLU_OKUMA.sub(" ", metin)):
        return _red("--no-verify ve hook yolunu değiştiren bayraklar kullanılmaz; kapı kırmızıysa düzeltilir. "
                    "Hook yolunu yalnız görmek için: `git config --get core.hooksPath`.")
    if KABUL_KOMUTU.search(metin):
        return _kabul_sorusu(girdi, ortam, metin)
    if ortam.get("HARNESS_GOREV") and _dosyaya_yazar(metin):
        return _red("Görev oturumu dosyayı komutla yazmaz: dosya yalnız Write ya da Edit aracıyla yazılır, çünkü "
                    "kural ve kapsam kapıları oradadır. Komutun geçici çıktısı gerekiyorsa $TMPDIR altına yönlendir.")
    if ortam.get("HARNESS_GOREV") and GIT_YAZMA.search(metin):
        return _red("Görev oturumu git geçmişine dokunmaz: commit, dal, birleştirme ve push yok. Değişikliği "
                    "çalışma ağacında bırak; commit ve birleştirmeyi orchestrator yapar.")
    kok = _kok(_komut_dizini(metin, girdi.get("cwd"))) or _kok(girdi.get("cwd"))
    yurutme, m = PLAN_YURUT.search(metin), GOREV_ISLEM.search(metin)
    if yurutme or m:
        if ortam.get("HARNESS_GOREV"):
            return _red("Görev oturumu başka bir görev işlemi başlatamaz; gerekiyorsa kendi kaydında bildir.")
        if kok is None:
            return None
        # Ne kadar sorulacağını kullanıcı seçer: "baslangic" (varsayılan), "her-adim", "yok". Atma her zaman sorulur.
        onay = h.ayar_oku(kok)["gorev"].get("onay", "baslangic")
        if yurutme:
            if onay == "yok":
                return None
            return _karar("PreToolUse", "ask", "[harness] Bu epic baştan sona yürütülecek:\n"
                          + plan.yurutme_ozeti(kok, yurutme.group(1)))
        islem = m.group(1)
        if not (islem == "at" or onay == "her-adim" or (onay == "baslangic" and islem in ("kos", "al", "genislet"))):
            return None
        # yalnız bu komutun kendi --yol'ları (zincirdeki başka komutunki değil); h.py '--yol=desen' biçimini okumaz
        ekler = ([y.strip("\"'") for y in GENISLET_YOLU.findall(re.split(r"[;&|\n]", metin[m.end():], 1)[0])]
                 if islem == "genislet" else None)
        return _karar("PreToolUse", "ask", "[harness] %s:\n%s"
                      % (GOREV_SORUSU[islem], gorev.ozet(kok, m.group(2), islem, ekler)))
    if kok is not None and push_mu(metin):
        kirmizi = _kirmizilar(kok)
        if kirmizi:
            return _red("Zincir kırmızı; push ve PR durduruldu:\n" + _bulgu_metni(kirmizi))
    return None


def ajan_dogarken(girdi: dict, ortam: dict) -> dict | None:
    kok = _kok(girdi.get("cwd"))
    if kok is None:
        return None
    rol = _rol(h.ayar_oku(kok), girdi.get("agent_type"))
    p = h.paket(kok, rol)
    if p["bos"]:
        return None
    _deftere(kok, girdi.get("session_id", ""), {
        "olay": "paket-verildi", "ajan": girdi.get("agent_id") or "?", "tip": girdi.get("agent_type"),
        "rol": rol, "ozet": p["ozet"], "kurallar": p["kurallar"], "kanal": "baslangic"})
    return _baglam("SubagentStart", p["metin"])


def _baslik_coz(prompt: str) -> dict | None:
    m = GOREV_BASLIGI.search(prompt)
    if not m:
        return None
    alanlar = dict(parca.split("=", 1) for parca in m.group(1).split() if "=" in parca)
    return {"rol": alanlar.get("rol"), "yollar": [y for y in alanlar.get("yol", "").split(",") if y],
            "konular": [k for k in alanlar.get("konu", "").split(",") if k]}


def ajan_baslatma(girdi: dict, ortam: dict) -> dict | None:
    kok = _kok(girdi.get("cwd"))
    if kok is None:
        return None
    arac = girdi.get("tool_input") or {}
    prompt = str(arac.get("prompt", ""))
    ayar = h.ayar_oku(kok)
    baslik = _baslik_coz(prompt)
    rol = (baslik or {}).get("rol") or _rol(ayar, arac.get("subagent_type"))
    if baslik is None and rol == "kesif":
        return None   # salt-okuma keşif: kesin kurallarını başlangıç hook'undan alır
    rol = "uygulayici" if rol == "*" and "uygulayici" in ayar["roller"] else rol
    beklenen = h.paket(kok, rol, (baslik or {}).get("yollar", []), (baslik or {}).get("konular", []))
    if beklenen["bos"]:
        return None
    if baslik is not None and h.paket_ozeti_dogrula(prompt) == beklenen["ozet"]:
        _deftere(kok, girdi.get("session_id", ""), {"olay": "paket-verildi", "ajan": "(başlatılıyor)",
                                                    "rol": rol, "ozet": beklenen["ozet"],
                                                    "kurallar": beklenen["kurallar"], "kanal": "gorev"})
        return None
    return _red("Bu ajan güncel kural paketi olmadan başlatılamaz. Görev metninin başına şu iki parçayı "
                "aynen koy ve yeniden başlat:\n\n[gorev] rol=%s%s\n\n%s\n\n(Dosya ve konu biliniyorsa "
                "başlığa `yol=a/**,b/x.ts konu=...` ekle ve paketi `python3 harness/h.py paket --rol %s "
                "--yol ... --konu ...` ile al.)"
                % (rol, (" yol=" + ",".join(baslik["yollar"])) if baslik and baslik["yollar"] else "",
                   beklenen["metin"], rol))


def workflow_baslatma(girdi: dict, ortam: dict) -> dict | None:
    kok = _kok(girdi.get("cwd"))
    if kok is None:
        return None
    ayar = h.ayar_oku(kok)
    arac = girdi.get("tool_input") or {}
    script, args = arac.get("script"), arac.get("args") if isinstance(arac.get("args"), dict) else {}
    gorev_beyani = args.get("kb_gorev") if isinstance(args.get("kb_gorev"), dict) else {}
    yollar, konular = gorev_beyani.get("yol") or [], gorev_beyani.get("konu") or []
    beklenen = {rol: h.paket(kok, rol, yollar, konular) for rol in ayar["roller"]}
    if all(p["bos"] for p in beklenen.values()):
        return None
    if not isinstance(script, str):
        return _karar("PreToolUse", "ask", "[harness] Bu workflow kayıtlı bir script'ten koşuyor; içeriği "
                      "denetlenemedi. Kesin kuralların her ajana verildiğinden emin misin?")
    sorunlar = []
    if WORKFLOW_YARDIMCISI not in script:
        sorunlar.append("script harness yardımcısını aynen içermiyor")
    elif len(re.findall(r"\bagent\s*\(", script)) != 1:
        sorunlar.append("script'te yardımcının dışında `agent(` çağrısı var; her ajan `ajan(rol, gorev)` ile başlatılmalı")
    paketler = args.get("kb_paket") if isinstance(args.get("kb_paket"), dict) else {}
    kullanilan = set(re.findall(r"\bajan\(\s*['\"]([\w-]+)['\"]", script)) or set(paketler)
    for rol in sorted(kullanilan):
        if rol not in beklenen:
            sorunlar.append("rol '%s' harness.json roller listesinde yok" % rol)
        elif not beklenen[rol]["bos"] and h.paket_ozeti_dogrula(str(paketler.get(rol, ""))) != beklenen[rol]["ozet"]:
            sorunlar.append("args.kb_paket.%s yok ya da güncel değil" % rol)
    if not sorunlar:
        _deftere(kok, girdi.get("session_id", ""), {
            "olay": "paket-verildi", "ajan": "(workflow)", "kanal": "workflow",
            "roller": sorted(kullanilan), "ozet": {r: beklenen[r]["ozet"] for r in sorted(kullanilan)}})
        return None
    ornek = {"kb_gorev": {"yol": yollar, "konu": konular},
             "kb_paket": {r: beklenen[r]["metin"] for r in sorted(kullanilan & set(beklenen)) or ["uygulayici"]
                          if r in beklenen}}
    return _red("Workflow kesin kurallar her ajana verilmeden başlatılamaz:\n- " + "\n- ".join(sorunlar)
                + "\n\nScript'in başına şu yardımcıyı aynen koy ve ajanları yalnız onunla başlat:\n\n"
                + WORKFLOW_YARDIMCISI + "\n\nWorkflow `args` değeri:\n" + json.dumps(ornek, ensure_ascii=False, indent=2))


def durus(girdi: dict, ortam: dict) -> dict | None:
    if girdi.get("stop_hook_active"):
        return None
    kok = _kok(girdi.get("cwd"))
    if kok is None:
        return None
    isci = ortam.get("HARNESS_GOREV")
    if isci:
        inceleyici = ortam.get("HARNESS_ROL") == "inceleyici"
        sorunlar = gorev.inceleme_dogrula(kok, isci) if inceleyici else gorev.bitis_dogrula(kok, isci)
        if sorunlar:
            return {"decision": "block", "reason": "[harness] %s eksik: .harness/gorev/%s/%s\n%s" % (
                "İnceleme kaydı" if inceleyici else "Bitiş kaydı", isci,
                "inceleme.json" if inceleyici else "bitis.json", "\n".join("- " + s["mesaj"] for s in sorunlar))}
        return None
    kirmizi = [b for b in h.denetle(kok) if b["seviye"] == "kirmizi"]
    yol, o = _oturum(kok, girdi.get("session_id", ""))
    imza = hashlib.sha256(json.dumps(sorted((b["kod"], b["ad"], b["yer"]) for b in kirmizi)).encode()).hexdigest() \
        if kirmizi else ""
    if o.get("son_kirmizi", "") == imza:
        return None   # aynı durum bu oturumda zaten söylendi
    o["son_kirmizi"] = imza
    _oturum_yaz(yol, o)
    if not kirmizi:
        return None
    return {"decision": "block", "reason": "[harness] Zincir kırmızı. Düzelt ya da neden düzeltilemediğini "
            "kullanıcıya söyle:\n" + _bulgu_metni(kirmizi)}


OLAYLAR = {"oturum-basi": oturum_basi, "istem": istem, "duzenleme-oncesi": duzenleme_kapisi,
           "duzenleme-sonrasi": duzenleme_sonrasi, "komut-oncesi": komut_oncesi,
           "ajan-dogarken": ajan_dogarken, "ajan-baslatma": ajan_baslatma,
           "workflow-baslatma": workflow_baslatma, "durus": durus}


def isle(olay: str, girdi: dict, ortam: dict) -> dict | None:
    islev = OLAYLAR.get(olay)
    return islev(girdi, ortam) if islev else None


def guvenli_isle(olay: str, girdi: dict, ortam: dict) -> dict | None:
    """İç hatada geçirir; push ve görev koşturmada iç hata reddetmektir."""
    try:
        return isle(olay, girdi, ortam)
    except Exception as hata:  # noqa: BLE001 — hook oturumu asla kilitlememeli
        metin = _heredoc_at(str((girdi.get("tool_input") or {}).get("command", "")))
        try:
            kok = _kok(girdi.get("cwd"))
            if kok is not None:
                gunluk = kok / ".harness" / "hook-hata.log"
                gunluk.parent.mkdir(parents=True, exist_ok=True)
                with gunluk.open("a", encoding="utf-8") as f:
                    f.write("%s %s %s: %s\n" % (datetime.datetime.now().isoformat(timespec="seconds"),
                                                olay, type(hata).__name__, hata))
        except OSError:
            pass
        if olay == "komut-oncesi" and (push_mu(metin) or GOREV_ISLEM.search(metin) or PLAN_YURUT.search(metin)):
            return _red("Kapı ölçülemedi (%s: %s); doğrulanamayan push ve görev koşturma durdurulur."
                        % (type(hata).__name__, hata))
        return None


def yetkili_betik(girdi: dict, gelistirme: bool | None = None) -> pathlib.Path | None:
    """Bu çağrıyı başka bir ağacın kendi hook betiği mi karşılamalı?

    Hook'u oturumun açıldığı ağaçtaki kod çalıştırır, ama iş başka bir çalışma ağacında yürüyebilir.
    İskeletin kendi deposunda (harness burada gelişir) iki ağacın harness kodu farklı olabilir; eski kod yeni
    dosyaları yanlış yere kırmızı sayar. O yüzden orada her ağaç kendi koduyla denetlenir. Projede harness
    değişmez ve yargıç oturumun açıldığı ağacın kodu olarak kalır: bir ağaç kendi kapısını gevşetemez."""
    kendi = pathlib.Path(__file__).resolve()
    if gelistirme is None:
        try:
            gelistirme = bool(h.ayar_oku(kendi.parents[2]).get("harness_gelistirme"))
        except h.HarnessHata:
            gelistirme = False
    kok = _kok(girdi.get("cwd")) if gelistirme else None
    if kok is None:
        return None
    aday = kok / "harness" / "hook" / "ajan_hook.py"
    try:
        return aday if aday.is_file() and not aday.samefile(kendi) else None
    except OSError:
        return None


def sure_kaydet(kok: pathlib.Path, olay: str, sid: str, ms: int) -> None:
    """Eşiği aşan hook çağrısını deftere yazar. Bu sayı, dizini hook yoluna almanın tetiğidir (tasarım 12.2)."""
    if ms >= h.ayar_oku(kok)["butce"].get("hook_ms", 300):
        _deftere(kok, sid, {"olay": "yavas-hook", "ad": olay, "ms": ms})


def main() -> int:
    olay = sys.argv[1] if len(sys.argv) > 1 else ""
    ham = sys.stdin.read() or "{}"
    try:
        girdi = json.loads(ham)
    except ValueError:
        girdi = {}
    if not isinstance(girdi, dict):
        girdi = {}
    try:
        return _calistir(olay, ham, girdi)
    finally:
        if not os.environ.get("HARNESS_HOOK_DEVIR"):   # devralan koşumun süresi, devredenin ölçtüğünün içindedir
            try:
                kok = _kok(girdi.get("cwd"))
                if kok is not None:
                    sure_kaydet(kok, olay, girdi.get("session_id", ""), int((time.monotonic() - _BASLANGIC) * 1000))
            except Exception:  # noqa: BLE001 — ölçüm hook'u asla düşürmez
                pass


def _calistir(olay: str, ham: str, girdi: dict) -> int:
    if not os.environ.get("HARNESS_HOOK_DEVIR"):
        betik = yetkili_betik(girdi)
        if betik is not None:   # işin yürüdüğü ağacın kendi kodu karar verir
            try:
                r = subprocess.run([sys.executable, str(betik), olay], input=ham, text=True, capture_output=True,
                                   env=dict(os.environ, HARNESS_HOOK_DEVIR="1", PYTHONDONTWRITEBYTECODE="1"),
                                   timeout=25)
                sys.stdout.write(r.stdout)
                return 0
            except (OSError, subprocess.SubprocessError):
                pass   # devredilemedi: bu kod karar verir
    cikti = guvenli_isle(olay, girdi, dict(os.environ))
    if cikti:
        sys.stdout.write(json.dumps(cikti, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
