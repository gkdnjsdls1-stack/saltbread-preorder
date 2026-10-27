import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  cancelByAdminAction,
  confirmPaymentAction,
  handleCancelRequestAction,
  logoutAction,
  markPickedUpAction,
} from '@/app/admin/actions';
import SetupNotice from '@/app/setup-notice';
import { isAdmin } from '@/lib/admin-auth';
import { formatPhone, won } from '@/lib/format';
import { getReservationsForDate, summarize, type AdminRow } from '@/lib/queries';
import { formatDateKo, todaySeoul, tomorrowSeoul } from '@/lib/time';
import { RECEIPT_KIND_LABEL, STATUS_LABEL } from '@/lib/types';

export const metadata = { title: '예약 관리 · 소금빵' };
export const dynamic = 'force-dynamic';

const BADGE_CLASS: Record<string, string> = {
  pending_payment: 'badge badge--pending',
  paid: 'badge badge--paid',
  picked_up: 'badge badge--paid',
  cancelled: 'badge badge--cancelled',
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/login');

  const { date: dateParam } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '') ? (dateParam as string) : tomorrowSeoul();

  let rows: AdminRow[] = [];
  let setupError: string | null = null;

  try {
    rows = await getReservationsForDate(date);
  } catch (err) {
    setupError = err instanceof Error ? err.message : String(err);
  }

  const totals = summarize(rows);
  const live = rows.filter((r) => r.reservation.status !== 'cancelled');
  const unpaid = live.filter((r) => r.reservation.status === 'pending_payment');
  const pendingCancels = rows.filter((r) => r.openCancelRequest !== null);
  const revenue = live.reduce((sum, r) => sum + r.reservation.total, 0);

  return (
    <main className="wrap wrap--wide">
      <h1>예약 관리</h1>
      <p className="sub">{formatDateKo(date)} 픽업</p>

      <nav className="nav">
        <Link href={`/admin?date=${tomorrowSeoul()}`}>내일</Link>
        <Link href={`/admin?date=${todaySeoul()}`}>오늘</Link>
        <Link href="/admin/products">상품 · 한도</Link>
        <form action={logoutAction}>
          <button className="btn btn--ghost btn--small" type="submit">
            나가기
          </button>
        </form>
      </nav>

      <form method="get" className="card" style={{ display: 'flex', gap: 8 }}>
        <input type="date" name="date" defaultValue={date} />
        <button className="btn btn--ghost btn--small" type="submit">
          보기
        </button>
      </form>

      {setupError ? <SetupNotice message={setupError} /> : null}

      <h2>내일 몇 개</h2>
      <div className="card">
        {totals.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            예약이 없습니다.
          </p>
        ) : (
          <table className="rows">
            <thead>
              <tr>
                <th>상품</th>
                <th className="num">총 수량</th>
                <th className="num">입금 확인</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td className="num">
                    <strong>{t.qty}개</strong>
                  </td>
                  <td className="num muted">{t.paidQty}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint">
          예약 {live.length}건 · 입금 전 {unpaid.length}건 · 합계 {won(revenue)}
        </p>
      </div>

      {pendingCancels.length > 0 ? (
        <>
          <h2>취소 요청 {pendingCancels.length}건</h2>
          {pendingCancels.map((row) => (
            <div className="card" key={row.openCancelRequest?.id}>
              <p style={{ marginTop: 0 }}>
                <strong>{row.reservation.code}</strong> · {row.reservation.customer_name} ·{' '}
                {won(row.reservation.total)}
              </p>
              <p className="muted">사유: {row.openCancelRequest?.reason || '없음'}</p>
              <div className="row-actions">
                <form action={handleCancelRequestAction}>
                  <input type="hidden" name="request_id" value={row.openCancelRequest?.id} />
                  <input type="hidden" name="reservation_id" value={row.reservation.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn btn--danger btn--small" type="submit">
                    취소 처리 (환불은 따로)
                  </button>
                </form>
                <form action={handleCancelRequestAction}>
                  <input type="hidden" name="request_id" value={row.openCancelRequest?.id} />
                  <input type="hidden" name="reservation_id" value={row.reservation.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button className="btn btn--ghost btn--small" type="submit">
                    거절
                  </button>
                </form>
              </div>
            </div>
          ))}
        </>
      ) : null}

      <h2>예약 {rows.length}건</h2>
      {rows.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            이 날짜에는 예약이 없습니다.
          </p>
        </div>
      ) : (
        rows.map(({ reservation, items, payment }) => (
          <div className="card" key={reservation.id}>
            <p style={{ marginTop: 0, marginBottom: 6 }}>
              <span className={BADGE_CLASS[reservation.status] ?? 'badge'}>
                {STATUS_LABEL[reservation.status]}
              </span>{' '}
              <strong>{reservation.code}</strong> · {reservation.customer_name} ·{' '}
              {formatPhone(reservation.phone)}
            </p>

            <p className="muted" style={{ marginTop: 0 }}>
              픽업 {reservation.pickup_time} · {won(reservation.total)}
            </p>

            <table className="rows">
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td className="num">{item.qty}개</td>
                    <td className="num muted">{won(item.unit_price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {payment ? (
              <p className="muted" style={{ marginBottom: 6 }}>
                입금자 {payment.depositor_name}
                {payment.amount !== null ? ` · ${won(payment.amount)}` : ''}
                {payment.deposited_at ? ` · ${payment.deposited_at}` : ''}
                {payment.cash_receipt_requested
                  ? ` · 현금영수증 ${payment.cash_receipt_number ?? ''}${
                      payment.receipt_kind ? ` (${RECEIPT_KIND_LABEL[payment.receipt_kind]})` : ''
                    }`
                  : ''}
              </p>
            ) : (
              <p className="muted" style={{ marginBottom: 6 }}>
                입금 정보 없음
              </p>
            )}

            {reservation.status !== 'cancelled' ? (
              <div className="row-actions">
                {reservation.status === 'pending_payment' ? (
                  <form action={confirmPaymentAction}>
                    <input type="hidden" name="reservation_id" value={reservation.id} />
                    <button className="btn btn--small" type="submit">
                      입금 확인
                    </button>
                  </form>
                ) : null}

                {reservation.status === 'paid' ? (
                  <form action={markPickedUpAction}>
                    <input type="hidden" name="reservation_id" value={reservation.id} />
                    <button className="btn btn--small" type="submit">
                      픽업 완료
                    </button>
                  </form>
                ) : null}

                <form action={cancelByAdminAction}>
                  <input type="hidden" name="reservation_id" value={reservation.id} />
                  <button className="btn btn--danger btn--small" type="submit">
                    취소
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ))
      )}
    </main>
  );
}
