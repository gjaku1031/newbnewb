# OCI 인프라 (Always Free 범위)

newb는 **새 서버를 만들지 않고** 이미 있는 무료 자원을 나눠 씁니다.

| 자원 | 방식 | 무료 한도 |
|---|---|---|
| 앱 서버 | `oci-prod` VM에 컨테이너로 추가 (ken-blog와 같은 Caddy 뒤) | VM 무료 한도(4코어·24GB·200GB)는 이미 다 사용 중 → 새 VM 없음 |
| MySQL | ken-blog가 쓰는 `ken-blog-mysql`(MySQL.Free) **안에** `newb` DB + 전용 사용자 추가 | MySQL.Free는 계정당 1대, 스토리지 50GB를 ken-blog와 공유 |
| 파일 저장 | Object Storage 버킷 `newb-files` (비공개, S3 호환 API) | Object Storage 전체 20GB · 월 5만 요청 (ken-blog 버킷과 합산) |

## 한 번에 실행 — `bootstrap.sh` (권장)

oci-dev의 레포에서 실행합니다. 아래 1·2번을 차례로 실행하고, MySQL 관리자 비밀번호가 없으면 **OCI CLI로 재설정**합니다
(ken-blog는 앱 계정 `kenblog_live`로 접속해서 영향 없음). 관리자 계정 이름이 `admin`이 아니면 `ADMIN_USER=이름`을 붙이세요.

```bash
bash infra/oci/bootstrap.sh
```

## 1. Object Storage — `setup-object-storage.sh`

OCI CLI가 설정된 곳(oci-dev)에서 실행합니다.

```bash
bash infra/oci/setup-object-storage.sh
```

만드는 것
- 버킷 `newb-files` (비공개)
- 앱 전용 사용자 `newb-app` + 그룹 `newb-app-objects`
- 정책 `newb-app-objects`: **newb-files 버킷의 객체만** 읽기·쓰기 (ken-blog 버킷 접근 불가)
- `newb-app`의 S3 호환 키 → `~/.config/newb/object-storage.env` (권한 600, 화면 출력 없음)

운영 서버로 복사

```bash
scp ~/.config/newb/object-storage.env oci-prod:/srv/newb/object-storage.env
```

## 2. MySQL — `setup-mysql.sh`

DB(10.0.0.47, VCN 내부)에 닿는 `oci-prod`에서 실행합니다. **MySQL 관리자 아이디·비밀번호를 직접 입력**해야 해요.

```bash
scp infra/oci/setup-mysql.sh oci-prod:/tmp/
ssh -t oci-prod bash /tmp/setup-mysql.sh
```

만드는 것
- 데이터베이스 `newb` (utf8mb4)
- 사용자 `newb` — TLS 필수, `newb` DB에만 권한
- 접속 정보 → `oci-prod:/srv/newb/newb.env` (권한 600)

다시 실행하면 `newb` 사용자 비밀번호를 새로 바꾸고 파일도 갱신합니다.

## 비밀값 위치

| 파일 | 내용 |
|---|---|
| `oci-dev:~/.config/newb/mysql-admin.env` | MySQL 관리자 아이디·비밀번호 (평소엔 쓰지 않음) |
| `oci-prod:/srv/newb/newb.env` | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DATABASE_URL` |
| `oci-prod:/srv/newb/object-storage.env` | `S3_ENDPOINT` `S3_REGION` `S3_BUCKET` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` `S3_FORCE_PATH_STYLE` |

둘 다 git에 올리지 않습니다 (`.gitignore`에 `*.env`). 앱 컨테이너는 `env_file`로 두 파일을 읽습니다.
