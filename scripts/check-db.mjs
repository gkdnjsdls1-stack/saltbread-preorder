// Supabase 연결 점검. 실행: npm run check:db
// .env.local 을 읽어서 테이블과 함수가 제대로 올라갔는지 하나씩 확인한다.
import { createClient } from '@supabase/supabase-js';

const ok = (m) => console.log(`  OK    ${m}`);
const bad = (m) => console.log(`  FAIL  ${m}`);

let failed = 0;
function check(cond, label, detail) {
  if (cond) ok(label);
  else {
    bad(`${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n환경변수');
check(Boolean(url), 'SUPABASE_URL', '비어 있습니다');
check(Boolean(key), 'SUPABASE_SERVICE_ROLE_KEY', '비어 있습니다');
check(Boolean(process.env.SESSION_SECRET), 'SESSION_SECRET', '비어 있습니다');
check(Boolean(process.env.ADMIN_PASSWORD), 'ADMIN_PASSWORD', '비어 있습니다');

if (!url || !key) {
  console.log('\n먼저 .env.local 에 Supabase 값을 채우세요.\n');
  process.exit(1);
}

// 공개용 키를 넣으면 상품 목록은 멀쩡히 보이는데 예약만 조용히 실패한다.
// RLS 때문에 읽기는 통과하고 쓰기만 막히기 때문이다. 여기서 미리 걸러낸다.
function keyKind(k) {
  if (k.startsWith('sb_secret_')) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';
  if (k.startsWith('eyJ')) {
    try {
      const body = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString());
      if (body.role === 'service_role') return 'secret';
      if (body.role === 'anon') return 'publishable';
    } catch {
      /* 형식이 다르면 아래에서 unknown 으로 둔다 */
    }
  }
  return 'unknown';
}

const kind = keyKind(key);
check(kind !== 'publishable', '서버 전용 키', '공개용(publishable/anon) 키입니다 — 예약 저장이 막힙니다');
if (kind === 'publishable') {
  console.log('        Supabase → Project Settings → API 에서 secret(service_role) 키를 쓰세요.');
}

const db = createClient(url, key, { auth: { persistSession: false } });

// 내일 날짜 (Asia/Seoul)
const seoul = new Date(Date.now() + 9 * 60 * 60 * 1000);
seoul.setUTCDate(seoul.getUTCDate() + 1);
const tomorrow = seoul.toISOString().slice(0, 10);

console.log('\n테이블');
for (const table of [
  'products',
  'daily_limits',
  'reservations',
  'reservation_items',
  'payments',
  'cancel_requests',
]) {
  const { error } = await db.from(table).select('*', { count: 'exact', head: true });
  check(!error, table, error?.message);
}

console.log('\n함수');
const { data: open, error: openErr } = await db.rpc('order_window_open', { p_date: tomorrow });
check(!openErr, 'order_window_open', openErr?.message);
if (!openErr) console.log(`        ${tomorrow} 주문 창: ${open ? '열림' : '닫힘 (전날 21시 지남)'}`);

const { data: rows, error: rowsErr } = await db.rpc('products_with_remaining', {
  p_date: tomorrow,
});
check(!rowsErr, 'products_with_remaining', rowsErr?.message);

console.log('\n상품');
if (Array.isArray(rows) && rows.length > 0) {
  for (const r of rows) {
    console.log(`        ${r.name} — ${r.price.toLocaleString('ko-KR')}원, 남은 수량 ${r.remaining}`);
  }
} else if (!rowsErr) {
  console.log('        없음 — supabase/seed.sql 을 실행하면 샘플 상품이 들어갑니다.');
}

console.log(failed === 0 ? '\n전부 통과.\n' : `\n${failed}개 실패.\n`);
process.exit(failed === 0 ? 0 : 1);
