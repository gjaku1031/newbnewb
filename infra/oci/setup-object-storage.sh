#!/usr/bin/env bash
# newb용 OCI Object Storage 세팅 — OCI CLI가 설정된 곳(oci-dev 등)에서 실행
#
# 만드는 것 (모두 Always Free 범위: Object Storage 전체 20GB · 월 5만 요청, IAM 무료)
#   1. 버킷 newb-files (비공개)
#   2. 앱 전용 사용자 newb-app + 그룹 newb-app-objects
#   3. 정책: 그 그룹은 newb-files 버킷의 객체만 다룰 수 있음 (ken-blog 버킷 접근 불가)
#   4. newb-app 사용자의 S3 호환 키(Customer Secret Key) → 파일로만 저장, 화면에 출력하지 않음
#
# 여러 번 실행해도 안전 (이미 있으면 건너뜀). 단 S3 키 비밀값은 만들 때 한 번만 받을 수 있어서,
# 키가 이미 있는데 비밀값 파일이 없으면 기존 키를 지우고 다시 실행해야 한다.
#
# 사용:  bash infra/oci/setup-object-storage.sh
#        (비밀값 파일 기본 위치: ~/.config/newb/object-storage.env — 레포 밖)
set -euo pipefail

BUCKET=${BUCKET:-newb-files}
APP_USER=${APP_USER:-newb-app}
GROUP=${GROUP:-newb-app-objects}
POLICY=${POLICY:-newb-app-objects}
OUT=${OUT:-$HOME/.config/newb/object-storage.env}
export SUPPRESS_LABEL_WARNING=True

cfg() { awk -F= -v k="$1" '$1==k {print $2; exit}' "${OCI_CLI_CONFIG_FILE:-$HOME/.oci/config}"; }
TENANCY=${TENANCY:-$(cfg tenancy)}
REGION=${REGION:-$(cfg region)}
NS=$(oci os ns get --query data --raw-output)
# 목록 결과(JSON)에서 첫 id만 — 결과가 비어 있으면 빈 문자열
first() { python3 -I -c 'import sys,json
raw = sys.stdin.read().strip()
d = (json.loads(raw).get("data") or []) if raw else []
print(d[0]["id"] if d else "")'; }

echo "▶ 테넌시 루트 · 리전 ${REGION} · 네임스페이스 ${NS}"

# 1. 버킷
if oci os bucket get -bn "$BUCKET" >/dev/null 2>&1; then
  echo "✓ 버킷 ${BUCKET} 이미 있음"
else
  oci os bucket create -c "$TENANCY" --name "$BUCKET" \
    --public-access-type NoPublicAccess --storage-tier Standard >/dev/null
  echo "✓ 버킷 ${BUCKET} 만듦 (비공개)"
fi

# 2. 앱 전용 사용자
USER_ID=$(oci iam user list -c "$TENANCY" --name "$APP_USER" --all 2>/dev/null | first)
if [ -z "$USER_ID" ]; then
  USER_ID=$(oci iam user create -c "$TENANCY" --name "$APP_USER" \
    --description "newb 앱 전용 (${BUCKET} 버킷만 접근)" --query data.id --raw-output)
  echo "✓ 사용자 ${APP_USER} 만듦"
else
  echo "✓ 사용자 ${APP_USER} 이미 있음"
fi

# 3. 그룹 + 소속
GROUP_ID=$(oci iam group list -c "$TENANCY" --name "$GROUP" --all 2>/dev/null | first)
if [ -z "$GROUP_ID" ]; then
  GROUP_ID=$(oci iam group create -c "$TENANCY" --name "$GROUP" \
    --description "newb 앱: ${BUCKET} 버킷 객체만" --query data.id --raw-output)
  echo "✓ 그룹 ${GROUP} 만듦"
else
  echo "✓ 그룹 ${GROUP} 이미 있음"
fi
if oci iam group list-users --group-id "$GROUP_ID" --all --query 'data[].id' 2>/dev/null | grep -q "$USER_ID"; then
  echo "✓ ${APP_USER} 는 이미 ${GROUP} 소속"
else
  oci iam group add-user --group-id "$GROUP_ID" --user-id "$USER_ID" >/dev/null
  echo "✓ ${APP_USER} → ${GROUP} 추가"
fi

# 4. 정책: 이 버킷만
STATEMENTS=$(python3 -I -c 'import json,sys; g,b=sys.argv[1:3]; print(json.dumps([
  f"Allow group {g} to read buckets in tenancy where target.bucket.name=\x27{b}\x27",
  f"Allow group {g} to manage objects in tenancy where target.bucket.name=\x27{b}\x27",
]))' "$GROUP" "$BUCKET")
POLICY_ID=$(oci iam policy list -c "$TENANCY" --name "$POLICY" --all 2>/dev/null | first)
if [ -z "$POLICY_ID" ]; then
  oci iam policy create -c "$TENANCY" --name "$POLICY" \
    --description "newb 앱: ${BUCKET} 버킷 객체만" --statements "$STATEMENTS" >/dev/null
  echo "✓ 정책 ${POLICY} 만듦 (${BUCKET} 버킷 전용)"
else
  echo "✓ 정책 ${POLICY} 이미 있음"
fi

# 5. S3 호환 키 → 파일로만 저장
KEYS=$(oci iam customer-secret-key list --user-id "$USER_ID" --query 'length(data[?"lifecycle-state"==`ACTIVE`])' --raw-output)
if [ "${KEYS:-0}" != "0" ] && [ -s "$OUT" ]; then
  echo "✓ S3 키 이미 있음 (${OUT})"
elif [ "${KEYS:-0}" != "0" ]; then
  echo "✗ ${APP_USER} 에 S3 키가 이미 있지만 비밀값 파일(${OUT})이 없어요."
  echo "  OCI 콘솔에서 ${APP_USER} 의 Customer Secret Key 를 지우고 다시 실행하세요." >&2
  exit 1
else
  umask 077
  mkdir -p "$(dirname "$OUT")"
  oci iam customer-secret-key create --user-id "$USER_ID" --display-name "newb-object-storage" \
    --query 'data.{id:id,key:key}' 2>/dev/null |
    python3 -I -c '
import json, sys
d = json.load(sys.stdin)
ns, region, bucket, out = sys.argv[1:5]
with open(out, "w") as f:
    f.write(f"""# newb Object Storage (S3 호환) — 비밀값, git에 올리지 말 것
S3_ENDPOINT=https://{ns}.compat.objectstorage.{region}.oraclecloud.com
S3_REGION={region}
S3_BUCKET={bucket}
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID={d["id"]}
S3_SECRET_ACCESS_KEY={d["key"]}
""")
' "$NS" "$REGION" "$BUCKET" "$OUT"
  chmod 600 "$OUT"
  echo "✓ S3 키 만듦 → ${OUT} (권한 600, 화면 출력 안 함)"
  echo "  새 키는 적용까지 1~2분 걸릴 수 있어요."
fi

echo
echo "다음: 운영 서버로 복사"
echo "  scp ${OUT} oci-prod:/srv/newb/object-storage.env && ssh oci-prod chmod 600 /srv/newb/object-storage.env"
