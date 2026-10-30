#!/usr/bin/env bash
# newb용 OCI Object Storage 세팅 — 서버 인증(Instance Principal), 비밀키 없음
# OCI CLI와 oci-prod SSH가 설정된 곳(oci-dev)에서 실행
#
# 만드는 것 (모두 Always Free: Object Storage 전체 20GB · 월 5만 요청, IAM 무료)
#   1. 버킷 newb-files (비공개)
#   2. 동적 그룹 newb-prod — oci-prod 인스턴스 하나만
#   3. 정책 newb-prod-objects — 그 서버는 newb-files 버킷의 객체만 다룸 (ken-blog 버킷 접근 불가)
#   4. oci-prod:/srv/newb/object-storage.env — 버킷 위치 정보 (비밀값 없음)
#
# 앱은 비밀키 없이 OCI SDK의 Instance Principal 인증으로 버킷을 쓴다.
# 여러 번 실행해도 안전 (이미 있으면 건너뜀).
#
# 사용:  bash infra/oci/setup-object-storage.sh
set -euo pipefail

BUCKET=${BUCKET:-newb-files}
DGROUP=${DGROUP:-newb-prod}
POLICY=${POLICY:-newb-prod-objects}
PROD=${PROD:-oci-prod}
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

echo "▶ 리전 ${REGION} · 네임스페이스 ${NS}"

# 1. 버킷
if oci os bucket get -bn "$BUCKET" >/dev/null 2>&1; then
  echo "✓ 버킷 ${BUCKET} 이미 있음"
else
  oci os bucket create -c "$TENANCY" --name "$BUCKET" \
    --public-access-type NoPublicAccess --storage-tier Standard >/dev/null
  echo "✓ 버킷 ${BUCKET} 만듦 (비공개)"
fi

# 2. 동적 그룹: oci-prod 인스턴스 하나
INSTANCE_ID=$(ssh -o BatchMode=yes "$PROD" 'curl -s -H "Authorization: Bearer Oracle" http://169.254.169.254/opc/v2/instance/id')
case "$INSTANCE_ID" in ocid1.instance.*) ;; *) echo "✗ ${PROD} 인스턴스 ID를 읽지 못했어요" >&2; exit 1 ;; esac
if [ -n "$(oci iam dynamic-group list -c "$TENANCY" --name "$DGROUP" --all 2>/dev/null | first)" ]; then
  echo "✓ 동적 그룹 ${DGROUP} 이미 있음"
else
  oci iam dynamic-group create -c "$TENANCY" --name "$DGROUP" \
    --description "newb 운영 서버(${PROD}) 인스턴스" \
    --matching-rule "Any {instance.id = '${INSTANCE_ID}'}" >/dev/null
  echo "✓ 동적 그룹 ${DGROUP} 만듦 (${PROD}만)"
fi

# 3. 정책: 이 버킷만
STATEMENTS=$(python3 -I -c 'import json,sys; g,b=sys.argv[1:3]; print(json.dumps([
  f"Allow dynamic-group {g} to read buckets in tenancy where target.bucket.name=\x27{b}\x27",
  f"Allow dynamic-group {g} to manage objects in tenancy where target.bucket.name=\x27{b}\x27",
]))' "$DGROUP" "$BUCKET")
if [ -n "$(oci iam policy list -c "$TENANCY" --name "$POLICY" --all 2>/dev/null | first)" ]; then
  echo "✓ 정책 ${POLICY} 이미 있음"
else
  oci iam policy create -c "$TENANCY" --name "$POLICY" \
    --description "newb 운영 서버: ${BUCKET} 버킷 객체만" --statements "$STATEMENTS" >/dev/null
  echo "✓ 정책 ${POLICY} 만듦 (${BUCKET} 버킷 전용)"
fi

# 4. 운영 서버에 버킷 위치 정보 (비밀값 없음)
ssh -o BatchMode=yes "$PROD" "sudo install -d -m 700 -o \$(id -un) -g \$(id -gn) /srv/newb && umask 077 && cat > /srv/newb/object-storage.env" <<ENV
# newb Object Storage — 서버 인증(Instance Principal), 비밀키 없음
OCI_AUTH=instance_principal
OCI_REGION=${REGION}
OCI_NAMESPACE=${NS}
OCI_BUCKET=${BUCKET}
ENV
echo "✓ ${PROD}:/srv/newb/object-storage.env 저장"
