#!/usr/bin/env bash
# newb용 MySQL 세팅 — oci-prod(같은 VCN)에서 실행
#
# 새 MySQL 서버를 만들지 않는다. ken-blog가 쓰는 무료 MySQL(MySQL.Free, 계정당 1대) 안에
#   - 데이터베이스 newb (utf8mb4)
#   - 전용 사용자 newb (TLS 필수, newb DB에만 권한, oci-prod 사설 IP에서만 접속)
# 를 추가한다. 추가 비용 없음, 50GB 스토리지는 ken-blog와 나눠 씀.
#
# MySQL 관리자 아이디·비밀번호를 물어본다 (화면·명령줄·로그에 남기지 않음).
# newb 사용자 비밀번호는 새로 만들어 /srv/newb/newb.env (권한 600)에만 저장한다.
# 다시 실행하면 newb 사용자 비밀번호를 새로 바꾸고 파일도 갱신한다.
#
# 사용 (oci-dev의 레포에서):
#   scp infra/oci/setup-mysql.sh oci-prod:/tmp/ && ssh -t oci-prod bash /tmp/setup-mysql.sh
set -euo pipefail

DB_HOST=${DB_HOST:-10.0.0.47}
DB_PORT=${DB_PORT:-3306}
DB_NAME=${DB_NAME:-newb}
DB_USER=${DB_USER:-newb}
# 접속 허용 위치: ken-blog(kenblog_live)처럼 운영 서버(oci-prod) 사설 IP에서만
DB_USER_HOST=${DB_USER_HOST:-10.0.0.132}
OUT_DIR=${OUT_DIR:-/srv/newb}
OUT="$OUT_DIR/newb.env"
IMG=${MYSQL_IMAGE:-mysql:8.4.11}

command -v docker >/dev/null || { echo "docker가 필요해요" >&2; exit 1; }
docker image inspect "$IMG" >/dev/null 2>&1 || docker pull "$IMG"

read -rp "MySQL 관리자 아이디: " ADMIN_USER
read -rsp "MySQL 관리자 비밀번호: " ADMIN_PW
echo

# 영문·숫자 32자 (URL에 그대로 넣어도 안전)
NEWB_PW=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-32)

# 비밀번호는 docker 명령줄이 아니라 환경변수로만 넘긴다 (ps에 안 보이게)
mysql_as() { # $1=사용자 $2=비밀번호 나머지=mysql 인자
  local u=$1 p=$2; shift 2
  MYSQL_PWD="$p" docker run --rm -i --network host -e MYSQL_PWD "$IMG" \
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$u" --ssl-mode=REQUIRED "$@"
}

echo "▶ ${DB_HOST}:${DB_PORT} 에 ${DB_NAME} DB · ${DB_USER} 사용자 만드는 중"
mysql_as "$ADMIN_USER" "$ADMIN_PW" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_USER_HOST}' IDENTIFIED BY '${NEWB_PW}' REQUIRE SSL;
ALTER USER '${DB_USER}'@'${DB_USER_HOST}' IDENTIFIED BY '${NEWB_PW}' REQUIRE SSL;
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_USER_HOST}';
SQL
unset ADMIN_PW

sudo install -d -m 700 -o "$(id -un)" -g "$(id -gn)" "$OUT_DIR"
umask 077
cat >"$OUT" <<ENV
# newb MySQL — 비밀값, git에 올리지 말 것
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${NEWB_PW}
DATABASE_URL=mysql://${DB_USER}:${NEWB_PW}@${DB_HOST}:${DB_PORT}/${DB_NAME}?ssl=true
ENV
chmod 600 "$OUT"

echo "▶ newb 사용자로 접속 확인"
mysql_as "$DB_USER" "$NEWB_PW" -N -e "SELECT CONCAT('✓ ', CURRENT_USER(), ' → ', DATABASE()); SHOW SESSION STATUS LIKE 'Ssl_version';" "$DB_NAME"
mysql_as "$DB_USER" "$NEWB_PW" -N -e "SHOW GRANTS;" | sed -E "s/IDENTIFIED BY.*//"

echo "✓ 접속 정보 저장 → ${OUT} (권한 600, 화면 출력 안 함)"
