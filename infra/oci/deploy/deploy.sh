#!/usr/bin/env bash
# newb 배포 (oci-prod에서 실행). systemd 타이머가 2분마다 부른다.
#   deploy.sh            ghcr.io/gjaku1031/newbnewb:main 이 바뀌었으면 배포
#   deploy.sh <이미지>    지정한 이미지로 배포 (수동 배포·되돌리기)
# 순서: 이미지 받기 → 마이그레이션 → 컨테이너 교체 → 상태 확인 → 실패하면 이전 이미지로 되돌림
set -euo pipefail

DIR=/srv/newb/deploy
IMAGE=${1:-ghcr.io/gjaku1031/newbnewb:main}
CURRENT_FILE=$DIR/current
HISTORY=$DIR/history.log

cd "$DIR"
# 타이머와 수동 실행이 겹치지 않게
exec 9>"$DIR/.lock"
flock -n 9 || { echo "다른 배포가 진행 중이에요"; exit 0; }

log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$HISTORY"; }

# 레지스트리 이미지면 받아 오고 digest로 고정한다 (로컬에서 load한 이미지는 그대로)
if [[ "$IMAGE" == */* ]]; then
  if ! err=$(docker pull -q "$IMAGE" 2>&1 >/dev/null); then
    # main 이미지가 아직 없으면 조용히 끝낸다 (권한 오류 등은 실패로 남김)
    if [[ "$err" == *"manifest unknown"* || "$err" == *"not found"* ]]; then
      echo "아직 이미지가 없어요: $IMAGE"
      exit 0
    fi
    echo "이미지를 받지 못했어요: $err" >&2
    exit 1
  fi
  NEW=$(docker image inspect --format '{{index .RepoDigests 0}}' "$IMAGE")
else
  NEW=$IMAGE
fi
CUR=$(cat "$CURRENT_FILE" 2>/dev/null || true)

if [[ "$NEW" == "$CUR" && -z "${1:-}" ]]; then
  exit 0
fi

up() {
  NEWB_IMAGE="$1" docker compose -f "$DIR/compose.yaml" up -d --wait --wait-timeout 120
}

log "배포 시작: ${CUR:-없음} → $NEW"

# 마이그레이션 (새 스키마는 이전 코드와도 맞게 — 칸을 지우는 변경은 코드가 먼저 안 쓰게 한 뒤에)
if ! docker run --rm --env-file /srv/newb/newb.env "$NEW" node migrate.cjs; then
  log "실패: 마이그레이션 — 배포 중단 (컨테이너는 그대로)"
  exit 1
fi

if up "$NEW"; then
  echo "$NEW" >"$CURRENT_FILE"
  log "완료: $NEW"
  # 쓰지 않는 예전 이미지 정리 (최근 것은 되돌리기용으로 남김)
  docker image prune -f --filter "until=168h" >/dev/null || true
  exit 0
fi

log "실패: 새 컨테이너가 정상 상태가 되지 않음"
docker compose -f "$DIR/compose.yaml" logs --tail 50 app || true
if [[ -n "$CUR" ]]; then
  if up "$CUR"; then log "되돌림: $CUR"; else log "되돌리기도 실패: $CUR"; fi
fi
exit 1
