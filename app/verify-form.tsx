'use client';

import { useActionState } from 'react';
import { verifyReservationAction, type FormState } from '@/app/actions';

/** 예약 코드 + 전화번호로 내역을 연다. 전화번호는 URL 에 싣지 않는다. */
export default function VerifyForm({ code }: { code?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    verifyReservationAction,
    {},
  );

  return (
    <form action={formAction}>
      {state.error ? <p className="error">{state.error}</p> : null}

      <div className="card">
        <div className="field">
          <label htmlFor="code">예약 코드</label>
          <input
            id="code"
            name="code"
            type="text"
            defaultValue={code ?? ''}
            readOnly={Boolean(code)}
            placeholder="예) ACDE47"
            maxLength={12}
            autoCapitalize="characters"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="phone">전화번호</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="예약할 때 적은 번호"
            maxLength={20}
            required
          />
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? '확인하는 중…' : '예약 내역 보기'}
      </button>
    </form>
  );
}
