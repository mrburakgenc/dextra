#!/usr/bin/env python3
"""Kapılar (TS-006 Yapı 12): push deseni, commit edilmiş rapor ve kapı dışı yazımın tespiti.

Koşum: python3 harness/test/test_kapi.py
Her test geçici bir depo kurar; gerçek bilgi tabanına ve gerçek görev kayıtlarına dokunmaz.
"""
from __future__ import annotations

import contextlib
import io
import os
import pathlib
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import gorev  # noqa: E402
import ajan_hook  # noqa: E402
import plan  # noqa: E402
import rapor  # noqa: E402
from test_h import KURAL, depo, git, git_depo  # noqa: E402
from test_hook import karar, komut  # noqa: E402
from test_rapor import DOLU, bolum_doldur, cli, dal_depo, gorev_durumu, kayit  # noqa: E402

# ── a, b) Push deseni ────────────────────────────────────────────────────────────────

PUSH = ("git push origin dal",                    # düz gönderme
        "GIT_TRACE=1 GIT_SSH_COMMAND=ssh git push",  # ortam ataması önekli
        "git -C ../baska push origin dal",         # -C seçenekli
        "git status && git push",                 # zincirin ikinci parçası
        "gh pr create --fill",
        "gh pr merge 12 --squash")
PUSH_DEGIL = ("cat harness/hook/git/pre-push",      # içinde git klasörü ve pre-push dosya adı geçen okuma
              "echo 'git push'",                    # tırnak içinde
              "git log --oneline --grep push",      # git log ile push sözcüğü aranır
              "docker push ornek/imaj")             # başka bir aracın push alt komutu


def kirmizi_depo():
    """Zinciri kırmızı depo: push kapısı push sayılan komutu reddeder, sayılmayanı geçirir."""
    return depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("dayanak: [KR-001@1]\n", "")})


class PushDeseni(unittest.TestCase):
    def test_gonderen_komut_push_sayilir_ve_kirmizi_zincirde_reddedilir(self):
        kok = kirmizi_depo()
        for metin in PUSH:
            self.assertTrue(ajan_hook.push_mu(metin), metin)
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)

    def test_sozcuk_olarak_git_ve_push_gecen_komut_push_sayilmaz(self):
        kok = kirmizi_depo()
        for metin in PUSH_DEGIL:
            self.assertFalse(ajan_hook.push_mu(metin), metin)
            self.assertIsNone(komut(kok, metin), metin)

    def test_bosluga_gore_bolunur_degiskenli_ve_at_isaretli_secenek_degeri_tek_sozcuktur(self):
        kok = kirmizi_depo()
        for metin in ("git -C $REPO push", "git -c user.email=a@b push", "git -C ${KOK}/alt:x push origin dal"):
            self.assertTrue(ajan_hook.push_mu(metin), metin)
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)
        for metin in ("git -C $REPO log --grep push", "git -c user.email=a@b status"):
            self.assertFalse(ajan_hook.push_mu(metin), metin)
            self.assertIsNone(komut(kok, metin), metin)

    def test_onek_komutu_kabuk_sozcugu_ve_tam_yolla_gonderme_push_sayilir(self):
        kok = kirmizi_depo()
        for metin in ("command gh pr merge 3", "time gh pr merge 3", "/opt/homebrew/bin/gh pr merge 3",
                      "if gh pr merge 3; then :; fi", "{ git push; }", "! git push", "nohup git push &",
                      "exec git push", "env -i A=1 git push", "sudo -u kok git push", "timeout 30 git push",
                      "timeout -s KILL 30 git push", "echo `git push`", "x=$(gh pr create --fill)",
                      "/usr/bin/git push"):
            self.assertTrue(ajan_hook.push_mu(metin), metin)
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)
        for metin in ("time git status", "timeout 30 docker push ornek/imaj", "env git log --grep push",
                      "if test -f push; then echo git; fi", "command -v git", "/opt/homebrew/bin/gh pr list"):
            self.assertFalse(ajan_hook.push_mu(metin), metin)
            self.assertIsNone(komut(kok, metin), metin)

    def test_kabukta_calisan_ic_metin_ve_her_sarmalayici_push_sayilir(self):
        kok = kirmizi_depo()
        for metin in ('url="$(gh pr create --fill)"', 'echo "$(git push 2>&1)"', 'echo "`git push`"',
                      "sh -c 'git push'", 'bash -lc "gh pr merge 3"', "zsh -c 'cd x && git push'",
                      "eval 'git push'", "eval git push", "echo x | xargs git push", "nice -n 5 git push",
                      "watch git push", "caffeinate git push", "find . -name x -exec git push \\;",
                      "/opt/homebrew/bin/gh pr create", "if true; then git push; fi", "gh -R o/r pr merge 3",
                      "echo \"a $(echo \"$(git push)\") b\""):
            self.assertTrue(ajan_hook.push_mu(metin), metin)
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)
        for metin in ("echo '$(git push)'", "echo '`git push`'", 'echo "git push"', "sh -c 'git status'",
                      "bash script.sh", "eval echo push", "echo x | xargs git log --grep push",
                      "nice -n 5 git status", 'x="$(git log --grep push)"', "gh -R o/r pr list"):
            self.assertFalse(ajan_hook.push_mu(metin), metin)
            self.assertIsNone(komut(kok, metin), metin)

    def test_cozumlenemeyen_komutta_sozcuk_desenine_dusulur(self):
        kok = kirmizi_depo()
        for metin in ("ls # don't push", "echo 'kapanmamış tırnak"):
            self.assertFalse(ajan_hook.push_mu(metin), metin)
            self.assertIsNone(komut(kok, metin), metin)
        for metin in ("git push origin 'dal", "gh pr merge 3 # don't wait"):
            self.assertTrue(ajan_hook.push_mu(metin), metin)
            self.assertEqual(karar(komut(kok, metin)), "deny", metin)

    def test_kapi_olculemezken_de_zararsiz_komut_gecer_gonderen_durur(self):
        kok = depo({"harness.json": "{bozuk"}, uret=False)
        girdi = {"session_id": "s1", "cwd": str(kok)}
        self.assertIsNone(ajan_hook.guvenli_isle("komut-oncesi", dict(
            girdi, tool_input={"command": "cat harness/hook/git/pre-push"}), {}))
        self.assertEqual(karar(ajan_hook.guvenli_isle("komut-oncesi", dict(
            girdi, tool_input={"command": "git -C . push"}), {})), "deny")


