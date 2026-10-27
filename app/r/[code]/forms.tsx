'use client';

import { useActionState, useState } from 'react';
import {
  cancelReservationAction,
  requestCancelAction,
  submitPaymentAction,
  type FormState,
} from '@/app/actions';

/** 입금 증빙과 현금영수증을 한 폼에서 받는다. 현금영수증은 원하는 사람만. */
export function PaymentForm({ code, total }: { code: string; total: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitPaymentAction, {});
  const [wantsReceipt, setWantsReceipt] = useState(false);

  if (state.done) {
    return (
      <div className="notice">
        입금 정보를 받았습니다. 사장님이 확인하면 예약이 확정됩니다.
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? <p className="error">{state.error}</p> : null}
      <input type="hidden" name="code" value={code} />

      <div className="card">
        <div className="field">
          <label htmlFor="depositor_name">입금자명</label>
          <input id="depositor_name" name="depositor_name" type="text" maxLength={40} required />
          <p className="hint">통장에 찍히는 이름으로 적어 주세요.</p>
        </div>

        <div className="field">
          <label htmlFor="amount">입금액</label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={total}
          />
        </div>

        <div className="field">
          <label htmlFor="deposited_at">입금 시각</label>
          <input
            id="deposited_at"
            name="deposited_at"
            type="text"
            placeholder="예) 오늘 저녁 7시쯤"
            maxLength={40}
          />
        </div>

        <div className="field">
          <label className="checkline" htmlFor="cash_receipt_requested">
            <input
              id="cash_receipt_requested"
              name="cash_receipt_requested"
              type="checkbox"
              checked={wantsReceipt}
              onChange={(e) => setWantsReceipt(e.target.checked)}
            />
            현금영수증이 필요해요
          </label>
        </div>

        {wantsReceipt ? (
          <>
            <div className="field">
              <label htmlFor="cash_receipt_number">휴대폰 번호 또는 사업자번호</label>
              <input
                id="cash_receipt_number"
                name="cash_receipt_number"
                type="tel"
                inputMode="numeric"
                maxLength={20}
              />
            </div>

            <div className="field">
              <label htmlFor="receipt_kind">증빙 구분</label>
              <select id="receipt_kind" name="receipt_kind" defaultValue="deduction">
                <option value="deduction">소득공제</option>
                <option value="expense">지출증빙</option>
              </select>
            </div>
          </>
        ) : null}
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? '보내는 중…' : '입금 정보 남기기'}
      </button>
    </form>
  );
}

/** 입금 전 예약만 손님이 직접 취소한다. */
export function CancelButton({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelReservationAction,
    {},
  );

  const [armed, setArmed] = useState(false);

  if (state.done) return <div className="notice">예약을 취소했습니다.</div>;

  // 한 번 더 묻는 단계를 둔다. 실수로 누르면 되돌릴 수 없는 동작이다.
  if (!armed) {
    return (
      <button className="btn btn--danger" type="button" onClick={() => setArmed(true)}>
        예약 취소
      </button>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? <p className="error">{state.error}</p> : null}
      <input type="hidden" name="code" value={code} />

      <div className="card">
        <p style={{ margin: 0 }}>정말 취소할까요? 되돌릴 수 없습니다.</p>
      </div>

      <div className="row-actions">
        <button className="btn btn--danger btn--small" type="submit" disabled={pending}>
          {pending ? '취소하는 중…' : '네, 취소합니다'}
        </button>
        <button
          className="btn btn--ghost btn--small"
          type="button"
          onClick={() => setArmed(false)}
          disabled={pending}
        >
          아니요
        </button>
      </div>
    </form>
  );
}

/** 입금 후에는 요청만 보낸다. 환불은 사장님이 사람 손으로 처리한다. */
export function CancelRequestForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestCancelAction, {});
  const [open, setOpen] = useState(false);

  if (state.done) {
    return (
      <div className="notice">
        취소 요청을 보냈습니다. 사장님이 확인한 뒤 환불을 안내해 드립니다.
      </div>
    );
  }

  if (!open) {
    return (
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        취소를 요청할게요
      </button>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? <p className="error">{state.error}</p> : null}
      <input type="hidden" name="code" value={code} />

      <div className="card">
        <div className="field">
          <label htmlFor="reason">취소 사유 (선택)</label>
          <textarea id="reason" name="reason" rows={3} maxLength={200} />
          <p className="hint">입금한 예약이므로 사장님이 확인한 뒤 환불해 드립니다.</p>
        </div>
      </div>

      <button className="btn btn--danger" type="submit" disabled={pending}>
        {pending ? '보내는 중…' : '취소 요청 보내기'}
      </button>
    </form>
  );
}
