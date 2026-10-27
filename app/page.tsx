import Link from 'next/link';
import ReserveForm from '@/app/reserve-form';
import SetupNotice from '@/app/setup-notice';
import { getProductsWithRemaining } from '@/lib/queries';
import { CUTOFF_HOUR, formatDateKo, isOrderWindowOpen, tomorrowSeoul } from '@/lib/time';
import type { ProductWithRemaining } from '@/lib/types';

// 남은 수량과 마감 판정이 요청마다 달라지므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const pickupDate = tomorrowSeoul();
  const open = isOrderWindowOpen();

  let products: ProductWithRemaining[] = [];
  let setupError: string | null = null;

  if (open) {
    try {
      products = await getProductsWithRemaining(pickupDate);
    } catch (err) {
      setupError = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <main className="wrap">
      <h1>소금빵 하루 전 예약</h1>
      <p className="sub">
        {formatDateKo(pickupDate)} 픽업 · 예약은 전날 밤 {CUTOFF_HOUR}시까지
      </p>

      <nav className="nav">
        <Link href="/lookup">예약 조회하기</Link>
      </nav>

      {setupError ? <SetupNotice message={setupError} /> : null}

      {!open ? (
        <div className="notice">
          오늘은 내일 픽업 예약이 마감되었습니다. 예약은 전날 밤 {CUTOFF_HOUR}시까지만 받습니다.
          <br />
          밤 12시가 지나면 다시 예약할 수 있습니다.
        </div>
      ) : null}

      {open && !setupError && products.length === 0 ? (
        <div className="notice">지금은 예약을 받을 상품이 없습니다.</div>
      ) : null}

      {open && !setupError && products.length > 0 ? <ReserveForm products={products} /> : null}
    </main>
  );
}
