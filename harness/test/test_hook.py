#!/usr/bin/env python3
"""ajan_hook.py testleri: hook'a gerçek biçimde girdi verilir, kararı okunur.

Koşum: python3 harness/test/test_hook.py
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import os
import shutil
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
BURASI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(BURASI.parent))
sys.path.insert(0, str(BURASI.parent / "hook"))
sys.path.insert(0, str(BURASI))
import h  # noqa: E402
import ajan_hook  # noqa: E402
from test_h import AYAR, KARAR, KURAL, Z15Z16, agac_ac, depo, git_depo  # noqa: E402

KARAR_ISTISNALI = KARAR + "\n## İstisna yolu\nİstisnası yok.\n"
KESIN = Z15Z16.KESIN


def kesin_depo(**kw):
    ek = {"kb/kural/KU-001-durum-tablodan.md": KESIN, "kb/karar/KR-001-durum-tablosu.md": KARAR_ISTISNALI}
    ek.update(kw.pop("ek", {}))
    return depo(ek, **kw)


def duzenle(kok, yol, oturum="s1", ajan=None, ortam=None, **girdi):
    veri = {"session_id": oturum, "cwd": str(kok), "tool_name": "Edit",
            "tool_input": dict({"file_path": str(kok / yol)}, **girdi)}
    if ajan:
        veri["agent_id"] = ajan
        veri["agent_type"] = "general-purpose"
    return ajan_hook.isle("duzenleme-oncesi", veri, ortam or {})


def komut(kok, metin, ortam=None):
    return ajan_hook.isle("komut-oncesi", {"session_id": "s1", "cwd": str(kok), "tool_name": "Bash",
                                           "tool_input": {"command": metin}}, ortam or {})


def karar(cikti):
    return (cikti or {}).get("hookSpecificOutput", {}).get("permissionDecision")


TASLAK_KARAR = (KARAR.replace("KR-001", "KR-002").replace("durum: kabul", "durum: taslak")
                .replace("baslik: Durum tek tablodan yönetilir", "baslik: Sipariş iptali nedensiz olmaz"))
TASLAK_KURAL = (KURAL.replace("KU-001", "KU-002").replace("KR-001@1", "KR-002@1").replace("durum: kabul", "durum: taslak")
                .replace("baslik: Durum yalnız tablodan değişir", "baslik: İptal nedeni zorunludur"))


def taslakli_depo(**kw):
    """Kabul edilmiş bir karar ve kuralın yanında, kabul bekleyen bir karar ve ona dayanan bir kural."""
    return depo({"kb/karar/KR-002-iptal.md": TASLAK_KARAR, "kb/kural/KU-002-iptal-nedeni.md": TASLAK_KURAL}, **kw)


def kabul_komutu(kok, kimlikler="KU-002", ortam=None, **girdi):
    veri = {"session_id": "s1", "cwd": str(kok), "tool_name": "Bash",
            "tool_input": {"command": "python3 harness/h.py kabul " + kimlikler}}
    veri.update(girdi)
    return ajan_hook.isle("komut-oncesi", veri, ortam or {})


def gerekce(cikti):
    return (cikti or {}).get("hookSpecificOutput", {}).get("permissionDecisionReason", "")


def baglam(cikti):
    return (cikti or {}).get("hookSpecificOutput", {}).get("additionalContext", "")


class OkunduKapisi(unittest.TestCase):
    def test_ilk_duzenleme_kurallari_gostererek_reddedilir(self):
        c = duzenle(depo(), "src/siparis/iptal.ts")
        self.assertEqual(karar(c), "deny")
        self.assertIn("KU-001@1", gerekce(c))
        self.assertIn("Durumu değiştiren her kod yolu geçiş tablosundan geçer.", gerekce(c))
        self.assertIn("YP-001", gerekce(c))

    def test_kurallar_gosterildikten_sonra_duzenleme_gecer(self):
        kok = depo()
        duzenle(kok, "src/siparis/iptal.ts")
        self.assertIsNone(duzenle(kok, "src/siparis/iptal.ts"))

    def test_kurali_olmayan_dosya_dogrudan_gecer(self):
        kok = depo({"src/odeme/a.ts": "x\n"})
        self.assertIsNone(duzenle(kok, "src/odeme/a.ts"))

    def test_kuralin_surumu_artinca_yeniden_gosterilir(self):
        kok = depo()
        duzenle(kok, "src/siparis/iptal.ts")
        p = kok / "kb/kural/KU-001-durum-tablodan.md"
        p.write_text(p.read_text(encoding="utf-8").replace("surum: 1", "surum: 2"), encoding="utf-8")
        c = duzenle(kok, "src/siparis/iptal.ts")
        self.assertEqual(karar(c), "deny")
        self.assertIn("KU-001@2", gerekce(c))

    def test_alt_ajan_ana_oturumdan_ayri_sayilir(self):
        kok = depo()
        duzenle(kok, "src/siparis/iptal.ts")
        self.assertEqual(karar(duzenle(kok, "src/siparis/iptal.ts", ajan="a1")), "deny")

    def test_baglam_sikistirilinca_kurallar_yeniden_gosterilir(self):
        kok = depo()
        duzenle(kok, "src/siparis/iptal.ts")
        ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok), "source": "compact"}, {})
        self.assertEqual(karar(duzenle(kok, "src/siparis/iptal.ts")), "deny")

    def test_gosterilen_kural_deftere_yazilir(self):
        kok = depo()
        duzenle(kok, "src/siparis/iptal.ts")
        satirlar = (kok / ".harness/defter/s1.jsonl").read_text(encoding="utf-8").strip().split("\n")
        kayit = json.loads(satirlar[-1])
        self.assertEqual(kayit["olay"], "gosterildi")
        self.assertIn("KU-001@1", kayit["kurallar"])


class KorunanYollar(unittest.TestCase):
    def test_uretilen_dosya_duzenlenemez(self):
        self.assertEqual(karar(duzenle(depo(), ".claude/rules/KU-001.md")), "deny")

    def test_harness_klasoru_projede_duzenlenemez(self):
        self.assertEqual(karar(duzenle(depo(), "harness/h.py")), "deny")

    def test_iskelet_deposunda_harness_duzenlenebilir(self):
        self.assertIsNone(duzenle(depo(ayar={"harness_gelistirme": True}), "harness/h.py"))

    def test_ajan_dugumu_kabul_durumuna_getiremez(self):
        kok = depo({"kb/kural/KU-002-yeni.md": KURAL.replace("KU-001", "KU-002")
                    .replace("durum: kabul", "durum: taslak")})
        c = duzenle(kok, "kb/kural/KU-002-yeni.md", old_string="durum: taslak", new_string="durum: kabul")
        self.assertEqual(karar(c), "deny")
        self.assertIn("kabul", gerekce(c))

    def test_ajan_taslak_dugumu_duzenleyebilir(self):
        kok = depo({"kb/kural/KU-002-yeni.md": KURAL.replace("KU-001", "KU-002")
                    .replace("durum: kabul", "durum: taslak")})
        self.assertIsNone(duzenle(kok, "kb/kural/KU-002-yeni.md", old_string="x", new_string="y"))

    def test_alt_ajan_bilgi_tabanina_yazamaz(self):
        self.assertEqual(karar(duzenle(depo(), "kb/kural/KU-009-x.md", ajan="a1")), "deny")


class KomutKapisi(unittest.TestCase):
    def test_no_verify_reddedilir(self):
        self.assertEqual(karar(komut(depo(), "git commit --no-verify -m x")), "deny")

    def test_commit_mesajindaki_no_verify_kelimesi_reddedilmez(self):
        c = komut(depo(), "git commit -F - <<'EOF'\n--no-verify hakkında not\nEOF")
        self.assertIsNone(c)

    def test_hook_yolunu_yalniz_okuyan_komut_reddedilmez(self):
        for metin in ("git config --get core.hooksPath", "git -C . config --local --get core.hooksPath",
                      "git config --get-all include.path", "git config --get core.hooksPath; git status",
                      "git config --get core.hooksPath\ngit status"):
            self.assertIsNone(komut(depo(), metin), metin)

    def test_hook_yolunu_degistiren_her_bicim_reddedilir(self):
        for metin in ("git config core.hooksPath /dev/null", "git config --unset core.hooksPath",
                      "git -c core.hooksPath=/dev/null commit -m x",
                      "git -c core.hooksPath=/dev/null config --get core.hooksPath",
                      "git config --get core.hooksPath && git config core.hooksPath /tmp/x",
                      "git config --get core.hooksPath /dev/null", "git config --get core.hooksPathX",
                      "sh -c 'git config core.hooksPath /tmp/x'", "echo core.hooksPath"):
            self.assertEqual(karar(komut(depo(), metin)), "deny", metin)

    def test_okuma_bicimi_baska_yasak_bayragi_aklamaz(self):
        self.assertEqual(karar(komut(depo(), "git config --get core.hooksPath; git commit --no-verify -m x")), "deny")

    def test_kapi_atlatan_bayragin_kisaltmasi_ve_commitin_kisa_secenegi_reddedilir(self):
        for metin in ("git commit -n -m x", "git commit -nm x", "git commit -anm x", "git -C . commit -n -m x",
                      "sh -c 'git commit -n -m x'", "time git commit -n -m x", "git commit --no-verif -m x",
                      "git commit --no-v -m x", "git push --no-veri origin dal", "git push --no-ver",
                      "eval git commit -n -m x", "echo $(git commit -n -m x)", "echo `git push --no-ve`",
                      "sudo git commit -n -m x", "echo x | xargs git commit -n -m", "git -c a=b commit -nS",
                      "git commit -m x && git push --no-v", "git commit -n -m 'kapanmamış"):
            self.assertEqual(karar(komut(depo(), metin)), "deny", metin)

    def test_baska_secenek_ve_deger_olarak_gecen_sozcuk_reddedilmez(self):
        for metin in ("git commit -m n", "git commit -mnot", 'git commit -m "--no-veri hakkında"',
                      "git commit --no-verbose -m x", "git push -n origin dal", "git merge -n dal", "git log -n 5",
                      "git commit -Sn -m x", "git -C commit status -n",
                      "git commit -F - <<'EOF'\n-n ile --no-veri hakkında not\nEOF"):
            self.assertNotEqual(karar(komut(depo(), metin)), "deny", metin)

    def test_tek_basina_sozcuk_olan_bayraga_benzer_deger_reddedilir(self):
        # Kullanıcının kararı (2026-11-27): ayrı sözcük olan değer bayrak sayılır; içinde başka sözcük de olan değer sayılmaz
        for metin in ("git commit -m -n", 'git commit -m "-n"', 'git commit -m "--no-veri"'):
            self.assertEqual(karar(komut(depo(), metin)), "deny", metin)

    def test_satir_devamiyla_bolunmus_cagri_taninir(self):
        for metin in ("git \\\ncommit -n -m x", "git commit \\\n-n -m x"):
            self.assertEqual(karar(komut(depo(), metin)), "deny", metin)
        self.assertTrue(ajan_hook.push_mu("git \\\npush origin dal"))

    def test_kacisli_ters_boluden_sonraki_satir_sonu_ayiricidir(self):
        # Çift ters bölü kaçışlı ters bölüdür; ardındaki satır sonu komutu ayırır, satır devamı değildir
        self.assertTrue(ajan_hook.push_mu("echo a\\\\\ngit push origin dal"))
        self.assertEqual(karar(komut(depo(), "echo a\\\\\ngit commit -n -m x")), "deny")

    def test_uc_ters_boluyle_biten_satir_birlestirilir(self):
        # Kaçışlı ters bölü ve ardından satır devamı: -n aynı commit çağrısının sözcüğüdür
        self.assertEqual(karar(komut(depo(), "git commit -m x\\\\\\\n -n")), "deny")

    def test_attr_source_degeri_alt_komut_sayilmaz(self):
        self.assertEqual(karar(komut(depo(), "git --attr-source HEAD commit -n -m x")), "deny")
        self.assertTrue(ajan_hook.push_mu("git --attr-source HEAD push origin dal"))

    def test_gorev_oturumu_kabul_komutunu_calistiramaz(self):
        c = komut(taslakli_depo(), "python3 harness/h.py kabul KU-002", ortam={"HARNESS_GOREV": "GV-001"})
        self.assertEqual(karar(c), "deny")

    def test_zincir_kirmiziyken_push_reddedilir(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("dayanak: [KR-001@1]\n", "")})
        c = komut(kok, "git push origin dal")
        self.assertEqual(karar(c), "deny")
        self.assertIn("dayanaksiz", gerekce(c))

    def test_zincir_temizken_push_gecer(self):
        self.assertIsNone(komut(depo(), "git push origin dal"))

    def test_siradan_komut_gecer(self):
        self.assertIsNone(komut(depo(), "ls -la && git status"))


class AjanDogarken(unittest.TestCase):
    def _dog(self, kok, tip):
        return ajan_hook.isle("ajan-dogarken", {"session_id": "s1", "cwd": str(kok), "agent_id": "a1",
                                                "agent_type": tip}, {})

    def test_kesin_kural_alt_ajanin_baglamina_eklenir(self):
        c = self._dog(kesin_depo(), "general-purpose")
        self.assertIn("KU-001@1", baglam(c))
        self.assertIn("[[KB-PAKET rol=uygulayici", baglam(c))

    def test_kesin_kural_yoksa_bir_sey_eklenmez(self):
        self.assertIsNone(self._dog(depo(), "general-purpose"))

    def test_taninmayan_ajan_tipi_butun_kesin_kurallari_alir(self):
        kok = kesin_depo(ek={"kb/kural/KU-001-durum-tablodan.md": KESIN.replace(
            "bicim: kural", "bicim: kural\nrol: [tasarimci]")})
        self.assertIn("KU-001@1", baglam(self._dog(kok, "bilinmeyen-tip")))

    def test_verilen_paket_deftere_yazilir(self):
        kok = kesin_depo()
        self._dog(kok, "general-purpose")
        kayit = json.loads((kok / ".harness/defter/s1.jsonl").read_text(encoding="utf-8").strip().split("\n")[-1])
        self.assertEqual((kayit["olay"], kayit["ajan"]), ("paket-verildi", "a1"))


class AjanBaslatma(unittest.TestCase):
    def _baslat(self, kok, prompt, tip="general-purpose"):
        return ajan_hook.isle("ajan-baslatma", {"session_id": "s1", "cwd": str(kok), "tool_name": "Agent",
                                                "tool_input": {"prompt": prompt, "subagent_type": tip}}, {})

    def test_kesin_kural_yokken_baslatma_serbesttir(self):
        self.assertIsNone(self._baslat(depo(), "şunu yap"))

    def test_paketsiz_gorev_guncel_paketle_birlikte_reddedilir(self):
        kok = kesin_depo()
        c = self._baslat(kok, "şunu yap")
        self.assertEqual(karar(c), "deny")
        self.assertIn(h.paket(kok, "uygulayici")["metin"], gerekce(c))
        self.assertIn("[gorev]", gerekce(c))

    def test_guncel_paketi_tasiyan_gorev_gecer(self):
        kok = kesin_depo()
        p = h.paket(kok, "uygulayici")["metin"]
        self.assertIsNone(self._baslat(kok, "[gorev] rol=uygulayici\n\n" + p + "\n\nşunu yap"))

    def test_icerigi_degistirilmis_paket_reddedilir(self):
        kok = kesin_depo()
        p = h.paket(kok, "uygulayici")["metin"].replace("geçer", "geçmez")
        self.assertEqual(karar(self._baslat(kok, "[gorev] rol=uygulayici\n\n" + p + "\n\nyap")), "deny")

    def test_baslikta_yol_verilince_o_yolun_kurallari_da_istenir(self):
        kok = depo({"kb/kural/KU-002-kesin.md": KESIN.replace("KU-001", "KU-002"),
                    "kb/karar/KR-001-durum-tablosu.md": KARAR_ISTISNALI})
        yalniz_kesin = h.paket(kok, "uygulayici")["metin"]
        baslik = "[gorev] rol=uygulayici yol=src/siparis/iptal.ts\n\n"
        self.assertEqual(karar(self._baslat(kok, baslik + yalniz_kesin + "\n\nyap")), "deny")
        tam = h.paket(kok, "uygulayici", yollar=["src/siparis/iptal.ts"])["metin"]
        self.assertIsNone(self._baslat(kok, baslik + tam + "\n\nyap"))

    def test_kesif_ajani_baslik_olmadan_baslatilabilir(self):
        self.assertIsNone(self._baslat(kesin_depo(), "şunu ara", tip="Explore"))


class WorkflowBaslatma(unittest.TestCase):
    def _baslat(self, kok, script, args=None):
        girdi = {"script": script}
        if args is not None:
            girdi["args"] = args
        return ajan_hook.isle("workflow-baslatma", {"session_id": "s1", "cwd": str(kok),
                                                    "tool_name": "Workflow", "tool_input": girdi}, {})

    def _args(self, kok):
        return {"kb_gorev": {"yol": [], "konu": []},
                "kb_paket": {"uygulayici": h.paket(kok, "uygulayici")["metin"]}}

    def test_kesin_kural_yokken_workflow_serbesttir(self):
        self.assertIsNone(self._baslat(depo(), "await agent('x')"))

    def test_paketsiz_workflow_yardimci_ve_paketle_birlikte_reddedilir(self):
        c = self._baslat(kesin_depo(), "await agent('x')")
        self.assertEqual(karar(c), "deny")
        self.assertIn(ajan_hook.WORKFLOW_YARDIMCISI, gerekce(c))

    def test_yardimciyi_ve_guncel_paketi_tasiyan_workflow_gecer(self):
        kok = kesin_depo()
        script = ajan_hook.WORKFLOW_YARDIMCISI + "\nawait ajan('uygulayici', 'şunu yap')\n"
        self.assertIsNone(self._baslat(kok, script, self._args(kok)))

    def test_yardimcinin_disinda_ajan_cagrisi_reddedilir(self):
        kok = kesin_depo()
        script = ajan_hook.WORKFLOW_YARDIMCISI + "\nawait ajan('uygulayici', 'x')\nawait agent('paketsiz')\n"
        self.assertEqual(karar(self._baslat(kok, script, self._args(kok))), "deny")

    def test_bayat_paketli_workflow_reddedilir(self):
        kok = kesin_depo()
        args = self._args(kok)
        args["kb_paket"]["uygulayici"] = args["kb_paket"]["uygulayici"].replace("geçer", "geçmez")
        script = ajan_hook.WORKFLOW_YARDIMCISI + "\nawait ajan('uygulayici', 'x')\n"
        self.assertEqual(karar(self._baslat(kok, script, args)), "deny")


class Durus(unittest.TestCase):
    def _dur(self, kok, aktif=False):
        return ajan_hook.isle("durus", {"session_id": "s1", "cwd": str(kok), "stop_hook_active": aktif}, {})

    def test_zincir_kirmiziyken_durus_bir_kez_engellenir(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("dayanak: [KR-001@1]\n", "")})
        c = self._dur(kok)
        self.assertEqual(c["decision"], "block")
        self.assertIn("dayanaksiz", c["reason"])
        self.assertIsNone(self._dur(kok))

    def test_zincir_temizken_durus_engellenmez(self):
        self.assertIsNone(self._dur(depo()))

    def test_zaten_engellenmis_durus_yeniden_engellenmez(self):
        kok = depo({"kb/kural/KU-001-durum-tablodan.md": KURAL.replace("dayanak: [KR-001@1]\n", "")})
        self.assertIsNone(self._dur(kok, aktif=True))


class OturumVeIstem(unittest.TestCase):
    def test_oturum_basi_durumu_ve_bekleyen_taslaklari_soyler(self):
        kok = depo({"kb/kural/KU-002-yeni.md": KURAL.replace("KU-001", "KU-002")
                    .replace("durum: kabul", "durum: taslak")})
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok), "source": "startup"}, {})
        self.assertIn("KU-002", baglam(c))

    def test_ogretici_mod_acikken_oturum_basinda_soylenir(self):
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(depo(ayar={"ogretici": True})),
                                           "source": "startup"}, {})
        self.assertIn("Öğretici", baglam(c))

    def test_plan_modunda_tasarimci_paketi_bir_kez_eklenir(self):
        kok = kesin_depo()
        girdi = {"session_id": "s1", "cwd": str(kok), "permission_mode": "plan", "prompt": "plan yap"}
        self.assertIn("[[KB-PAKET rol=tasarimci", baglam(ajan_hook.isle("istem", girdi, {})))
        self.assertIsNone(ajan_hook.isle("istem", girdi, {}))

    def test_plan_modu_disinda_isteme_bir_sey_eklenmez(self):
        girdi = {"session_id": "s1", "cwd": str(kesin_depo()), "permission_mode": "default", "prompt": "x"}
        self.assertIsNone(ajan_hook.isle("istem", girdi, {}))


class OturumAgaci(unittest.TestCase):
    """Her oturum kendi çalışma ağacında çalışır: ana ağaçta düzenleme reddedilir."""

    def test_ana_agactaki_oturum_duzenleyemez_ve_cikis_yolu_soylenir(self):
        c = duzenle(git_depo(depo()), "docs/not.md")
        self.assertEqual(karar(c), "deny")
        self.assertIn("EnterWorktree", gerekce(c))

    def test_ana_agactaki_alt_ajan_da_duzenleyemez(self):
        self.assertEqual(karar(duzenle(git_depo(depo()), "docs/not.md", ajan="a1")), "deny")

    def test_bagli_agactaki_oturum_duzenleyebilir(self):
        self.assertIsNone(duzenle(agac_ac(git_depo(depo()), "a"), "docs/not.md"))

    def test_bagli_agacta_okundu_kapisi_calisir(self):
        agac = agac_ac(git_depo(depo()), "a")
        c = duzenle(agac, "src/siparis/iptal.ts")
        self.assertEqual(karar(c), "deny")
        self.assertIn("KU-001@1", gerekce(c))
        self.assertNotIn("EnterWorktree", gerekce(c))

    def test_git_olmayan_klasorde_kapi_sessizdir(self):
        self.assertIsNone(duzenle(depo(), "docs/not.md"))

    def test_ilk_commit_atilmamis_depoda_kapi_sessizdir(self):
        self.assertIsNone(duzenle(git_depo(depo(), commit=False), "docs/not.md"))

    def test_ayar_kapaliysa_ana_agacta_duzenlenir(self):
        self.assertIsNone(duzenle(git_depo(depo(ayar={"oturum_agaci": "kapali"})), "docs/not.md"))

    def test_ana_agacta_gorev_karti_yazilabilir(self):
        self.assertIsNone(duzenle(git_depo(depo()), ".harness/gorev/GV-001/kart.md"))

    def test_oturum_basi_ana_agacta_oldugunu_soyler(self):
        kok = git_depo(depo())
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(kok), "source": "startup"}, {})
        self.assertIn("ana çalışma ağacında", baglam(c))
        self.assertIn("EnterWorktree", baglam(c))

    def test_oturum_basi_bagli_agacin_dalini_soyler(self):
        agac = agac_ac(git_depo(depo()), "a")
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(agac), "source": "startup"}, {})
        self.assertIn("oturum-a", baglam(c))
        self.assertNotIn("EnterWorktree", baglam(c))

    def test_oturum_basi_git_yoksa_agac_kuralinin_calismadigini_soyler(self):
        c = ajan_hook.isle("oturum-basi", {"session_id": "s1", "cwd": str(depo()), "source": "startup"}, {})
        self.assertIn("git", baglam(c))


class KanitKorumasi(unittest.TestCase):
    """Görevin ölçüm kayıtları ve planın işareti elle yazılmaz; onları araç üretir."""

    def test_olcum_kayitlari_elle_duzenlenmez(self):
        kok = depo()
        for ad in ("durum.json", "rapor.json", "inceleme-rapor.json", "bitis.json", "inceleme.json"):
            c = duzenle(kok, ".harness/gorev/GV-001/" + ad)
            self.assertEqual(karar(c), "deny", ad)

    def test_bilgi_tabani_gunlugu_elle_duzenlenmez(self):
        kok = depo()
        (kok / "kb/GUNLUK.md").write_text("# Günlük\n", encoding="utf-8")
        c = duzenle(kok, "kb/GUNLUK.md", old_string="# Günlük", new_string="# Günlük\n## [2026-01-01] kabul | KU-009@1 x")
        self.assertEqual(karar(c), "deny")
        self.assertIn("günlü", gerekce(c).lower())

    def test_gorev_karti_duzenlenebilir(self):
        self.assertIsNone(duzenle(depo(), ".harness/gorev/GV-001/kart.md"))

    def test_plan_isareti_elle_konmaz(self):
        kok = depo()
        yol = kok / ".harness/plan/siparis/EP-001.md"
        yol.parent.mkdir(parents=True)
        yol.write_text("# EP-001 — x\n\n## Tasklar\n- [ ] 1. İş — GV-001 · bekliyor\n"
                       "  - [ ] 1.1 Alt iş — GV-002 · bekliyor\n", encoding="utf-8")
        for eski, yeni in (("- [ ] 1.", "- [x] 1."), ("  - [ ] 1.1", "  - [x] 1.1")):
            c = duzenle(kok, ".harness/plan/siparis/EP-001.md", old_string=eski, new_string=yeni)
            self.assertEqual(karar(c), "deny", yeni)
            self.assertIn("işaret", gerekce(c))

    def test_space_dosyasindaki_epic_isareti_elle_konmaz(self):
        kok = depo()
        yol = kok / ".harness/plan/siparis/space.md"
        yol.parent.mkdir(parents=True)
        yol.write_text("# Space: Sipariş\n\n## Epicler\n- [ ] EP-001 — x · 0/2 iş alındı\n", encoding="utf-8")
        c = duzenle(kok, ".harness/plan/siparis/space.md", old_string="- [ ] EP-001", new_string="- [x] EP-001")
        self.assertEqual(karar(c), "deny")

    def test_plan_metni_isaret_konmadan_duzenlenebilir(self):
        kok = depo()
        yol = kok / ".harness/plan/siparis/EP-001.md"
        yol.parent.mkdir(parents=True)
        yol.write_text("# EP-001 — x\n\n## Hedef\n(boş)\n", encoding="utf-8")
        self.assertIsNone(duzenle(kok, ".harness/plan/siparis/EP-001.md", old_string="(boş)",
                                  new_string="Hedef metni"))


class KapiAyari(unittest.TestCase):
    """Kapıların ayarını ajan değiştirmek isterse kullanıcıya sorulur: denetimi gevşetmek kodu düzeltmekten kolaydır."""

    def test_projede_kapi_ayari_duzenlenirken_kullaniciya_sorulur(self):
        kok = depo()
        for yol in ("harness.json", ".claude/settings.json", ".claude/settings.local.json"):
            c = duzenle(kok, yol)
            self.assertEqual(karar(c), "ask", yol)
            self.assertIn("ayar", gerekce(c))

    def test_projenin_ekledigi_korunan_ayar_da_sorulur(self):
        kok = depo(ayar={"korunan_ayar": ["tsconfig.json", ".eslintrc*"]})
        self.assertEqual(karar(duzenle(kok, "tsconfig.json")), "ask")
        self.assertEqual(karar(duzenle(kok, ".eslintrc.cjs")), "ask")
        self.assertIsNone(duzenle(kok, "docs/not.md"))

    def test_iskeletin_kendi_deposunda_sorulmaz(self):
        self.assertIsNone(duzenle(depo(ayar={"harness_gelistirme": True}), "harness.json"))

    def test_baska_yapilandirma_dosyasini_ekleyen_bayrak_da_reddedilir(self):
        self.assertEqual(karar(komut(depo(), "git -c include.path=/tmp/x commit -m y")), "deny")


class KabulSorusu(unittest.TestCase):
    """Kabul komutunu ajan çalıştırır, kararı kullanıcı verir: hook soruyu gösterir, onaysız hiçbir düğüm kabul olmaz."""

    def test_kabul_komutu_kullaniciya_sorulur_ve_dugumu_gosterir(self):
        c = kabul_komutu(taslakli_depo())
        self.assertEqual(karar(c), "ask")
        for parca in ("KU-002@1", "İptal nedeni zorunludur", "Durumu değiştiren her kod yolu", "kb/kural/KU-002-iptal-nedeni.md"):
            self.assertIn(parca, gerekce(c))

    def test_soru_tek_kullanimlik_onay_kaydini_birakir(self):
        kok = taslakli_depo()
        kabul_komutu(kok, "KU-002 KR-002")
        self.assertTrue(h.onay_kullan(kok, ["KR-002", "KU-002"]))
        self.assertFalse(h.onay_kullan(kok, ["KR-002", "KU-002"]))

    def test_karar_ve_kurali_tek_soruda_sorulur(self):
        c = kabul_komutu(taslakli_depo(), "KU-002 KR-002")
        self.assertEqual(karar(c), "ask")
        self.assertLess(gerekce(c).index("KR-002@1"), gerekce(c).index("KU-002@1"))   # karar önce gösterilir

    def test_sorudan_gecen_komut_gercekten_kabul_eder(self):
        kok = taslakli_depo()
        self.assertEqual(karar(kabul_komutu(kok, "KR-002 KU-002")), "ask")
        r = subprocess.run([sys.executable, str(pathlib.Path(h.__file__).resolve()), "kabul", "KR-002", "KU-002"],
                           cwd=kok, capture_output=True, text=True, stdin=subprocess.DEVNULL)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual({d["kimlik"]: d["durum"] for d in h.Dizin(kok).dugumler}["KU-002"], "kabul")

    def test_reddedilen_durumlarda_onay_kaydi_yazilmaz(self):
        kok = taslakli_depo()
        kabul_komutu(kok, ortam={"HARNESS_GOREV": "GV-001"})
        kabul_komutu(kok, agent_id="a1", agent_type="general-purpose")
        kabul_komutu(kok, permission_mode="bypassPermissions")
        kabul_komutu(kok, "KU-999")
        self.assertFalse((kok / ".harness/onay/kabul.json").exists())

    def test_alt_ajan_kabul_komutunu_calistiramaz(self):
        self.assertEqual(karar(kabul_komutu(taslakli_depo(), agent_id="a1", agent_type="general-purpose")), "deny")

    def test_soru_gosterilmeyen_izin_modunda_kabul_reddedilir(self):
        for mod in ("bypassPermissions", "dontAsk"):
            c = kabul_komutu(taslakli_depo(), permission_mode=mod)
            self.assertEqual(karar(c), "deny", mod)
            self.assertIn(mod, gerekce(c))

    def test_soru_gosterilen_izin_modlarinda_sorulur(self):
        for mod in ("default", "acceptEdits", "plan", "auto"):
            self.assertEqual(karar(kabul_komutu(taslakli_depo(), permission_mode=mod)), "ask", mod)

    def test_olmayan_dugum_icin_sorulmaz(self):
        c = kabul_komutu(taslakli_depo(), "KU-999")
        self.assertEqual(karar(c), "deny")
        self.assertIn("KU-999", gerekce(c))

    def test_taslak_olmayan_dugum_icin_sorulmaz(self):
        c = kabul_komutu(taslakli_depo(), "KU-001")
        self.assertEqual(karar(c), "deny")
        self.assertIn("taslak değil", gerekce(c))

    def test_kimliksiz_kabul_komutu_sorulmaz(self):
        c = komut(taslakli_depo(), "python3 harness/h.py kabul")
        self.assertEqual(karar(c), "deny")

    def test_tek_komutta_iki_ayri_kabul_cagrisi_sorulmaz(self):
        c = komut(taslakli_depo(), "python3 harness/h.py kabul KR-002; python3 harness/h.py kabul KU-002")
        self.assertEqual(karar(c), "deny")
        self.assertIn("tek", gerekce(c))

    def test_duzenlemeyle_kabul_yasagi_surer_ve_komutu_gosterir(self):
        kok = taslakli_depo()
        c = duzenle(kok, "kb/kural/KU-002-iptal-nedeni.md", old_string="durum: taslak", new_string="durum: kabul")
        self.assertEqual(karar(c), "deny")
        self.assertIn("h.py kabul", gerekce(c))


class HookSuresi(unittest.TestCase):
    """Yavaş hook çağrısı deftere düşer: dizini hook yoluna almanın tetiği tahmin değil, bu sayıdır."""

    def _hook(self, girdi, **ek):
        ortam = {k: v for k, v in os.environ.items() if k != "HARNESS_HOOK_DEVIR"}
        return subprocess.run([sys.executable, str(pathlib.Path(ajan_hook.__file__).resolve()), "komut-oncesi"],
                              input=girdi, capture_output=True, text=True, env=dict(ortam, **ek))

    def test_esigi_asan_cagri_deftere_yazilir(self):
        kok = depo()
        ajan_hook.sure_kaydet(kok, "duzenleme-oncesi", "s1", 450)
        ajan_hook.sure_kaydet(kok, "komut-oncesi", "s2", 310)
        self.assertEqual(h.yavas_hooklar(kok), {"sayi": 2, "en_uzun": 450, "esik": 300})

    def test_esigin_altindaki_cagri_yazilmaz(self):
        kok = depo()
        ajan_hook.sure_kaydet(kok, "duzenleme-oncesi", "s1", 299)
        self.assertEqual(h.yavas_hooklar(kok)["sayi"], 0)
        self.assertFalse((kok / ".harness/defter").exists())

    def test_tam_esikteki_cagri_yazilir(self):
        kok = depo()
        ajan_hook.sure_kaydet(kok, "duzenleme-oncesi", "s1", 300)
        self.assertEqual(h.yavas_hooklar(kok)["sayi"], 1)

    def test_esik_ayardan_gelir(self):
        kok = depo(ayar={"butce": dict(AYAR["butce"], hook_ms=100)})
        ajan_hook.sure_kaydet(kok, "duzenleme-oncesi", "s1", 120)
        self.assertEqual(h.yavas_hooklar(kok), {"sayi": 1, "en_uzun": 120, "esik": 100})

    def test_defterdeki_baska_kayitlar_sayilmaz(self):
        kok = kesin_depo()
        duzenle(kok, "src/siparis/iptal.ts")
        self.assertTrue((kok / ".harness/defter/s1.jsonl").is_file())
        self.assertEqual(h.yavas_hooklar(kok)["sayi"], 0)

    def test_durum_yavas_hooku_ve_tetigi_soyler(self):
        kok = depo()
        betik = str(pathlib.Path(h.__file__).resolve())
        once = subprocess.run([sys.executable, betik, "durum"], cwd=kok, capture_output=True, text=True).stdout
        self.assertNotIn("yavaş hook", once)
        ajan_hook.sure_kaydet(kok, "duzenleme-oncesi", "s1", 450)
        sonra = subprocess.run([sys.executable, betik, "durum"], cwd=kok, capture_output=True, text=True).stdout
        self.assertIn("yavaş hook: 1 çağrı 300 ms eşiğini aştı (en uzun 450 ms)", sonra)

    def test_gercek_hook_kosumu_hizli_depoda_kayit_birakmaz(self):
        kok = depo()
        girdi = json.dumps({"session_id": "s9", "cwd": str(kok), "tool_name": "Bash", "tool_input": {"command": "ls"}})
        r = self._hook(girdi)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(h.yavas_hooklar(kok)["sayi"], 0)

    def test_gercek_hook_kosumu_esik_sifirken_kendi_suresini_yazar(self):
        kok = depo(ayar={"butce": dict(AYAR["butce"], hook_ms=0)})
        girdi = json.dumps({"session_id": "s9", "cwd": str(kok), "tool_name": "Bash", "tool_input": {"command": "ls"}})
        self._hook(girdi)
        kayit = json.loads((kok / ".harness/defter/s9.jsonl").read_text(encoding="utf-8").strip().split("\n")[-1])
        self.assertEqual((kayit["olay"], kayit["ad"]), ("yavas-hook", "komut-oncesi"))
        self.assertGreaterEqual(kayit["ms"], 0)

    def test_devralan_kosum_sureyi_ikinci_kez_yazmaz(self):
        kok = depo(ayar={"butce": dict(AYAR["butce"], hook_ms=0)})
        girdi = json.dumps({"session_id": "s9", "cwd": str(kok), "tool_name": "Bash", "tool_input": {"command": "ls"}})
        self._hook(girdi, HARNESS_HOOK_DEVIR="1")
        self.assertEqual(h.yavas_hooklar(kok)["sayi"], 0)


class KodVeAgac(unittest.TestCase):
    """Hook'u çalıştıran kod ile denetlenen ağaç ayrışabilir: oturum ana ağaçta açılır, iş başka ağaçta yürür.

    İskeletin kendi deposunda (harness burada gelişir) her ağaç kendi harness koduyla denetlenir; yoksa eski kod
    yeni dosyaları yanlış yere kırmızı sayar. Projede harness değişmez: yargıç, oturumun açıldığı ağacın kodudur."""

    BETIK = ('import json, sys\nsys.stdin.read()\n'
             'print(json.dumps({"decision": "block", "reason": "AGACIN-KENDI-KODU " + sys.argv[1]}))\n')

    def _kendi_betigi_olan_agac(self):
        kok = depo()
        betik = kok / "harness/hook/ajan_hook.py"
        betik.parent.mkdir(parents=True)
        betik.write_text(self.BETIK, encoding="utf-8")
        return kok

    def test_gelistirme_deposunda_agacin_kendi_betigi_yetkilidir(self):
        kok = self._kendi_betigi_olan_agac()
        betik = ajan_hook.yetkili_betik({"cwd": str(kok)}, gelistirme=True)
        self.assertIsNotNone(betik)
        self.assertTrue(betik.samefile(kok / "harness/hook/ajan_hook.py"))

    def test_projede_oturumun_acildigi_agacin_kodu_yargictir(self):
        self.assertIsNone(ajan_hook.yetkili_betik({"cwd": str(self._kendi_betigi_olan_agac())}, gelistirme=False))

    def test_kodun_kendi_agacinda_devir_olmaz(self):
        kendi_kok = pathlib.Path(ajan_hook.__file__).resolve().parents[2]
        self.assertIsNone(ajan_hook.yetkili_betik({"cwd": str(kendi_kok)}, gelistirme=True))

    def test_harness_tasimayan_agacta_devir_olmaz(self):
        self.assertIsNone(ajan_hook.yetkili_betik({"cwd": str(depo())}, gelistirme=True))

    def _iskelet(self, gelistirme):
        """Betiğin geçici iskelet kopyası; kipi bu deponun harness.json'u değil, testin yazdığı ayar belirler."""
        kaynak = pathlib.Path(ajan_hook.__file__).resolve().parents[1]
        kok = pathlib.Path(tempfile.mkdtemp(prefix="harness-iskelet-"))
        (kok / "harness/hook").mkdir(parents=True)
        for modul in kaynak.glob("*.py"):
            shutil.copy(modul, kok / "harness" / modul.name)
        shutil.copy(kaynak / "hook/ajan_hook.py", kok / "harness/hook/ajan_hook.py")
        (kok / "harness.json").write_text(json.dumps({**AYAR, "harness_gelistirme": gelistirme}), encoding="utf-8")
        return kok / "harness/hook/ajan_hook.py"

    def _surec(self, kok, gelistirme, **ortam):
        return subprocess.run([sys.executable, str(self._iskelet(gelistirme)), "durus"], capture_output=True,
                              text=True, env=dict(os.environ, **ortam),
                              input=json.dumps({"cwd": str(kok), "session_id": "s1", "stop_hook_active": False}))

    def test_surec_olarak_kosunca_agacin_kendi_betigine_devreder(self):
        self.assertIn("AGACIN-KENDI-KODU durus", self._surec(self._kendi_betigi_olan_agac(), True).stdout)

    def test_devralan_betik_yeniden_devretmez(self):
        r = self._surec(self._kendi_betigi_olan_agac(), True, HARNESS_HOOK_DEVIR="1")
        self.assertNotIn("AGACIN-KENDI-KODU", r.stdout)
        self.assertEqual(r.returncode, 0)

    def test_kip_kapali_iskelette_surec_devretmez(self):
        r = self._surec(self._kendi_betigi_olan_agac(), False)
        self.assertNotIn("AGACIN-KENDI-KODU", r.stdout)
        self.assertEqual(r.returncode, 0)


class Dayaniklilik(unittest.TestCase):
    def test_harness_olmayan_dizinde_hook_sessiz_gecer(self):
        import tempfile
        yabanci = pathlib.Path(tempfile.mkdtemp(prefix="harness-yabanci-"))
        self.assertIsNone(duzenle(yabanci, "a.ts"))

    def test_eksik_girdi_hook_u_dusurmez(self):
        self.assertIsNone(ajan_hook.guvenli_isle("duzenleme-oncesi", {"session_id": "s1"}, {}))

    def test_bozuk_bilgi_tabaninda_push_kapali_kalir(self):
        kok = depo({"harness.json": "{bozuk"}, uret=False)
        self.assertEqual(karar(ajan_hook.guvenli_isle("komut-oncesi", {
            "session_id": "s1", "cwd": str(kok), "tool_input": {"command": "git push"}}, {})), "deny")


if __name__ == "__main__":
    unittest.main(verbosity=1)
