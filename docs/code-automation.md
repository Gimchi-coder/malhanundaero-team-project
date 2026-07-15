# 코드형 추천 RAG·문맥 분류 Agent

## 상세 설계 문서

- 문맥 분류 Agent: docs/CONTEXT_CLASSIFICATION_AGENT.md
- 추천용 RAG: docs/RECOMMENDATION_RAG.md

## 결론

n8n은 실행 도구일 뿐, 평가에서 중요한 것은 입력 검증 → 정규화 → AI/검색 처리 → 조건 분기
→ 결과 기록·응답의 구조와 그 이유를 설명할 수 있는지입니다. 다만 루브릭에 n8n 항목이
명시되어 있으므로 기존 n8n workflow JSON은 발표용 구조 증거로 남기고, 실제 실행 경로는
동일 계약의 Vercel Function으로 대체할 수 있게 만들었습니다.

현재 코드 경로는 다음 순서입니다.

  브라우저
  → POST /api/automation
  → 입력 검증·개인정보 마스킹
  → 안전 규칙 게이트 또는 임베딩 검색
  → 문맥 분류 Agent 또는 추천 생성 Agent
  → 허용된 ID·결정만 검증
  → 계약 응답

## 추천 RAG

api/automation.js의 recommend operation은 현재 모집 중이고 정원이 남은 활동만 지식원으로
만듭니다. 활동의 제목·목적·설명·카테고리·대화 부담·초보 가능 여부·공개 장소·일정을
문서로 합친 뒤, 사용자 관심사·편안함·시간 조건으로 만든 질의와 함께 임베딩합니다.

질의 벡터와 활동 문서 벡터의 코사인 유사도로 top-k 후보를 검색하고, 추천 Agent에는
검색된 후보만 전달합니다. Agent가 존재하지 않는 activityId를 만들지 못하도록 응답을
허용된 후보 ID와 대조하고, 모델 응답 실패 시에는 검색 결과에 근거한 보수적 이유로
대체합니다.

현재는 MVP이므로 요청마다 활동 후보를 임베딩하는 인메모리 검색입니다. 활동 수가 커지면
Supabase pgvector 테이블과 similarity search RPC로 문서 임베딩을 영속화하면 됩니다. 이
변경도 브라우저 계약은 바뀌지 않습니다.

배포 환경의 API 키가 Embeddings endpoint를 허용하지 않으면, 같은 Chat 모델이 고정된
16개 의미 축의 숫자 벡터를 생성하고 코사인 유사도로 검색하는
semantic-vector-cosine 경로를 사용합니다. 이는 표준 임베딩의 명시적 fallback이며 응답의
embeddingFallback 값으로 구분합니다. 권한이 생기면 embedding-cosine을 자동 우선합니다.

## 문맥 분류 Agent

safety_review operation은 먼저 정규화·초성/띄어쓰기 우회·프롬프트 주입·직접 위험 표현을
결정론적으로 검사합니다. 명백한 금지 의도는 held, 시스템 지시나 애매한 표현은
manual_review로 보냅니다.

결정론적 게이트를 통과한 내용만 서버의 OpenAI Chat Completions 호출로 보냅니다. Agent는
실제 모집인지 예방·교육·뉴스·비판적 언급인지 문맥을 구분하고, 완곡어법과 우회 표현을
검토합니다. approved는 high confidence만 통과시키며, 모델 오류·응답 형식 오류·API 키
미설정은 unavailable로 처리하여 게시하지 않습니다.

## 보안

OPENAI_API_KEY, provider 토큰, Supabase secret/service role key는 api/_lib/provider.js가
서버 환경변수에서만 읽습니다. config.js와 브라우저 응답에는 키를 넣지 않습니다. 서버
응답에는 원문 프롬프트와 개인정보를 포함하지 않고, 운영 기록은 결과·지연 시간·정책
버전 같은 집계 정보만 저장합니다.

Vercel 환경변수:

  OPENAI_API_KEY
  AI_MODEL (선택, 기본 gpt-4o-mini)
  EMBEDDING_MODEL (선택, 기본 text-embedding-3-small)

## n8n과의 대체 관계

config.js의 AUTOMATION_MODE가 n8n이면 기존 webhook을 사용합니다. Vercel에 api/automation.js를
배포하고 서버 환경변수를 설정한 뒤 AUTOMATION_MODE를 code로 바꾸면 브라우저는
/api/automation을 사용합니다.

두 경로 모두 operation, requestId, activity/activities, preferences 입력과
approved/held/manual_review/unavailable 및 recommendations 응답 계약을 공유합니다. 따라서
n8n workflow는 발표 시 시각적 오케스트레이션 증거로 설명하고, 코드 경로는 동일한 구조를
순수 JS로 재현한 대체 구현으로 시연할 수 있습니다.
