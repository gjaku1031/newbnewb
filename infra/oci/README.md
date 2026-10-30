# OCI 인프라 (Always Free 범위)

newb는 **새 서버를 만들지 않고** 이미 있는 무료 자원을 나눠 씁니다.

| 자원 | 방식 | 무료 한도 |
|---|---|---|
| 앱 서버 | `oci-prod` VM에 컨테이너로 추가 (ken-blog와 같은 Caddy 뒤) | VM 무료 한도(4코어·24GB·200GB)는 이미 다 사용 중 → 새 VM 없음 |
| MySQL | 공용 MySQL `ken-prod`(MySQL.Free, 옛 이름 ken-blog-mysql) **안에** `newb` DB + 전용 사용자 추가 | MySQL.Free는 계정당 1대, 스토리지 50GB를 ken-blog와 공유 |
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
- 사용자 `newb` — TLS 필수, `newb` DB에만 권한
- 접속 정보 → `oci-prod:/srv/newb/newb.env` (권한 600)

다시 실행하면 `newb` 사용자 비밀번호를 새로 바꾸고 파일도 갱신합니다.

## 비밀값 위치

| 파일 | 내용 |
|---|---|
| `oci-dev:~/.config/newb/mysql-admin.env` | MySQL 관리자 아이디·비밀번호 (평소엔 쓰지 않음) |
| `oci-prod:/srv/newb/newb.env` | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DATABASE_URL` |
| `oci-prod:/srv/newb/object-storage.env` | `OCI_AUTH` `OCI_REGION` `OCI_NAMESPACE` `OCI_BUCKET` (비밀값 없음) |

비밀값 파일은 git에 올리지 않습니다 (`.gitignore`에 `*.env`). 앱 컨테이너는 `env_file`로 두 파일을 읽습니다.