# ── c) Rapor commit edilmiş hâliyle aranır ───────────────────────────────────────────

RAPOR = "docs/rapor/2026-11-25-odeme.md"


class CommitliRapor(unittest.TestCase):
    def _rapor_yaz(self, kok, doldur=("Kısa özet", "Kullanıcıdan beklenenler")):
        kayit(kok, "GV-007", gorev_durumu("GV-007", "Ödeme", alindi=True))
        yol = rapor.yeni(kok, "Ödeme", "2026-11-25")
        metin = yol.read_text(encoding="utf-8")
        for ad in doldur:
            metin = bolum_doldur(metin, ad, DOLU[ad])
        yol.write_text(metin, encoding="utf-8")
        return yol

    def test_yalniz_calisma_agacindaki_rapor_kapiyi_gecirmez_commit_edilince_gecer(self):
        kok = dal_depo("GV-007: Ödeme")
        self._rapor_yaz(kok)
        kod, cikti = cli(kok, "denetle", "--dal")
        self.assertEqual(kod, 1, cikti)
        self.assertIn("raporsuz-gorev", cikti)
        self.assertIn("GV-007", cikti)
        self.assertIn("raporu commit eden ve gönderen komutları ayrı ayrı çalıştır", cikti)
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertEqual(kod, 0)
        self.assertIn("commit-edilmemis-rapor " + RAPOR, cikti)
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "Rapor")
        kod, cikti = cli(kok, "denetle", "--dal")
        self.assertEqual(kod, 0, cikti)
        kod, cikti = cli(kok, "rapor", "durum")
        self.assertNotIn("commit-edilmemis-rapor", cikti)
        self.assertIn("rapor durum: bu dalda raporsuz görev ve boş bölümlü rapor yok", cikti)

    def test_bolumleri_yalniz_calisma_agacinda_doldurulan_rapor_bos_sayilir(self):
        kok = dal_depo("GV-007: Ödeme")
        yol = self._rapor_yaz(kok, doldur=())
        git(kok, "add", "-A")
        git(kok, "commit", "-q", "-m", "Rapor")
        metin = yol.read_text(encoding="utf-8")
        for ad, icerik in DOLU.items():
            metin = bolum_doldur(metin, ad, icerik)
        yol.write_text(metin, encoding="utf-8")
        bulgular = [b["ad"] for b in rapor.dal_bulgulari(kok, h.ayar_oku(kok))]
        self.assertEqual(bulgular, ["bos-rapor-bolumu", "bos-rapor-bolumu"])
        self.assertIn("commit-edilmemis-rapor " + RAPOR, cli(kok, "rapor", "durum")[1])


