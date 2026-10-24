#!/usr/bin/env bash
# 用 ProofShot 录制一段端到端演示。产物默认在 proofshot-artifacts/ 下。
# 用法：APP_URL=http://host:port bash scripts/proofshot-demo.sh
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
APP_URL="${APP_URL:-http://100.105.144.118:8891}"
WORKDIR="${WORKDIR:-/tmp/ai-factory-proof}"
mkdir -p "$WORKDIR" && cd "$WORKDIR"
rm -rf proofshot-artifacts

proofshot start --force --url "$APP_URL/room-buildout" --description "AI Factory 机房建设 / 集群交付 全链路验收"

p() { proofshot exec "$@" >/dev/null; }
p set viewport 1600 1000
p wait 800
p screenshot 01-room-default.png
p wait 900
p click ".rb-org-chips button:nth-child(2)"
p wait 1000
p screenshot 02-room-past.png
p click ".rb-org-chips button:nth-child(1)"
p wait 600
p fill ".rb-filterbar input[type=search]" "wlby"
p wait 900
p screenshot 03-room-search.png
p click ".rb-room-group .btn"
p wait 1100
p screenshot 04-room-drawer.png
p click ".rb-stage-list li:nth-child(2) .rb-stage-card"
p wait 1000
p screenshot 05-stage-panel.png
p press Escape
p wait 400
p press Escape
p wait 500
p scroll up 1200
p wait 300
p click "[data-request-add]"
p wait 800
p fill "input[name=name]" "ProofShot 演示机房"
p fill "input[name=ko-plan]" "2026-12-01"
p fill "input[name=deploy-estimate]" "2027-01-15"
p fill "input[name=business-side]" "Seed"
p wait 600
p screenshot 06-create-filled.png
p click "form button[type=submit]"
p wait 1400
p screenshot 07-created.png
p wait 3500
p fill ".rb-filterbar input[type=search]" "ProofShot 演示机房"
p wait 900
p click ".rb-room-group .btn"
p wait 1000
p click ".rb-stage-list li:nth-child(4) .rb-stage-card"
p wait 1000
p click ".rb-env-block"
p wait 800
p screenshot 08-env-cycled.png
p wait 3000
p press Escape
p wait 300
p press Escape
p wait 400
p open "$APP_URL/cluster-delivery"
p wait 1500
p screenshot 09-delivery-default.png
p click ".cd-source button:nth-child(2)"
p wait 1000
p screenshot 10-source-new-first.png
p click ".cd-source button:nth-child(1)"
p wait 1200
p click ".cd-cluster-table .cd-cluster-row:nth-child(2)"
p wait 1400
p screenshot 11-cluster-drawer.png
p check ".cd-drawer input[type=checkbox]:not([disabled])"
p wait 1400
p screenshot 12-subitem-checked.png
p click ".cd-stage-acc"
p wait 900
p screenshot 13-stage-expanded.png
p wait 900

proofshot stop
echo "ProofShot 产物：$WORKDIR/proofshot-artifacts/"
