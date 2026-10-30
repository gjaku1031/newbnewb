#!/usr/bin/env bash
# newb 인프라를 한 번에 세팅 — oci-dev(OCI CLI·oci-prod SSH 설정된 곳)의 레포에서 실행
#
#   1. MySQL 관리자 비밀번호 재설정 (OCI CLI) → ~/.config/newb/mysql-admin.env 에만 저장
#      · ken-blog는 앱 계정(kenblog_live)으로 접속해서 영향 없음
#      · 이미 mysql-admin.env 가 있으면 재설정하지 않고 그 값을 씀
#   2. oci-prod에서 newb DB + 전용 계정 newb 생성 → oci-prod:/srv/newb/newb.env
#   3. Object Storage 버킷 newb-files + 서버 인증(oci-prod만, 이 버킷만) → oci-prod:/srv/newb/object-storage.env (비밀값 없음)
#
# 비밀값은 화면·명령줄·git에 남기지 않는다. 여러 번 실행해도 안전.
#
# 사용:  bash infra/oci/bootstrap.sh
#        ADMIN_USER=다른이름 bash infra/oci/bootstrap.sh   (관리자 계정 이름이 admin이 아닐 때 — 이름은 바꿀 수 없고 로그인에만 씀)
set -euo pipefail
cd "$(dirname "$0")"

CONF="$HOME/.config/newb"
ADMIN_ENV="$CONF/mysql-admin.env"
DB_SYSTEM_NAME=${DB_SYSTEM_NAME:-ken-prod}
ADMIN_USER_GIVEN=${ADMIN_USER:-}
ADMIN_USER=${ADMIN_USER:-admin}
PROD=${PROD:-oci-prod}
export SUPPRESS_LABEL_WARNING=True
umask 077
mkdir -p "$CONF"
chmod 700 "$CONF"

cfg() { awk -F= -v k="$1" '$1==k {print $2; exit}' "${OCI_CLI_CONFIG_FILE:-$HOME/.oci/config}"; }
TENANCY=$(cfg tenancy)

# ───────── 1. 관리자 비밀번호 ─────────
if [ -s "$ADMIN_ENV" ]; then
  echo "✓ 관리자 정보 있음 (${ADMIN_ENV}) — 재설정 건너뜀"
else
  DB_ID=$(oci mysql db-system list -c "$TENANCY" --lifecycle-state ACTIVE --all \
    --query "data[?\"display-name\"=='${DB_SYSTEM_NAME}'].id | [0]" --raw-output)
  [ -n "$DB_ID" ] && [ "$DB_ID" != "null" ] || { echo "✗ ${DB_SYSTEM_NAME} 를 찾지 못했어요" >&2; exit 1; }

  # OCI 규칙: 8~32자, 숫자·소문자·대문자·특수문자 각 1개 이상
  PW=$(python3 -I -c '
import secrets, string
sp = "!#%^*-_=+"
while True:
    p = "".join(secrets.choice(string.ascii_letters + string.digits + sp) for _ in range(32))
    if any(c.isdigit() for c in p) and any(c.islower() for c in p) and any(c.isupper() for c in p) and any(c in sp for c in p):
        print(p); break')

  echo "▶ ${DB_SYSTEM_NAME} 관리자 비밀번호 재설정 (계정 이름은 그대로)"
  # 비밀번호를 명령줄에 넣지 않도록 JSON 파일로 전달.
  # OCI는 관리자 이름 변경을 지원하지 않고, 이름·비밀번호를 한 번에 바꿀 수도 없어서 비밀번호만 보낸다.
  REQ=$(mktemp)
  ERR=$(mktemp)
  trap 'rm -f "$REQ" "$ERR"' EXIT
  python3 -I -c 'import json,sys; print(json.dumps({"dbSystemId":sys.argv[1],"adminPassword":sys.argv[2]}))' \
    "$DB_ID" "$PW" >"$REQ"
  if ! oci mysql db-system update --from-json "file://$REQ" --force >/dev/null 2>"$ERR"; then
    # OCI 오류 메시지가 보낸 값을 그대로 되돌려주므로 비밀번호를 가리고 출력
    PW="$PW" python3 -I -c '
import os, re, sys
t = open(sys.argv[1]).read().replace(os.environ["PW"], "<가림>")
print(re.sub(r"value = \{[^}]*\}", "value = {<가림>}", t), file=sys.stderr)' "$ERR"
    exit 1
  fi
  rm -f "$REQ" "$ERR"

  printf 'MYSQL_ADMIN_USER=%s\nMYSQL_ADMIN_PASSWORD=%s\nMYSQL_HOST=10.0.0.47\nMYSQL_PORT=3306\n' "$ADMIN_USER" "$PW" >"$ADMIN_ENV"
  chmod 600 "$ADMIN_ENV"
  unset PW

  printf "  적용 기다리는 중"
  for _ in $(seq 1 60); do
    sleep 10
    st=$(oci mysql db-system get --db-system-id "$DB_ID" --query 'data."lifecycle-state"' --raw-output)
    printf "."
    [ "$st" = "ACTIVE" ] && break
  done
  echo
  [ "$st" = "ACTIVE" ] || { echo "✗ 10분 안에 ACTIVE가 되지 않았어요 (지금: ${st})" >&2; exit 1; }
  echo "✓ 관리자 비밀번호 재설정 → ${ADMIN_ENV} (권한 600)"
fi

# ───────── 2. MySQL: newb DB + 전용 계정 ─────────
echo "▶ ${PROD}: newb DB · 전용 계정"
# shellcheck disable=SC1090
. "$ADMIN_ENV"
# 실행할 때 ADMIN_USER를 직접 줬으면 그 이름으로 로그인하고 파일도 갱신
if [ -n "$ADMIN_USER_GIVEN" ] && [ "$ADMIN_USER_GIVEN" != "$MYSQL_ADMIN_USER" ]; then
  MYSQL_ADMIN_USER=$ADMIN_USER_GIVEN
  sed -i "s/^MYSQL_ADMIN_USER=.*/MYSQL_ADMIN_USER=${MYSQL_ADMIN_USER}/" "$ADMIN_ENV"
  echo "✓ 관리자 계정 이름 → ${MYSQL_ADMIN_USER}"
fi
scp -q setup-mysql.sh "${PROD}:/tmp/newb-setup-mysql.sh"
# 관리자 정보는 표준입력으로만 넘김 (원격 명령줄에 안 남음)
printf '%s\n%s\n' "$MYSQL_ADMIN_USER" "$MYSQL_ADMIN_PASSWORD" |
  ssh "$PROD" 'bash /tmp/newb-setup-mysql.sh; rc=$?; rm -f /tmp/newb-setup-mysql.sh; exit $rc'
unset MYSQL_ADMIN_PASSWORD

# ───────── 3. Object Storage (서버 인증, 비밀키 없음) ─────────
PROD="$PROD" bash setup-object-storage.sh

echo
echo "완료. 비밀값 위치:"
echo "  ${ADMIN_ENV}                (oci-dev, MySQL 관리자 — 평소엔 안 씀)"
echo "  ${PROD}:/srv/newb/newb.env          (앱 DB 접속)"
echo "  ${PROD}:/srv/newb/object-storage.env (버킷 위치, 비밀값 없음)"
