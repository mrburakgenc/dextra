#!/bin/sh
# harness/hook/hook.sh <olay> — Claude Code hook'larının tek giriş noktası.
# İşi ajan_hook.py yapar; girdi stdin'den aynen geçer.
# python3 yoksa hook sessizce geçer: son söz git hook'undadır (harness/hook/git/).
OLAY=${1:-}
DIZIN=$(cd "$(dirname "$0")" && pwd)
if command -v python3 >/dev/null 2>&1; then
  PYTHONDONTWRITEBYTECODE=1 exec python3 "$DIZIN/ajan_hook.py" "$OLAY"
fi
exit 0
