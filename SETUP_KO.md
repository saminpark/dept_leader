# 처음 한 번: GitHub 배포 + Google 문서 연결

## 0. 준비할 것

**저장소 URL, Google 문서 URL, Google Cloud의 웹용 OAuth 클라이언트 ID**가 필요합니다. 기존 문서에 최소 권한으로 접근하려면 Google Picker API 키와 같은 Cloud 프로젝트의 번호도 사용합니다.

개별 웹페이지의 Google 로그인은 ChatGPT에 연결된 Google 계정과 별도의 승인입니다. 이번 제공물에는 로그인 비밀번호·Client Secret·토큰이 들어 있지 않습니다. 실제 문서의 쓰기 테스트는 본인의 계정으로 배포 후 진행합니다.

## 1. 웹페이지 실행

### A. GitHub Pages

1. 회사가 허용한 GitHub 저장소를 선택하거나 새로 만듭니다.
2. ZIP을 풀어 **frand-director-desk 폴더 안의 내용**을 저장소 루트에 올립니다. ZIP 자체만 업로드하지 않습니다.
3. 저장소 `Settings → Pages`에서 Source를 `Deploy from a branch`로 설정합니다.
4. Branch는 `main`(실제 브랜치명), Folder는 `/docs`로 선택하고 저장합니다.
5. Pages 설정에 표시된 HTTPS 주소로 접속합니다.
6. 해당 사이트에서 `연결 설정·백업`으로 이동합니다.

일반적인 Pages 주소 예시는 `https://YOUR_ACCOUNT.github.io/YOUR_REPOSITORY/`입니다. 승인된 OAuth JavaScript 원본에는 **경로 없이 `https://YOUR_ACCOUNT.github.io`**를 등록합니다. 실제 Pages 주소가 다르면 그 원본을 등록합니다.

Pages는 일반적으로 공개이며 저장소를 private으로 해도 사이트 공개 범위를 별도로 확인해야 합니다. 인사·고객 자료를 다루는 용도라면 회사 승인 환경과 전용 원본을 우선 검토하세요. 제공 템플릿과 코드만 배포하고 실제 작업 JSON은 개인 승인 저장소에 보관합니다.

### B. PC에서 먼저 실행

Python 3가 있는 Windows에서는 `start-local.bat`을 더블클릭합니다. 또는 터미널에서:

```bash
python serve.py
```

브라우저에서 `http://localhost:8000`을 엽니다. 서버는 로컬 루프백에만 바인딩하며 `docs/`의 웹 파일만 제공합니다. 서버를 중지하려면 터미널에서 `Ctrl+C`를 누릅니다. 이미 8000번 포트가 사용 중이면 `python serve.py --port 8001`을 사용하고 OAuth 원본에도 변경된 포트를 등록하세요.

단일 HTML을 더블클릭해 `file://`로 열면 업무 편집·백업은 사용하지만 Google 인증은 `localhost` 또는 HTTPS 사이트에서 진행합니다.

## 2. Google Cloud 프로젝트 설정

1. 회사가 허용한 Google Cloud 프로젝트를 선택하거나 생성합니다.
2. API 라이브러리에서 **Google Docs API**를 활성화합니다.
3. 기존 문서 선택기를 쓸 때는 **Google Drive API, Google Picker API**도 활성화합니다.
4. Google Auth Platform(또는 OAuth 동의 화면)에서 앱 이름·지원 연락처·대상을 설정합니다.
5. 회사 내부용은 Workspace의 내부 사용자 설정을 확인합니다. 외부 테스트용은 실제 로그인할 계정을 테스트 사용자로 등록합니다. 조직의 OAuth 앱 통제나 배포 단계에 따라 관리자 승인·검증 절차가 달라질 수 있습니다.
6. 클라이언트 생성에서 유형을 **웹 애플리케이션**으로 선택합니다.
7. **승인된 JavaScript 원본**에 실제 원본을 등록합니다. 예:

```text
http://localhost:8000
https://YOUR_ACCOUNT.github.io
```

경로, 파일명, `#area/...`는 넣지 않습니다. 이 앱은 팝업 토큰 흐름을 사용하며 별도 인증 코드용 리디렉션 서버를 운영하지 않습니다.
8. 생성된 **클라이언트 ID**(`...apps.googleusercontent.com`)를 복사합니다. Client Secret은 이 앱에서 사용하지 않습니다.

## 3. 연결 방식 선택

### 권장: 선택한 파일만 허용 (`drive.file`)

이 앱에서 새로 만든 문서 또는 Google Picker로 사용자가 선택한 문서에 접근하는 방식입니다.

**기존 문서를 사용할 때**

1. 같은 Cloud 프로젝트에서 API 키를 생성합니다.
2. Application restrictions에서 Websites(HTTP referrers)를 선택합니다.
3. 실제 사이트와 Picker iframe 출처를 허용합니다. 예:

```text
http://localhost:8000/*
https://YOUR_ACCOUNT.github.io/*
https://docs.google.com/*
```

4. API restrictions에서 필요한 **Google Picker API**로 제한합니다. 별도 Drive API 호출을 추가한 배포라면 해당 API도 확인합니다.
5. 같은 Cloud 프로젝트의 **프로젝트 번호(숫자)**를 확인합니다. 프로젝트 이름이나 ID 문자열과 구분합니다.
6. 웹페이지의 `연결 설정·백업`에서 클라이언트 ID, API 키, 프로젝트 번호를 입력하고 저장합니다.
7. `Google 권한 연결` → 승인 → `문서 선택`에서 대상 Google 문서를 선택합니다.
8. `문서 확인`으로 선택된 문서 제목을 확인합니다.

