# n8n 자동화

## 목적

이 디렉터리는 동네 광장의 평가기준용 자동화 workflow를 보관한다. 핵심 흐름은 다음과
같다.

`Webhook → 입력 검증 → 개인정보 최소화 → (추천: 활동 근거 검색/RAG) → 의미·의도 분류 → 승인/보류/수동검토 분기 → 응답`

## 파일

- `workflows/activity-safety-and-recommendation.json`: n8n import용 workflow
- `../specs/001-dongne-gwangjang/contracts/automation.md`: 입력·출력 계약
- `/Users/cw/Downloads/Censorship_Agent/scripts/run_server.py`: 외부 서버 연동이 필요한
  경우 사용할 수 있는 규칙 + AI 문맥 분류 게이트웨이

추천 operation의 운영 경로는 현재 모집 중인 활동만 지식원으로 사용한다. 활동 데이터의
인제스션·임베딩·top-k 검색은 보호된 endpoint 또는 벡터 DB 경계 안에서 수행하고, 브라우저에는
검색된 활동의 식별자·추천 이유만 반환한다. 로컬에서는 브라우저의 결정적 grounded fallback을
사용하며 실제 RAG 호출로 가장하지 않는다.

## 운영 규칙

- provider credential은 n8n Credential store에만 둔다.
- 기본 workflow는 n8n의 `HTTP Request` 노드에서 `OpenAI` predefined credential을 사용해
  OpenAI Chat Completions API를 호출한다. API 키는 workflow JSON, 브라우저 `config.js`,
  Git에 들어가지 않는다.
- 별도 Censorship_Agent 게이트웨이를 사용할 때만 `SAFETY_CLASSIFIER_URL`과
  `MODERATION_GATEWAY_TOKEN` 방식을 사용한다.
- 분류 실패·낮은 신뢰도·응답 형식 오류는 `manual_review`로 처리한다.
- workflow 변경 후 safe/direct/obfuscated/failure 4개 입력을 재생한다.
- 실제 운영 전에는 운영자 검토 큐와 보존·삭제 정책을 별도로 확정한다.

## Censorship_Agent 로컬 실행

외부 저장소에서 다음처럼 실행한다. 키는 쉘 환경변수에 직접 입력하고 파일에 저장하지
않는다.

```bash
export OPENAI_API_KEY='<강사님이 발급한 키>'
export MODERATION_USE_AI=1
export MODERATION_GATEWAY_TOKEN='<n8n과 공유할 임시 토큰>'
python3 scripts/run_server.py
```

게이트웨이는 기본적으로 `http://127.0.0.1:8787/moderate`에서 `safety_review`만 받는다.
AI 호출에 실패하면 승인하지 않고 `manual_review` 또는 `unavailable`로 반환한다.
