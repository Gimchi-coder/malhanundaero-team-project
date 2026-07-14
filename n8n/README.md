# n8n 자동화

## 목적

이 디렉터리는 동네 광장의 평가기준용 자동화 workflow를 보관한다. 핵심 흐름은 다음과
같다.

`Webhook → 입력 검증 → 개인정보 최소화 → 의미·의도 분류 → 승인/보류/수동검토 분기 → 응답`

## 파일

- `workflows/activity-safety-and-recommendation.json`: n8n import용 workflow
- `../specs/001-dongne-gwangjang/contracts/automation.md`: 입력·출력 계약

## 운영 규칙

- provider credential은 n8n 환경변수 또는 credential store에만 둔다.
- 분류 실패·낮은 신뢰도·응답 형식 오류는 `manual_review`로 처리한다.
- workflow 변경 후 safe/direct/obfuscated/failure 4개 입력을 재생한다.
- 실제 운영 전에는 운영자 검토 큐와 보존·삭제 정책을 별도로 확정한다.
