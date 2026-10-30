# 공용 MySQL(ken-prod) 재생성 절차 — 2026-10-30 실행 기록

관리자 이름을 잃어버려 새 DB 계정을 만들 수 없을 때의 복구 절차. ken-blog가 약 1시간 20분 멈춘다.

## 왜 필요했나
- OCI MySQL은 관리자 **이름**을 생성 때만 받고 이후 콘솔·API·감사 로그 어디에도 보여주지 않음
- 비밀번호는 OCI CLI로 재설정 가능하지만 이름은 변경 불가
- **백업으로 복원해도 관리자 계정은 원래 것이 유지됨** (새 이름·비밀번호를 줘도 무시) → 결국 빈 서버로 새로 만들어야 함

## 무료 사양(MySQL.Free) 제약
- 계정당 1대 → 기존 서버를 먼저 지워야 새로 만들 수 있음
- 수동 백업 불가, 자동 백업 보관 기간 변경 불가(1일) → **앱 계정으로 논리 덤프를 먼저 떠 둘 것**
- 새로 만들 때 최신 버전만 가능(당시 26.10.0), 백업 정책 지정 불가
- 지운 직후 같은 IP는 몇 분간 사용 중으로 남음 → 풀릴 때까지 기다렸다가 생성

## 순서 (실제로 한 것)
1. 현재 설정 저장: `oci mysql db-system get` → `~/.config/ken-prod/db-system-before.json`
2. ken-blog API 중지: `ssh oci-prod docker stop ken-blog-api-1`
3. 앱 계정으로 덤프: `mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF ken_blog_live`
   → `oci-prod:/srv/ken-blog-live/backups/`, 사본 `~/.config/ken-prod/backups/`
4. 새 관리자 정보를 **먼저 파일에 저장**: `~/.config/ken-prod/mysql-admin.env` (600)
5. 기존 서버 삭제 → 10.0.0.47 해제 대기
6. 새로 생성 (비밀번호는 `--from-json` 파일로만): 같은 서브넷·NSG·IP·구성·장애 도메인, BYOC 인증서, 최신 버전, `source` 없음
7. 관리자로 `ken_blog_live` DB(utf8mb4_0900_ai_ci) + `kenblog_live`@`10.0.0.132`(같은 비밀번호, REQUIRE SSL, 기존과 같은 권한) 생성 → 덤프 넣기 → 테이블별 행 수 확인
8. ken-blog 시작 → `/actuator/health` 200 UP, 외부에서 `/api/v1/pages/snapshot` 200 확인
9. newb DB·계정: `infra/oci/setup-mysql.sh`

## 함정
- **BYOC 인증서 권한**: MySQL이 인증서를 읽는 동적 그룹 규칙이 옛 DB OCID로 고정돼 있으면 새 DB 생성이 `CertificateNotFound`로 실패한다.
  규칙을 `ALL {resource.type = 'mysqldbsystem', resource.compartment.id = '<테넌시>'}`로 바꿈 (정책은 그 인증서 하나만 허용하므로 범위는 좁게 유지됨).
- MySQL 26 비밀번호 정책: 대·소문자·숫자·특수문자가 모두 있어야 함.
- OCI 오류 메시지는 보낸 값(비밀번호 포함)을 그대로 되돌려주므로 로그에 남기기 전에 가릴 것.
