'use client';

import { useActionState, useState } from 'react';
import { createReservationAction, type FormState } from '@/app/actions';
import { won } from '@/lib/format';
import type { ProductWithRemaining } from '@/lib/types';

export default function ReserveForm({ products }: { products: ProductWithRemaining[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createReservationAction,
    {},
  );
  const [qty, setQty] = useState<Record<string, number>>({});

  const total = products.reduce((sum, p) => sum + (qty[p.id] ?? 0) * p.price, 0);
  const picked = products.reduce((n, p) => n + (qty[p.id] ?? 0), 0);

  function change(product: ProductWithRemaining, next: number) {
    const clamped = Math.max(0, Math.min(product.remaining, Math.floor(next || 0)));
    setQty((prev) => ({ ...prev, [product.id]: clamped }));
  }

  return (
    <form action={formAction}>
      {state.error ? <p className="error">{state.error}</p> : null}

      <div className="card">
        {products.map((product) => {
          const value = qty[product.id] ?? 0;
          const soldOut = product.remaining === 0;

          return (
            <div className="item" key={product.id}>
              <div className="item__body">
                <div className="item__name">{product.name}</div>
                <div className="item__meta">
                  {won(product.price)}
                  {soldOut ? null : ` · ${product.remaining}개 남음`}
                </div>
              </div>

              {soldOut ? (
                <span className="soldout">품절</span>
              ) : (
                <div className="stepper">
                  <button
                    type="button"
                    onClick={() => change(product, value - 1)}
                    aria-label={`${product.name} 한 개 줄이기`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    name={`qty_${product.id}`}
                    inputMode="numeric"
                    min={0}
                    max={product.remaining}
                    value={value}
                    onChange={(e) => change(product, Number(e.target.value))}
                    aria-label={`${product.name} 수량`}
                  />
                  <button
                    type="button"
                    onClick={() => change(product, value + 1)}
                    aria-label={`${product.name} 한 개 늘리기`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="total">
          <span>합계</span>
          <span>{won(total)}</span>
        </div>
        <p className="hint">입금은 예약을 등록한 뒤 안내됩니다.</p>
      </div>

      <h2>받는 분</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="customer_name">이름</label>
          <input id="customer_name" name="customer_name" type="text" maxLength={40} required />
        </div>

        <div className="field">
          <label htmlFor="phone">전화번호</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="010-1234-5678"
            maxLength={20}
            required
          />
          <p className="hint">예약을 조회할 때 쓰입니다.</p>
        </div>

        <div className="field">
          <label htmlFor="pickup_time">내일 픽업 시간</label>
          <input
            id="pickup_time"
            name="pickup_time"
            type="text"
            placeholder="예) 오전 11시 30분쯤"
            maxLength={40}
            required
          />
          <p className="hint">편한 대로 적어 주세요.</p>
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending || picked === 0}>
        {pending ? '예약하는 중…' : `예약하기 (${won(total)})`}
      </button>
    </form>
  );
}
