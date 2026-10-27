# 소금빵 하루 전 예약

내일 픽업할 소금빵을 하루 전에 예약받는 모바일 웹앱.
기획은 [소금빵-하루전-예약-기획.md](소금빵-하루전-예약-기획.md) 에 있다.

- 손님: `/` 에서 예약, `/lookup` 에서 조회
- 사장님: `/admin` (비밀번호), `/admin/products` 에서 가격·한도 관리

## 시작하기

Node 20 이상이 필요하다.

```bash
npm install
```

### 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 에서 무료 프로젝트를 만든다.
2. SQL Editor 에 `supabase/schema.sql` 전체를 붙여 실행한다.
3. 샘플 상품을 넣으려면 `supabase/seed.sql` 도 실행한다.
   가격과 하루 한도는 임시 숫자이므로 나중에 `/admin/products` 에서 바꾼다.

### 2. 환경변수

```bash
cp .env.local.example .env.local
```

| 변수 | 설명 |
|---|---|
| `SUPABASE_URL` | 프로젝트 Settings → API 의 Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면의 `service_role` 키. **서버 전용** |
| `SESSION_SECRET` | 쿠키 서명용 임의 문자열 (32자 이상) |
| `ADMIN_PASSWORD` | 관리 화면 비밀번호 |
| `BANK_ACCOUNT` | 손님에게 보여줄 입금 계좌 안내 문구 |
| `TELEGRAM_BOT_TOKEN` | 사장님 알림용. 비우면 서버 로그로만 출력 |
| `TELEGRAM_CHAT_ID` | 알림을 받을 채팅 ID |

`SESSION_SECRET` 은 이렇게 만들 수 있다:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 실행

```bash
npm run dev
```

## 사장님 알림 (텔레그램)

1. 텔레그램에서 `@BotFather` 에게 `/newbot` 을 보내 봇을 만들고 토큰을 받는다.
2. 만든 봇과 대화를 한 번 시작한다 (아무 말이나 보낸다).
3. `https://api.telegram.org/bot<토큰>/getUpdates` 를 열어 `chat.id` 를 확인한다.
4. 두 값을 `.env.local` 에 넣는다.

알림을 보내는 코드는 `lib/notify.ts` 한 군데에만 있다.
나중에 카카오 알림톡으로 바꿀 때 이 파일만 고치면 된다.

## 배포 (Vercel)

1. 이 폴더를 깃 저장소로 만들어 GitHub 에 올린다.
2. Vercel 에서 import 한 뒤, 위 환경변수를 Project Settings → Environment Variables 에 그대로 넣는다.
3. `SESSION_SECRET` 과 `ADMIN_PASSWORD` 는 로컬과 다른 값을 쓴다.

## 구조

```
app/
  page.tsx              손님 예약 화면
  reserve-form.tsx      수량 선택 + 총액 계산 (클라이언트)
  actions.ts            예약 생성, 입금 등록, 취소, 조회 인증
  verify-form.tsx       예약코드 + 전화번호 확인
  lookup/page.tsx       예약 조회
  r/[code]/page.tsx     예약 상세
  r/[code]/forms.tsx    입금 정보 / 취소 / 취소 요청 (클라이언트)
  admin/page.tsx        날짜별 예약 목록 + 종류별 집계
  admin/products/       가격, 기본 한도, 날짜별 한도
  admin/actions.ts      사장님 동작
lib/
  supabase.ts           service_role 클라이언트 (서버 전용)
  queries.ts            읽기 쿼리
  time.ts               Asia/Seoul, 전날 21시 마감
  notify.ts             알림 (갈아끼울 지점)
  signed.ts             쿠키 서명
  access.ts             손님 예약 접근 권한
  admin-auth.ts         관리 화면 세션
supabase/
  schema.sql            테이블, 함수, RLS
  seed.sql              샘플 상품
```

## 알아둘 것

- **한도 초과는 DB 가 막는다.** `create_reservation()` 함수 안에서 상품 행을 잠그고
  남은 수량을 확인한 뒤 예약을 만든다. 두 손님이 동시에 마지막 한 개를 예약해도 한 명만 된다.
- **마감 판정도 DB 가 한다.** `order_window_open()` 이 `now()` 를 Asia/Seoul 로 보고 판정한다.
  화면의 `isOrderWindowOpen()` 은 표시용이다.
- **단가는 예약 시점 값을 저장한다.** 가격을 올려도 지난 예약 금액은 그대로다.
- **손님 식별에 로그인이 없다.** 예약 코드 + 전화번호가 맞으면 쿠키에 접근 권한을 담는다.
  전화번호는 URL 에 싣지 않는다.
- **브라우저는 DB 에 직접 붙지 않는다.** 모든 읽기·쓰기가 서버를 거친다.
  `service_role` 키는 서버에만 있고, RLS 는 켜 둔 채 상품 목록 외에는 정책을 두지 않았다.
- **현금영수증은 정보만 모은다.** 발급은 사장님이 홈택스에서 한다.