# ── d) Kapı dışı yazım ───────────────────────────────────────────────────────────────

# Sahte oturum: işçi bir dosyayı düzenleme kapısından (hook) geçirerek, ötekini SAHTE_KAPI'ya göre ya kapıdan ya
# doğrudan (kabuktan yazar gibi) yazar. İnceleyici istemdeki her hüküm satırına "uyuyor" der.
SAHTE = r'''
import json, os, pathlib, re, sys
sys.path[:0] = [{harness!r}, {hook!r}]
import ajan_hook
kok = pathlib.Path(os.environ["HARNESS_KOK"]); gv = os.environ["HARNESS_GOREV"]
gd = kok / ".harness/gorev" / gv
print(json.dumps({{"type": "result", "is_error": False, "num_turns": 2, "result": "bitti"}}))
if os.environ.get("HARNESS_ROL") == "inceleyici":
    istem = sys.argv[sys.argv.index("-p") + 1]
    (gd / "inceleme.json").write_text(json.dumps({{
        "gorev": gv, "hukum": "gecti", "ozet": "incelendi", "olcut": {{"karsilandi": True, "kanit": "-"}},
        "kurallar": [{{"kimlik": k, "hukum": "uyuyor", "kanit": "-"}} for k in re.findall(r"^\[ \] (KU-\d+@\d+) ", istem, re.M)],
        "bulgular": [], "kosulan": ["python3 -c pass"], "bakilmayan": []}}), encoding="utf-8")
    sys.exit(0)

def kapidan(goreli, icerik):
    girdi = {{"session_id": "isci", "cwd": str(kok), "tool_name": "Write",
             "tool_input": {{"file_path": str(kok / goreli), "content": icerik}}}}
    for _ in range(3):   # ilk deneme kuralları gösterip reddedilir; okuyup yeniden dener
        if ajan_hook.isle("duzenleme-oncesi", girdi, dict(os.environ)) is None:
            (kok / goreli).write_text(icerik, encoding="utf-8")
            return
    raise SystemExit("kapı geçirmedi: " + goreli)

kapidan("src/siparis/iptal.ts", "export const x = 2\n")
if os.environ.get("SAHTE_KAPI") == "ikisi":
    kapidan("src/siparis/kabuk.ts", "export const k = 1\n")
else:
    (kok / "src/siparis/kabuk.ts").write_text("export const k = 1\n", encoding="utf-8")
kart = (gd / "kart.md").read_text(encoding="utf-8")
(gd / "bitis.json").write_text(json.dumps({{
    "gorev": gv, "durum": "tamam", "ozet": "yapildi", "kararlar": [], "reddedilenler": [], "denenmedi": [],
    "kurallar": [{{"kimlik": k, "hukum": "uyuyor", "not": ""}}
                 for k in re.findall(r"^(?:\[ \] )?(KU-\d+@\d+) ", kart, re.M)]}}), encoding="utf-8")
'''

# Yalnız kabuktan yazılan dosyaya düşen kural: işçinin kartında da inceleyicinin ana paketinde de yoktur.
KABUK_KURALI = (KURAL.replace("KU-001", "KU-002").replace("kapsam: [src/siparis/**]", "kapsam: [src/siparis/kabuk.ts]")
                .replace("baslik: Durum yalnız tablodan değişir", "baslik: Kabuk dosyası kuralı"))


def sahte_depo():
    sahte = pathlib.Path(tempfile.mkdtemp(prefix="harness-sahte-")) / "isci.py"
    sahte.write_text(SAHTE.format(harness=str(BURASI.parent), hook=str(BURASI.parent / "hook")), encoding="utf-8")
    ayar = {"gorev": {"komut": [sys.executable, str(sahte)], "model": "sonnet", "max_tur": 5,
                      "zaman_asimi_sn": 30, "izin_modu": "acceptEdits"}}
    return git_depo(depo({"kb/kural/KU-002-kabuk.md": KABUK_KURALI}, ayar=ayar))


