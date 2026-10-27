-- 소금빵 하루 전 예약 — 스키마
-- Supabase 프로젝트의 SQL Editor 에 그대로 붙여 실행한다.

create extension if not exists pgcrypto;

do $$ begin
  create type reservation_status as enum ('pending_payment', 'paid', 'picked_up', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 현금영수증 증빙 구분
  create type receipt_kind as enum ('deduction', 'expense');  -- 소득공제 / 지출증빙
exception when duplicate_object then null; end $$;

do $$ begin
  create type cancel_status as enum ('requested', 'done', 'rejected');
exception when duplicate_object then null; end $$;

-- ───────────────────────────────── 테이블

create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  price               integer not null check (price >= 0),
  default_daily_limit integer not null check (default_daily_limit >= 0),
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

-- 특정 날짜만 한도를 달리 둘 때 사용 (적게 굽는 날)
create table if not exists daily_limits (
  pickup_date date not null,
  product_id  uuid not null references products (id) on delete cascade,
  limit_qty   integer not null check (limit_qty >= 0),
  primary key (pickup_date, product_id)
);

create table if not exists reservations (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- 손님에게 주는 조회용 코드
  customer_name text not null,
  phone         text not null,                 -- 숫자만 저장
  pickup_date   date not null,
  pickup_time   text not null,                 -- 자유 입력이라 문자열로 둔다
  total         integer not null,
  status        reservation_status not null default 'pending_payment',
  created_at    timestamptz not null default now()
);

create index if not exists reservations_pickup_date_idx on reservations (pickup_date);
create index if not exists reservations_phone_idx on reservations (phone);

create table if not exists reservation_items (
  id             bigserial primary key,
  reservation_id uuid not null references reservations (id) on delete cascade,
  product_id     uuid not null references products (id),
  qty            integer not null check (qty > 0),
  unit_price     integer not null               -- 예약 시점 단가 스냅샷. 나중에 가격이 바뀌어도 지난 예약 금액은 그대로.
);

create index if not exists reservation_items_reservation_idx on reservation_items (reservation_id);
create index if not exists reservation_items_product_idx on reservation_items (product_id);

create table if not exists payments (
  reservation_id         uuid primary key references reservations (id) on delete cascade,
  depositor_name         text not null,         -- 입금 증빙
  amount                 integer,
  deposited_at           text,                  -- 손님이 적는 입금 시각. 자유 입력.
  cash_receipt_requested boolean not null default false,
  cash_receipt_number    text,                  -- 휴대폰 번호 또는 사업자번호
  receipt_kind           receipt_kind,
  submitted_at           timestamptz not null default now(),
  confirmed_at           timestamptz            -- 사장님이 입금 확인한 시각
);

create table if not exists cancel_requests (
  id             bigserial primary key,
  reservation_id uuid not null references reservations (id) on delete cascade,
  reason         text,
  status         cancel_status not null default 'requested',
  requested_at   timestamptz not null default now(),
  handled_at     timestamptz
);

create index if not exists cancel_requests_status_idx on cancel_requests (status);

-- ───────────────────────────────── 함수

-- 해당 날짜·상품의 남은 수량. 날짜별 한도가 있으면 그것을, 없으면 상품 기본 한도를 쓴다.
create or replace function remaining_qty(p_date date, p_product uuid)
returns integer
language sql
stable
as $$
  select greatest(
    coalesce(
      (select dl.limit_qty from daily_limits dl
        where dl.pickup_date = p_date and dl.product_id = p_product),
      (select p.default_daily_limit from products p where p.id = p_product),
      0
    )
    - coalesce(
      (select sum(ri.qty) from reservation_items ri
         join reservations r on r.id = ri.reservation_id
        where ri.product_id = p_product
          and r.pickup_date = p_date
          and r.status <> 'cancelled'),
      0
    ),
    0
  )::integer;
$$;

-- 마감 판정. 픽업 전날 21:00 (Asia/Seoul) 까지만 예약을 받는다.
-- 손님 기기 시계가 아니라 DB 시간으로 판정하는 것이 핵심이다.
create or replace function order_window_open(p_date date)
returns boolean
language sql
stable
as $$
  select (now() at time zone 'Asia/Seoul')
       < ((p_date - interval '1 day')::date + time '21:00');
$$;

-- 손님 화면에 뿌릴 상품 목록 + 남은 수량
create or replace function products_with_remaining(p_date date)
returns table (
  id         uuid,
  name       text,
  price      integer,
  sort_order integer,
  remaining  integer
)
language sql
stable
as $$
  select p.id, p.name, p.price, p.sort_order, remaining_qty(p_date, p.id)
    from products p
   where p.is_active
   order by p.sort_order, p.name;
$$;

-- 예약 생성. 한도 확인과 생성을 한 트랜잭션 안에서 처리한다.
-- 두 손님이 동시에 마지막 한 개를 예약해도 한도를 넘지 않는다.
create or replace function create_reservation(
  p_code          text,
  p_customer_name text,
  p_phone         text,
  p_pickup_date   date,
  p_pickup_time   text,
  p_items         jsonb   -- [{"product_id": "...", "qty": 2}, ...]
)
returns jsonb
language plpgsql
as $$
declare
  v_item           jsonb;
  v_product        products;
  v_qty            integer;
  v_remaining      integer;
  v_total          integer := 0;
  v_reservation_id uuid;
begin
  if not order_window_open(p_pickup_date) then
    raise exception 'CLOSED';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY';
  end if;

  -- 관련 상품 행을 id 순으로 잠근다. 순서를 고정해 교착을 피한다.
  perform 1
     from products
    where id in (select (value ->> 'product_id')::uuid from jsonb_array_elements(p_items))
    order by id
      for update;

  insert into reservations (code, customer_name, phone, pickup_date, pickup_time, total)
  values (p_code, p_customer_name, p_phone, p_pickup_date, p_pickup_time, 0)
  returning id into v_reservation_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;

    select * into v_product from products where id = (v_item ->> 'product_id')::uuid;

    if v_product.id is null then
      raise exception 'NO_PRODUCT';
    end if;
    if not v_product.is_active then
      raise exception 'INACTIVE:%', v_product.name;
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'BAD_QTY';
    end if;

    -- 이 예약의 항목은 아직 넣지 않았으므로, 남은 수량은 다른 예약만 반영한 값이다.
    v_remaining := remaining_qty(p_pickup_date, v_product.id);
    if v_qty > v_remaining then
      raise exception 'SOLD_OUT:%:%', v_product.name, v_remaining;
    end if;

    insert into reservation_items (reservation_id, product_id, qty, unit_price)
    values (v_reservation_id, v_product.id, v_qty, v_product.price);

    v_total := v_total + v_qty * v_product.price;
  end loop;

  update reservations set total = v_total where id = v_reservation_id;

  return jsonb_build_object('id', v_reservation_id, 'code', p_code, 'total', v_total);
end;
$$;

-- ───────────────────────────────── 접근 제어
-- 앱은 service_role 키로 서버에서만 DB 에 붙는다. service_role 은 RLS 를 우회한다.
-- 브라우저에서 직접 붙는 경로는 열지 않는다. 그래서 상품 목록 외에는 정책을 두지 않는다.

alter table products          enable row level security;
alter table daily_limits      enable row level security;
alter table reservations      enable row level security;
alter table reservation_items enable row level security;
alter table payments          enable row level security;
alter table cancel_requests   enable row level security;

drop policy if exists products_public_read on products;
create policy products_public_read on products
  for select using (is_active);
