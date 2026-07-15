# Supabase 연결 안내

현재 앱은 Supabase JS SDK와 publishable key로 다음 데이터를 연결한다.

- `profiles`: 로그인 ID와 실명·성별·나이·휴대폰·인증 방식은 본인 행만 조회할 수 있도록 저장
- `activities`: 안전 검토를 통과한 공개 모집방 저장
- `activity_participants`: 참여 관계 저장
- `join_activity` / `withdraw_activity`: 정원 초과와 중복 참여를 DB 함수에서 원자적으로 처리

## 최초 1회 설정

1. Supabase Dashboard → SQL Editor → `supabase/schema.sql` 전체 실행
2. Authentication → Providers → Email에서 `Confirm email`을 끔
   - 현재 화면은 아이디를 내부용 이메일 주소로 변환해 Supabase Password Auth를 사용한다.
   - 실제 이메일 인증을 운영하려면 별도의 이메일 입력·인증·비밀번호 재설정 흐름을 추가해야 한다.
3. Table Editor에서 `profiles`, `activities`, `activity_participants`와 RLS 정책이 생성됐는지 확인
4. `config.js`에는 Project URL과 publishable key만 둔다. `SUPABASE_SECRET_KEY`, `SERVICE_ROLE_KEY`는 절대 넣지 않는다.

## 확인 시나리오

- 정상: 회원가입 → 아이디 중복 확인 → 개발용 본인인증 → 닉네임 저장 → 로그아웃 → 같은 아이디·비밀번호 로그인
- 거절: 중복 아이디, 만 20세 미만, 잘못된 비밀번호, 닉네임 미설정 로그인
- 데이터: Supabase `profiles`에서 본인 프로필이 생성되고, 공개 활동 카드에는 실명·성별·나이·휴대폰이 보이지 않는지 확인

Supabase 설정이 아직 완료되지 않은 경우 앱은 오류 메시지를 표시하며 활동을 자동 게시하지 않는다.
