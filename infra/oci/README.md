# OCI 인프라 (Always Free 범위)

newb는 **새 서버를 만들지 않고** 이미 있는 무료 자원을 나눠 씁니다.

| 자원 | 방식 | 무료 한도 |
|---|---|---|
| 앱 서버 | `oci-prod` VM에 컨테이너로 추가 (ken-blog와 같은 Caddy 뒤) | VM 무료 한도(4코어·24GB·200GB)는 이미 다 사용 중 → 새 VM 없음 |
| MySQL | 공용 MySQL `ken-prod`(MySQL.Free, 26.10.0) **안에** `newb` DB + 전용 사용자 추가 — 관리자 `kenadmin` | MySQL.Free는 계정당 1대, 스토리지 50GB를 ken-blog와 공유 |
| 파일 저장 | Object Storage 버킷 `newb-files` (비공개) + **서버 인증**(비밀키 없음) | Object Storage 전체 20GB · 월 5만 요청 (ken-blog 버킷과 합산) |

## 한 번에 실행 — `bootstrap.sh` (권장)

oci-dev의 레포에서 실행합니다. 아래 1·2번을 차례로 실행하고, MySQL 관리자 비밀번호가 없으면 **OCI CLI로 재설정**합니다
(ken-blog는 앱 계정 `kenblog_live`로 접속해서 영향 없음). 관리자 계정 이름이 `admin`이 아니면 `ADMIN_USER=이름`을 붙이세요.

```bash
bash infra/oci/bootstrap.sh
```

## 1. Object Storage — `setup-object-storage.sh`

OCI CLI와 oci-prod SSH가 설정된 곳(oci-dev)에서 실행합니다. **비밀키를 만들지 않습니다.**

```bash
bash infra/oci/setup-object-storage.sh
```

만드는 것
- 버킷 `newb-files` (비공개)
- 동적 그룹 `newb-prod`: oci-prod 인스턴스 하나만
- 정책 `newb-prod-objects`: 그 서버는 **newb-files 버킷의 객체만** 읽기·쓰기 (ken-blog 버킷은 접근 거부 — 확인함)
- `oci-prod:/srv/newb/object-storage.env`: `OCI_AUTH=instance_principal` `OCI_REGION` `OCI_NAMESPACE` `OCI_BUCKET` (비밀값 없음)

앱은 OCI SDK의 Instance Principal 인증으로 버킷을 씁니다. 키가 없어서 유출될 것도 없습니다.
(이 계정은 Identity Domain이라 IAM 사용자를 만들려면 이메일이 필수 → 사용자·키 방식 대신 서버 인증을 택함)

## 2. MySQL — `setup-mysql.sh`

DB(10.0.0.47, VCN 내부)에 닿는 `oci-prod`에서 실행합니다. **MySQL 관리자 아이디·비밀번호를 직접 입력**해야 해요.

```bash
scp infra/oci/setup-mysql.sh oci-prod:/tmp/
ssh -t oci-prod bash /tmp/setup-mysql.sh
```

만드는 것
- 데이터베이스 `newb` (utf8mb4)
- 사용자 `newb` — TLS 필수, `newb` DB에만 권한, oci-prod(10.0.0.132)에서만 접속 (ken-blog 계정과 같은 방식)
- 접속 정보 → `oci-prod:/srv/newb/newb.env` (권한 600)

다시 실행하면 `newb` 사용자 비밀번호를 새로 바꾸고 파일도 갱신합니다.

## 비밀값 위치

| 파일 | 내용 |
|---|---|
| `oci-dev:~/.config/ken-prod/mysql-admin.env` | 공용 MySQL 관리자 `kenadmin` (평소엔 쓰지 않음, 설명은 같은 폴더 README.txt) |
| `oci-prod:/srv/newb/newb.env` | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DATABASE_URL` |
| `oci-prod:/srv/newb/object-storage.env` | `OCI_AUTH` `OCI_REGION` `OCI_NAMESPACE` `OCI_BUCKET` (비밀값 없음) |
| `oci-prod:/srv/newb/anthropic.env` | `ANTHROPIC_API_KEY` (선택 `CLAUDE_MODEL`) — Claude Console에서 발급한 키를 직접 넣는다 (권한 600) |

비밀값 파일은 git에 올리지 않습니다 (`.gitignore`에 `*.env`). 앱 컨테이너는 `env_file`로 세 파일을 읽습니다.

### Claude API 키 넣기

키는 화면·로그·셸 기록에 남지 않게 표준 입력으로 받습니다. 배포가 ubuntu 사용자로 돌기 때문에 파일도 ubuntu 소유(600)여야 합니다. oci-dev에서:

```bash
ssh -t oci-prod 'umask 077 && read -rsp "ANTHROPIC_API_KEY: " k && echo && printf "ANTHROPIC_API_KEY=%s\n" "$k" > /srv/newb/anthropic.env'
```

넣은 뒤 같은 이미지로 다시 띄우면 적용됩니다.

```bash
ssh oci-prod '/srv/newb/deploy/deploy.sh "$(cat /srv/newb/deploy/current)"'
```

키가 없으면 앱은 규칙 기반 처리기로 동작합니다 (설정 → Claude API에서 상태 확인).

## 3. 배포 (CI/CD) — `deploy/`

```
git push (main) ─▶ GitHub Actions: 린트·타입·테스트·빌드·e2e ─▶ arm64 이미지 → ghcr.io/gjaku1031/newbnewb:main
                                                                      │ (2분마다 확인)