기존 문서 URL을 입력하는 것만으로는 `drive.file` 권한이 생기지 않습니다. **문서 선택기로 해당 파일을 선택**해야 합니다. 대상은 편집 권한이 있는 **네이티브 Google 문서**입니다. Drive에 업로드된 Word 파일은 Google 문서로 변환한 뒤 선택하세요.

**새 Google 문서를 만들어도 되는 경우**

클라이언트 ID만 저장하고 `Google 권한 연결` → `새 문서 만들기`를 사용합니다. 이 경로는 Picker 키·프로젝트 번호 입력을 생략할 수 있습니다. 앱이 만든 문서의 URL은 저장 대상에 자동 등록됩니다.

### 선택: 문서 URL 직접 지정 (`documents`)

클라이언트 ID와 문서 URL만으로 연결하지만 **Google Docs 전체 읽기·편집 OAuth 범위**를 요청합니다. 앱 코드는 지정 문서에만 요청해도 권한 범위 자체는 넓습니다. 회사의 승인 정책에 맞는 경우 사용합니다. 연결 방식을 바꾸면 다시 권한을 승인합니다.

## 4. 실제 저장

1. 원하는 업무 영역으로 이동합니다.
2. 상태·담당·기한·진행 메모를 편집하고 `변경 저장`합니다.
3. `구글로 저장하기`를 누릅니다.
4. **대상 문서, 기준일, 완료 업무·메모 포함 여부**를 확인합니다.
5. 미리보기를 확인하고 다시 `구글로 저장하기`를 누릅니다.
6. 저장 확인 후 `Google 저장 기록 → 탭 열기`로 문서 본문을 확인합니다.

한 문서 안에 `[업무 영역] YYYY-MM-DD` 제목의 탭이 생깁니다. 같은 날 새로 저장하면 `(2)`·`(3)`으로 구분합니다. 날짜가 같아도 기존 탭은 보존합니다. 전체 저장은 14개 영역을 각각 새 탭으로 만듭니다.

## 5. 실패·복구

| 증상 | 확인할 것 |
|---|---|
| `origin_mismatch` | 브라우저 현재 원본과 Cloud의 승인 원본을 일치시킵니다. 포트까지 확인합니다. |
| 테스트 사용자/앱 차단 | 앱 대상·테스트 계정·Workspace 관리자 정책을 확인합니다. |
| Picker가 열리지 않음 | Picker API 활성화, 동일 프로젝트의 키/ID/번호, 키의 웹사이트·API 제한, 브라우저 팝업 허용을 확인합니다. |
| 403·404 | 본인 문서 편집 권한, native Docs 여부, `drive.file`에서 해당 문서를 Picker로 선택했는지 확인합니다. |
| 401 | Google 권한 연결을 다시 누릅니다. 토큰은 새로고침 후 유지하지 않습니다. |
| 기존 탭이 생겼지만 본문 저장 불확실 | `Google 저장 기록 → 이전 저장 이어서 확인`으로 원격 상태를 검사합니다. |
| 문서가 다른 사람의 편집으로 변경됨 | 같은 문서의 동시 편집을 끝낸 뒤 대기 기록에서 다시 확인합니다. 저장 요청은 revision 검사를 사용합니다. |
| 탭 수 제한 또는 문서 크기 제한 | 기록 문서를 기간별로 나누고 새 문서를 저장 대상으로 선택합니다. |
| 브라우저 저장 오류 | JSON으로 현재 기록을 내보낸 후 저장소 용량·정책을 확인합니다. |

복구 동작은 원격 상태를 조회한 뒤 실행합니다. 별도 내용이 이미 있는 탭은 자동으로 교체하지 않습니다. `기록 정리`는 로컬 대기 항목만 정리하며 Google 탭을 삭제하지 않습니다.

## 6. 공개 코드와 개인 기록

프로그램 자체에는 팀 계정 관리 서버나 비밀번호 로그인 벽이 없습니다. Google 로그인은 Docs API 권한용입니다. 공개 Pages의 코드와 초기 템플릿은 접근자가 볼 수 있습니다. 실제 입력은 로컬 저장소에 있고 저장 버튼을 누를 때 지정 Google 문서로만 전송합니다. 기기 간 실시간 동기화가 필요한 경우 별도의 인증·저장 계층을 설계해야 합니다.

JSON 백업은 실제 체크 상태·메모·링크를 포함합니다. 직원 평가·고객 계약 등 민감한 내용을 입력했다면 백업 파일과 Google 문서의 공유 대상을 확인하세요. 클라이언트 시크릿, 서비스 계정 키, OAuth 액세스 토큰은 커밋·붙여넣기하지 않습니다.

## 공식 기술 근거 (확인: 2026-10-08)

- Google Docs 문서 탭 생성: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request#AddDocumentTabRequest
- 탭 조회·tabId 지정 쓰기: https://developers.google.com/workspace/docs/api/how-tos/tabs
- Docs API 동시 수정 제어: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate
- Google Picker: https://developers.google.com/workspace/drive/picker/guides/web-picker
- Google Identity 브라우저 토큰 모델: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- GitHub Pages 생성: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

API 동작은 위 공식 문서를 기준으로 구현했습니다. 실제 OAuth 팝업·Picker·실제 문서 쓰기는 사용자의 등록 원본과 계정으로 배포 후 최종 확인해야 합니다.
