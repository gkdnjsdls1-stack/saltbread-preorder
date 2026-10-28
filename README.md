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

`SUPABASE_SERVICE_ROLE_KEY` 에는 **secret(service_role) 키**를 넣는다.
publishable(공개용) 키를 넣으면 상품 목록은 멀쩡히 보이는데 예약만 조용히 실패한다.
RLS 때문에 읽기는 통과하고 쓰기만 막히기 때문이다.

### 3. 확인

```bash
npm run check:db
```

환경변수, 테이블 6개, 함수, 상품 목록을 한 번에 확인한다. 키 종류도 여기서 걸러낸다.

### 4. 실행

```bash
npm run dev
```

## 점검 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm run typecheck` | 타입만 본다 |
| `npm run check:db` | 연결, 테이블, 함수, 상품을 본다. DB 를 건드리지 않는다 |
| `npm run check:guards` | 한도·마감·동시 예약이 실제로 막히는지 본다. **시험 예약을 만들었다가 지우므로 운영 DB 에서는 돌리지 않는다** |
| `npm run check:notify` | 텔레그램 봇을 확인하고, 채팅 ID 를 찾아주고, 시험 메시지를 보낸다 |

## 사장님 알림 (텔레그램)

1. 텔레그램에서 `@BotFather` 에게 `/newbot` 을 보내 봇을 만들고 토큰을 받는다.
   봇 아이디는 `bot` 으로 끝나야 한다.
2. 토큰을 `.env.local` 의 `TELEGRAM_BOT_TOKEN=` 에 넣는다.
3. 만든 봇과 대화를 한 번 시작한다 (아무 말이나 보낸다).
4. `npm run check:notify` — 채팅 ID 를 대신 찾아준다.
5. 찾은 ID 를 `TELEGRAM_CHAT_ID=` 에 넣고 `npm run check:notify` 를 다시 돌린다.
   시험 메시지가 오면 끝이다.

여러 사람이 함께 받으려면 그룹을 만들어 봇을 넣고, 그 그룹에 아무 말이나 보낸 뒤
4번을 돌리면 그룹의 ID 가 나온다.

### 텔레그램이 막힌 네트워크

회사나 학교 인터넷은 텔레그램을 막아두는 곳이 많다. 막혀 있으면
`Resolve-DnsName api.telegram.org` 이 엉뚱한 주소(예: `172.x`)를 돌려주고
`check:notify` 가 "텔레그램 서버에 닿지 못했습니다"로 끝난다.
토큰이 틀린 게 아니다. 휴대폰 핫스팟에 연결해 다시 돌리면 된다.

운영 서버(Vercel)는 그 네트워크를 쓰지 않으므로 배포 후에는 상관없다.
사장님 휴대폰도 회사망이 아니라 본인 데이터·와이파이로 받는다.

알림이 실패해도 예약은 그대로 저장된다. 보내려던 내용은 서버 로그에 남는다.
텔레그램이 느릴 때 손님 화면이 같이 멈추지 않도록 5초에서 끊는다.

알림을 보내는 코드는 `lib/notify.ts` 한 군데에만 있다.
나중에 카카오 알림톡으로 바꿀 때 이 파일만 고치면 된다.

## 배포 (Vercel)

1. GitHub 에 빈 저장소를 만든다 (이름: `saltbread-preorder`, **Private**).
2. 파일을 올린다. 이 PC 에는 git 이 없으므로 **Add file → Upload files** 에
   `소금빵-깃업로드` 폴더 안의 것을 끌어다 놓는다.
   그 폴더에는 올려도 되는 것만 들어 있다 — `node_modules`, `.next`, `.env.local`,
   원본 사진은 빠져 있다.
3. [vercel.com](https://vercel.com) → **Add New → Project** → 그 저장소를 Import.
   Framework 는 Next.js 로 자동 인식된다. 빌드 설정은 손대지 않는다.
   **Project Name 은 `bridegroom` 으로 바꾼다** — 주소가 여기서 나온다.
   저장소 이름(`saltbread-preorder`)은 주소와 상관없다.
4. Import 화면의 **Environment Variables** 에 `배포-환경변수.txt` 내용을 붙여넣는다.
   (이 파일은 진짜 키가 들어 있어 깃에 올라가지 않는다. 로컬에만 있다.)
5. Deploy 를 누른다.

배포 후 할 일:

- `BANK_ACCOUNT` 를 **진짜 계좌**로 바꾼다. 샘플 계좌로 두면 손님이 엉뚱한 곳에 입금한다.
- `/admin/products` 에서 가격과 종류별 하루 한도를 실제 값으로 바꾼다.
- 텔레그램 `TELEGRAM_CHAT_ID` 를 채운다 (아래).
- 환경변수를 바꾼 뒤에는 Vercel 의 **Redeploy** 를 눌러야 적용된다.

### 주소

주소를 정하는 것은 **Vercel 의 Project Name** 이다. 저장소 이름은 손님에게 보이지 않는다.

Vercel 이 자동으로 주는 주소는 `<프로젝트이름>-<계정이름>.vercel.app` 형식이다.
깔끔한 `bridegroom.vercel.app` 을 쓰려면 **Settings → Domains → Add** 에서 직접 붙인다.
`.vercel.app` 주소는 공짜지만 전 세계에서 하나뿐이라 먼저 가져간 사람이 임자다.

가게 주소로 쓸 거라면 진짜 도메인을 사서 **Settings → Domains** 에 연결하는 쪽이 낫다.
연결은 DNS 레코드 한두 줄이고, Vercel 이 HTTPS 인증서를 자동으로 발급한다.

### 배포 후 텔레그램 채팅 ID 채우기

휴대폰(회사 와이파이 말고 데이터)에서 둘 중 하나로 숫자를 알아낸다:

- 텔레그램에서 `@userinfobot` 에게 아무 말이나 보내면 `Id` 를 알려준다.
- 또는 휴대폰 브라우저로 `https://api.telegram.org/bot<토큰>/getUpdates` 를 열어
  `"chat":{"id":...}` 를 읽는다.

그 숫자를 Vercel 의 `TELEGRAM_CHAT_ID` 에 넣고 **Redeploy** 한 뒤,
배포된 주소에서 예약을 하나 넣어 알림이 오는지 확인한다.

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

- **`package.json` 의 `overrides` 는 일부러 넣은 것이다.** Next 15 가 끌고 오는
  `postcss` 8.4.31 에 취약점 보고가 있는데, 고치려면 Next 16 으로 올려야 해서
  breaking change 가 된다. 그래서 빌드 도구만 고쳐진 버전(8.5.x)으로 바꿔 끼웠다.
  `npm audit` 이 0건이면 정상이다. Next 를 올릴 때 이 줄은 지워도 된다.
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
