# 0차시 설치 및 실행 가이드

## 목적

이 문서는 프로젝트를 처음 실행하고, 변경 전후 최소 검증을 수행하기 위한 안내서다.
실제 기능 요구사항과 설계는 [Spec Kit 문서](../specs/001-dongne-gwangjang/spec.md)를 따른다.

## 필요한 도구

- Git
- 현대 브라우저
- Node.js: 문법·평가 스크립트 실행용
- Python 3: 정적 서버 실행용
- n8n: 자동화 workflow를 실제로 재생할 때 선택

외부 패키지는 기본 설치하지 않는다. 필요한 경우 패키지명, 버전, 목적, 보안 영향을
먼저 설명하고 사용자의 승인을 받는다.

## 실행

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 연다. `file://` 직접 열기는 fetch·storage·모듈
동작이 달라질 수 있으므로 검증에는 사용하지 않는다.

## 기본 검증

```bash
node --check main.js
node --check config.js
node tests/evaluate.mjs
node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/activity-safety-and-recommendation.json','utf8')); console.log('workflow: PASS')"
git diff --check
```

## 환경변수와 비밀값

- 브라우저 `config.js`에는 공개 endpoint 주소만 둔다.
- AI provider key, Supabase secret/service key, webhook credential은 n8n/server 환경변수로
  관리한다.
- `.env*`, 로그, credential export는 Git에 추가하지 않는다.
- 테스트·스크린샷·발표 자료에는 실제 사용자 개인정보를 사용하지 않는다.

## n8n 실행

1. n8n에서 `n8n/workflows/activity-safety-and-recommendation.json`을 import한다.
2. `/Users/cw/Downloads/Censorship_Agent`에서 보호된 게이트웨이를 실행한다.
   `OPENAI_API_KEY`, `MODERATION_USE_AI=1`, `MODERATION_GATEWAY_TOKEN`은 쉘 환경변수로만
   설정한다.
3. n8n의 `SAFETY_CLASSIFIER_URL`을 게이트웨이의 `/moderate` 주소로 설정하고,
   n8n에도 같은 `MODERATION_GATEWAY_TOKEN`을 설정한다.
4. `specs/001-dongne-gwangjang/contracts/automation.md`의 입력을 webhook으로 전송한다.
5. 안전한 입력, 위험 입력, 우회 입력, provider 실패 입력을 각각 재생한다.
6. 결정·신뢰도·안내·재시도·지연을 기록한다.

게이트웨이는 AI가 게시물을 직접 삭제하지 않도록 설계되어 있다. `held`는 공개 전 게시
보류이며, `manual_review`는 운영자 검토 대상이다. 영구 삭제는 별도 승인 절차가 필요하다.

## 문제 발생 시

에러 메시지 원문, 실행 명령, 관련 파일과 줄, 재현 절차를 함께 기록한다. API key나
개인정보가 포함된 로그는 공유 전에 마스킹한다.
