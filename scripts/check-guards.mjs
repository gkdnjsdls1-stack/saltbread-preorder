// 한도와 마감이 실제로 막는지 확인한다. 실행: npm run check:guards
//
// 주의: 이 스크립트는 DB에 시험 예약을 만들었다가 지운다. 끝에서 정리하지만
// 중간에 끊기면 code 가 OVER01 / LATE01 / RACE0* 인 예약이 남을 수 있다.
// 운영 DB 에서는 돌리지 말 것.
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DATE = '2026-10-29';
const YESTERDAY = '2026-10-28';
const made = [];

function line(label, pass, detail) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

async function reserve(code, productId, qty, date = DATE) {
  const r = await db.rpc('create_reservation', {
    p_code: code,
    p_customer_name: '테스트',
    p_phone: '01000000000',
    p_pickup_date: date,
    p_pickup_time: '확인용',
    p_items: [{ product_id: productId, qty }],
  });
  if (!r.error) made.push(code);
  return r;
}

const { data: products } = await db.rpc('products_with_remaining', { p_date: DATE });
const biscuit = products.find((p) => p.name.includes('비스켓'));
const original = products.find((p) => p.name.includes('오리지널'));

let allPass = true;

console.log('\n1. 남은 수량보다 많이 주문하면');
{
  const { error } = await reserve('OVER01', original.id, original.remaining + 5);
  allPass &= line('막힌다', Boolean(error) && error.message.includes('SOLD_OUT'), error?.message);
}

console.log('\n2. 마감이 지난 날짜로 주문하면');
{
  // 어제 픽업은 그제 21시가 마감이었으므로 반드시 닫혀 있어야 한다.
  const { error } = await reserve('LATE01', original.id, 1, YESTERDAY);
  allPass &= line('막힌다', Boolean(error) && error.message.includes('CLOSED'), error?.message);
}

console.log('\n3. 마지막 한 개를 동시에 다섯 명이 노리면');
{
  // 비스켓 한도를 그날만 1개로 낮춘다.
  await db.from('daily_limits').upsert(
    { pickup_date: DATE, product_id: biscuit.id, limit_qty: 1 },
    { onConflict: 'pickup_date,product_id' },
  );

  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((n) => reserve(`RACE0${n}`, biscuit.id, 1)),
  );
  const okCount = results.filter((r) => !r.error).length;
  const soldOut = results.filter((r) => r.error?.message.includes('SOLD_OUT')).length;

  allPass &= line('한 명만 성공한다', okCount === 1, `성공 ${okCount}건 / 품절 ${soldOut}건`);

  const { data: after } = await db.rpc('products_with_remaining', { p_date: DATE });
  const left = after.find((p) => p.id === biscuit.id).remaining;
  allPass &= line('남은 수량이 0이 된다', left === 0, `남은 수량 ${left}`);

  await db.from('daily_limits').delete().eq('pickup_date', DATE).eq('product_id', biscuit.id);
}

console.log('\n뒷정리');
{
  const { error } = await db.from('reservations').delete().in('code', made);
  line(`테스트 예약 ${made.length}건 삭제`, !error, error?.message);
}

console.log(allPass ? '\n전부 통과.\n' : '\n실패한 항목이 있다.\n');
