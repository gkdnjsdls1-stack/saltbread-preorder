import Link from 'next/link';
import { CancelButton, CancelRequestForm, PaymentForm } from './forms';
import VerifyForm from '@/app/verify-form';
import { hasReservationAccess } from '@/lib/access';
import { normalizeCode } from '@/lib/code';
import { won } from '@/lib/format';
import { getReservationDetail } from '@/lib/queries';
import { formatDateKo, isOrderWindowOpen, tomorrowSeoul } from '@/lib/time';
import { RECEIPT_KIND_LABEL, STATUS_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

const BADGE_CLASS: Record<string, string> = {
  pending_payment: 'badge badge--pending',
  paid: 'badge badge--paid',
  picked_up: 'badge badge--paid',
  cancelled: 'badge badge--cancelled',
};

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = normalizeCode(decodeURIComponent((await params).code));

  if (!(await hasReservationAccess(code))) {
    return (
      <main className="wrap">
        <h1>예약 확인</h1>
        <p className="sub">
          본인 예약인지 확인이 필요합니다. 예약할 때 적은 전화번호를 넣어 주세요.
        </p>
        <VerifyForm code={code} />
      </main>
    );
  }

  const detail = await getReservationDetail(code);

  if (!detail) {
    return (
      <main className="wrap">
        <h1>예약을 찾을 수 없습니다</h1>
        <p className="sub">코드를 다시 확인해 주세요.</p>
        <Link className="btn btn--ghost" href="/lookup">
          다시 조회하기
        </Link>
      </main>
    );
  }

  const { reservation, items, payment, cancelRequest } = detail;
  const isPending = reservation.status === 'pending_payment';
  const canCancelDirectly =
    isPending && reservation.pickup_date === tomorrowSeoul() && isOrderWindowOpen();
  const bankAccount = process.env.BANK_ACCOUNT ?? '';

  return (
    <main className="wrap">
      <h1>예약 내역</h1>
      <p className="sub">
        <span className={BADGE_CLASS[reservation.status] ?? 'badge'}>
          {STATUS_LABEL[reservation.status]}
        </span>
      </p>

      <div className="card center">
        <p className="muted" style={{ margin: 0 }}>
          예약 코드
        </p>
        <p className="code">{reservation.code}</p>
        <p className="hint" style={{ marginTop: 0 }}>
          이 코드와 전화번호로 다시 조회할 수 있습니다.
        </p>
      </div>

      <h2>주문</h2>
      <div className="card">
        {items.map((item) => (
          <div className="item" key={item.id}>
            <div className="item__body">
              <div className="item__name">{item.product_name}</div>
              <div className="item__meta">
                {won(item.unit_price)} × {item.qty}개
              </div>
            </div>
            <div>{won(item.unit_price * item.qty)}</div>
          </div>
        ))}
        <div className="total">
          <span>합계</span>
          <span>{won(reservation.total)}</span>
        </div>
      </div>

      <h2>픽업</h2>
      <div className="card">
        <p style={{ margin: 0 }}>
          {formatDateKo(reservation.pickup_date)} · {reservation.pickup_time}
        </p>
        <p className="hint" style={{ marginBottom: 0 }}>
          {reservation.customer_name} 님
        </p>
      </div>

      {reservation.status === 'cancelled' ? (
        <div className="notice">취소된 예약입니다.</div>
      ) : null}

      {isPending && !payment ? (
        <>
          <h2>입금</h2>
          <div className="notice">
            {bankAccount ? (
              <>
                <strong>{bankAccount}</strong>
                <br />
              </>
            ) : null}
            {won(reservation.total)} 입금 후, 아래에 입금 정보를 남겨 주세요. 사장님이 확인하면
            예약이 확정됩니다.
          </div>
          <PaymentForm code={reservation.code} total={reservation.total} />
        </>
      ) : null}

      {payment ? (
        <>
          <h2>입금 정보</h2>
          <div className="card">
            <table className="rows">
              <tbody>
                <tr>
                  <th>입금자</th>
                  <td>{payment.depositor_name}</td>
                </tr>
                {payment.amount !== null ? (
                  <tr>
                    <th>입금액</th>
                    <td>{won(payment.amount)}</td>
                  </tr>
                ) : null}
                {payment.deposited_at ? (
                  <tr>
                    <th>입금 시각</th>
                    <td>{payment.deposited_at}</td>
                  </tr>
                ) : null}
                {payment.cash_receipt_requested ? (
                  <tr>
                    <th>현금영수증</th>
                    <td>
                      {payment.cash_receipt_number}
                      {payment.receipt_kind ? ` · ${RECEIPT_KIND_LABEL[payment.receipt_kind]}` : ''}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th>확인</th>
                  <td>{payment.confirmed_at ? '사장님 확인 완료' : '확인 대기 중'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {reservation.status !== 'cancelled' ? (
        <>
          <h2>취소</h2>
          {canCancelDirectly ? (
            <CancelButton code={reservation.code} />
          ) : cancelRequest && cancelRequest.status === 'requested' ? (
            <div className="notice">취소 요청이 접수되었습니다. 사장님 확인을 기다리고 있습니다.</div>
          ) : isPending ? (
            <div className="notice">마감이 지나 직접 취소할 수 없습니다. 가게로 연락해 주세요.</div>
          ) : (
            <CancelRequestForm code={reservation.code} />
          )}
        </>
      ) : null}

      <nav className="nav" style={{ marginTop: 28 }}>
        <Link href="/">새로 예약하기</Link>
      </nav>
    </main>
  );
}
