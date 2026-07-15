# 0차시 설치 및 실행 가이드

## 목적

이 문서는 프로젝트를 처음 실행하고, 변경 전후 최소 검증을 수행하기 위한 안내서다.
실제 기능 요구사항과 설계는 [Spec Kit 문서](../specs/001-dongne-gwangjang/spec.md)를 따른다.

## 필요한 도구

- Git
- 현대 브라우저
- Node.js: 문법·평가 스크립트 실행용
- Python 3: 정적 서버 실행용
- Vercel: 정적 화면과 `/api/automation` 서버리스 함수 배포

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
node --check api/automation.js
node tests/evaluate.mjs
git diff --check
```

## 환경변수와 비밀값

- 브라우저 `config.js`에는 공개 endpoint 주소만 둔다.
- `OPENAI_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`는 Vercel 서버 환경변수로
  관리한다.
- `LANGFUSE_TRACING_ENVIRONMENT=production`과 필요 시 `LANGFUSE_BASE_URL`도 Vercel에 등록한다.
- `.env*`, 로그, credential export는 Git에 추가하지 않는다.
- 테스트·스크린샷·발표 자료에는 실제 사용자 개인정보를 사용하지 않는다.

## Vercel AI endpoint 실행

1. Vercel Project Settings → Environment Variables에 `.env.example`의 서버 변수를 등록한다.
2. `deploy/vercel` 브랜치를 배포하고 `/api/automation`의 정상·거절 요청을 확인한다.
3. Langfuse Dashboard에서 `dongne-gwangjang-safety_review` 또는
   `dongne-gwangjang-recommend` Trace를 확인한다.
4. 결정·신뢰도·안내·지연·모델 사용량이 Langfuse에 기록되는지 확인한다.

서버 함수는 AI가 게시물을 직접 삭제하지 않도록 설계되어 있다. `held`는 공개 전 게시
보류이며, `manual_review`는 운영자 검토 대상이다. 영구 삭제는 별도 승인 절차가 필요하다.

## 문제 발생 시

에러 메시지 원문, 실행 명령, 관련 파일과 줄, 재현 절차를 함께 기록한다. API key나
개인정보가 포함된 로그는 공유 전에 마스킹한다.
