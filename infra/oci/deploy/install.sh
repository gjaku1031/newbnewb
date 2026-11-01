#!/usr/bin/env bash
# oci-dev에서 실행: 배포 파일을 oci-prod에 올리고 타이머를 켠다 (여러 번 실행해도 됨)
#   bash infra/oci/deploy/install.sh
set -euo pipefail
PROD=${PROD:-oci-prod}
HERE=$(cd "$(dirname "$0")" && pwd)

ssh "$PROD" 'install -d -m 700 /srv/newb/deploy'
scp -q "$HERE/compose.yaml" "$HERE/deploy.sh" "$PROD:/srv/newb/deploy/"
scp -q "$HERE/newb-deploy.service" "$HERE/newb-deploy.timer" "$PROD:/tmp/"
ssh "$PROD" 'set -e
  chmod 700 /srv/newb/deploy/deploy.sh
  sudo install -m 644 /tmp/newb-deploy.service /tmp/newb-deploy.timer /etc/systemd/system/
  rm -f /tmp/newb-deploy.service /tmp/newb-deploy.timer
  sudo systemctl daemon-reload
  sudo systemctl enable --now newb-deploy.timer
  systemctl list-timers newb-deploy.timer --no-pager'