def kapi_deposu():
    kok = sahte_depo()
    kart = gorev.yeni(kok, "Kabuk dosyası", "uygulayici", ["src/siparis/**"], [],
                      hedef="İki dosya yazılır.", olcut="İkisi de değişir.")
    return kok, kart.parent.name


def kos_ciktisi(kok, kimlik):
    cikti = io.StringIO()
    with contextlib.redirect_stdout(cikti):
        kod = gorev.komut(kok, ["kos", kimlik])
    return kod, cikti.getvalue()


def kapi_disi_bolumu(istem):
    return istem.split("## Kapı dışı yazım", 1)[1] if "## Kapı dışı yazım" in istem else ""


class KapiDisiYazim(unittest.TestCase):
    def tearDown(self):
        os.environ.pop("SAHTE_KAPI", None)

    def test_kabuktan_yazilan_dosya_raporda_ozette_ve_inceleme_kartinda_gorunur(self):
        kok, kimlik = kapi_deposu()
        kod, cikti = kos_ciktisi(kok, kimlik)
        self.assertEqual(kod, 0, cikti)   # engel değildir
        r = gorev._json_oku(gorev._kayit(kok, kimlik) / "rapor.json")
        self.assertEqual(r["durum"], "tamam")
        self.assertEqual(sorted(r["degisen"]), ["src/siparis/iptal.ts", "src/siparis/kabuk.ts"])
        uyari = [u for u in r["uyarilar"] if u["ad"] == "kapi-disi-yazim"]
        self.assertEqual([u["dosyalar"] for u in uyari], [["src/siparis/kabuk.ts"]])
        satir = [s for s in cikti.splitlines() if "UYARI [kapi-disi-yazim]" in s]
        self.assertEqual(len(satir), 1, cikti)
        self.assertIn("src/siparis/kabuk.ts", satir[0])
        self.assertNotIn("iptal.ts", satir[0])
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        istem = (gorev._kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        bolum = kapi_disi_bolumu(istem)
        self.assertIn("- src/siparis/kabuk.ts", bolum)
        self.assertNotIn("iptal.ts", bolum)
        self.assertIn("[ ] KU-002@1 ", bolum)          # yalnız bu dosyaya düşen kural, hüküm satırıyla
        self.assertNotIn("KU-002@1", istem.split("## Kapı dışı yazım", 1)[0])

    def test_iki_dosya_da_kapidan_gecince_uyari_ve_ek_bolum_yoktur(self):
        os.environ["SAHTE_KAPI"] = "ikisi"
        kok, kimlik = kapi_deposu()
        kod, cikti = kos_ciktisi(kok, kimlik)
        self.assertEqual(kod, 0, cikti)
        r = gorev._json_oku(gorev._kayit(kok, kimlik) / "rapor.json")
        self.assertEqual(sorted(r["degisen"]), ["src/siparis/iptal.ts", "src/siparis/kabuk.ts"])
        self.assertEqual(r["uyarilar"], [])
        self.assertNotIn("kapi-disi-yazim", cikti)
        self.assertEqual(gorev.incele(kok, kimlik)["sonuc"], "gecti")
        istem = (gorev._kayit(kok, kimlik) / "inceleme-istem.md").read_text(encoding="utf-8")
        self.assertNotIn("Kapı dışı yazım", istem)
        self.assertNotIn("KU-002", istem)

    def test_epic_yurutmesi_kapi_disi_yazimda_durmaz_ve_bildirir(self):
        kok = sahte_depo()
        plan.space(kok, "Sipariş", amac="Sipariş yaşam döngüsü.", yollar=["src/siparis/**"])
        plan.epic(kok, "siparis", "Kabuk", hedef="İki dosya yazılır.")
        plan.task(kok, "EP-001", "Kabuk dosyası", rol="uygulayici", hedef="İki dosya yazılır.", olcut="İkisi de değişir.")
        mesajlar = []
        sonuc = plan.yurut(kok, "EP-001", bildir=mesajlar.append)
        self.assertIsNone(sonuc["duran"])
        self.assertEqual(sonuc["alinan"], ["GV-001"])
        self.assertEqual([m for m in mesajlar if "kapı dışı yazım" in m],
                         ["EP-001 1 (GV-001): UYARI kapı dışı yazım: src/siparis/kabuk.ts"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
