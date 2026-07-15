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
2. `보호된 의미·의도 분류` 노드의 Authentication을 `Predefined Credential Type`으로
   설정하고, Credential Type에서 `OpenAI`를 선택한 뒤 저장한 Credential을 지정한다.
3. Webhook의 Test URL로 안전한 입력, 위험 입력, 우회 입력을 각각 전송한다.
4. 검증이 끝나면 workflow를 활성화하고 Production URL을 `config.js`의
   `SAFETY_REVIEW_URL`과 `RECOMMENDATION_URL`에 설정한다. 두 operation을 같은 webhook이
   처리하므로 같은 Production URL을 사용할 수 있다.
5. 결정·신뢰도·안내·재시도·지연을 기록한다.

게이트웨이는 AI가 게시물을 직접 삭제하지 않도록 설계되어 있다. `held`는 공개 전 게시
보류이며, `manual_review`는 운영자 검토 대상이다. 영구 삭제는 별도 승인 절차가 필요하다.

## 문제 발생 시

에러 메시지 원문, 실행 명령, 관련 파일과 줄, 재현 절차를 함께 기록한다. API key나
개인정보가 포함된 로그는 공유 전에 마스킹한다.