oci-prod: newb-deploy.timer ─▶ deploy.sh: 받기 → 마이그레이션 → 교체 → 상태 확인 ─┘ 실패하면 이전 이미지로 되돌림
```

- GitHub에서 서버로 들어오는 접속이 없습니다. 서버가 새 이미지를 **가져갑니다** (SSH 키·Tailscale 키를 GitHub에 두지 않음).
- 외부 접속은 Caddy(`newb.maekr.cloud`)를 거치고, 서버 안 확인용으로 `127.0.0.1:18090`도 열려 있습니다. 이미지는 digest로 고정해 `/srv/newb/deploy/current`에 기록합니다.
- 기록: `/srv/newb/deploy/history.log`, 타이머 로그: `journalctl -u newb-deploy`

| 파일 | 위치 | 역할 |
|---|---|---|
| `compose.yaml` | `/srv/newb/deploy/` | 운영 컨테이너 (env_file 3개, 헬스체크 `/api/health`, 메모리 768MB) |
| `deploy.sh` | `/srv/newb/deploy/` | 배포·되돌리기. `deploy.sh <이미지>`로 수동 배포 |
| `newb-deploy.service` · `.timer` | `/etc/systemd/system/` | 2분마다 `deploy.sh` 실행 |

설치·갱신 (oci-dev에서, 여러 번 실행해도 됨):

```bash
bash infra/oci/deploy/install.sh
```

되돌리기: `history.log`에서 이전 이미지를 골라 `ssh oci-prod /srv/newb/deploy/deploy.sh <이미지>`.
타이머가 다음 main 이미지에서 다시 앞으로 가므로, 오래 멈추려면 `sudo systemctl stop newb-deploy.timer`.

### 외부 공개 — ken-blog의 Caddy 재사용 (2026-11-01 연결)

`https://newb.maekr.cloud` — oci-prod의 80/443은 ken-blog 스택의 Caddy(`ken-blog-caddy-1`, 설정 `/srv/ken-blog-live/deploy/Caddyfile`)가 받고 있어 새 Caddy 없이 여기에 붙였습니다.

1. Cloudflare DNS: `newb.maekr.cloud` A → `158.101.158.194` (**DNS only**, 인증서는 Caddy가 Let's Encrypt에서 발급·갱신).
   토큰은 이 컴퓨터의 `~/.config/cloudflare/env`(`CF_API_TOKEN`), 레코드는 Cloudflare API로 만듦.
2. newb 컨테이너는 Caddy 네트워크(`ken-blog_default`, external)에 별칭 `newb`로 붙음 — `deploy/compose.yaml`의 `networks`.
3. Caddyfile 맨 끝의 newb 블록 (백업: `Caddyfile.bak-20261101T055047Z-before-newb`):
   ```
   newb.maekr.cloud {
   	encode zstd gzip
   	reverse_proxy newb:3000
   }
   ```
   - ken-blog의 Caddyfile은 **자동 배포 대상이 아니라 서버에서 직접 관리**합니다(ken-blog `deploy/API-RELEASE.md`). ken-blog 저장소의 Caddyfile로 서버 파일을 덮어쓰면 이 블록이 사라지니, 그때 다시 붙여야 합니다.
   - 고칠 때: 파일은 bind mount라 **같은 파일에 써야** 함(`sed -i`처럼 새 파일로 바꾸면 컨테이너가 옛 파일을 봄) → 검증 → 무중단 리로드
     `docker exec ken-blog-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
     `docker exec ken-blog-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`
   - 내리기: 블록을 지우고 리로드 (newb 컨테이너는 그대로 둬도 외부에서 안 보임).
4. 운영 빌드는 Passkey 로그인 전까지 **항상 비로그인**이라 "로그인이 필요해요" 화면만 나오고 데이터는 나가지 않습니다(`/api/workspace` 401).

## 2026-10-30 공용 MySQL 재생성 기록

관리자 계정 이름을 아무도 몰라서(OCI는 생성 후 관리자 이름을 보여주지 않음) DB 서버를 새로 만들었다. 자세한 절차: [rebuild-ken-prod.md](rebuild-ken-prod.md)

- 결과: `ken-prod` · MySQL 26.10.0 · 같은 IP 10.0.0.47 · 같은 TLS 인증서(BYOC) · 관리자 `kenadmin`
- ken-blog: 18:22~19:42 UTC 중단, 18:22 덤프로 데이터 복구, 계정 `kenblog_live`는 같은 비밀번호·접속 위치·권한으로 재생성 → 정상
