import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addProductAction, setDailyLimitAction, updateProductAction } from '@/app/admin/actions';
import SetupNotice from '@/app/setup-notice';
import { isAdmin } from '@/lib/admin-auth';
import { getAllProducts, getDailyLimits } from '@/lib/queries';
import { formatDateKo, tomorrowSeoul } from '@/lib/time';
import type { Product } from '@/lib/types';

export const metadata = { title: '상품 관리 · 소금빵' };
export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/login');

  const { date: dateParam } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '') ? (dateParam as string) : tomorrowSeoul();

  let products: Product[] = [];
  let limits = new Map<string, number>();
  let setupError: string | null = null;

  try {
    [products, limits] = await Promise.all([getAllProducts(), getDailyLimits(date)]);
  } catch (err) {
    setupError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="wrap wrap--wide">
      <h1>상품 · 한도</h1>
      <p className="sub">가격과 하루 한도를 여기서 바꿉니다.</p>

      <nav className="nav">
        <Link href="/admin">예약 목록</Link>
      </nav>

      {setupError ? <SetupNotice message={setupError} /> : null}

      <h2>상품</h2>
      {products.map((product) => (
        <div className="card" key={product.id}>
          <form action={updateProductAction}>
            <input type="hidden" name="product_id" value={product.id} />
            <p style={{ marginTop: 0, fontWeight: 700 }}>{product.name}</p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 120px' }}>
                <label htmlFor={`price_${product.id}`}>가격</label>
                <input
                  id={`price_${product.id}`}
                  name="price"
                  type="number"
                  min={0}
                  step={100}
                  defaultValue={product.price}
                />
              </div>

              <div className="field" style={{ flex: '1 1 120px' }}>
                <label htmlFor={`limit_${product.id}`}>기본 하루 한도</label>
                <input
                  id={`limit_${product.id}`}
                  name="default_daily_limit"
                  type="number"
                  min={0}
                  defaultValue={product.default_daily_limit}
                />
              </div>

              <div className="field" style={{ flex: '0 0 90px' }}>
                <label htmlFor={`sort_${product.id}`}>순서</label>
                <input
                  id={`sort_${product.id}`}
                  name="sort_order"
                  type="number"
                  defaultValue={product.sort_order}
                />
              </div>
            </div>

            <div className="field">
              <label className="checkline" htmlFor={`active_${product.id}`}>
                <input
                  id={`active_${product.id}`}
                  name="is_active"
                  type="checkbox"
                  defaultChecked={product.is_active}
                />
                예약 받기
              </label>
            </div>

            <button className="btn btn--small" type="submit">
              저장
            </button>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />

          <form action={setDailyLimitAction}>
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="pickup_date" value={date} />
            <div className="field">
              <label htmlFor={`daily_${product.id}`}>
                {formatDateKo(date)} 한도만 따로
              </label>
              <input
                id={`daily_${product.id}`}
                name="limit_qty"
                type="number"
                min={0}
                defaultValue={limits.get(product.id) ?? ''}
                placeholder={`비우면 기본값 ${product.default_daily_limit}개`}
              />
              <p className="hint">적게 굽는 날에만 씁니다. 비워서 저장하면 기본 한도로 돌아갑니다.</p>
            </div>
            <button className="btn btn--ghost btn--small" type="submit">
              이 날짜만 저장
            </button>
          </form>
        </div>
      ))}

      <h2>상품 추가</h2>
      <div className="card">
        <form action={addProductAction}>
          <div className="field">
            <label htmlFor="new_name">이름</label>
            <input id="new_name" name="name" type="text" maxLength={40} required />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 120px' }}>
              <label htmlFor="new_price">가격</label>
              <input id="new_price" name="price" type="number" min={0} step={100} defaultValue={0} />
            </div>

            <div className="field" style={{ flex: '1 1 120px' }}>
              <label htmlFor="new_limit">기본 하루 한도</label>
              <input
                id="new_limit"
                name="default_daily_limit"
                type="number"
                min={0}
                defaultValue={10}
              />
            </div>

            <div className="field" style={{ flex: '0 0 90px' }}>
              <label htmlFor="new_sort">순서</label>
              <input id="new_sort" name="sort_order" type="number" defaultValue={99} />
            </div>
          </div>

          <button className="btn btn--small" type="submit">
            추가
          </button>
        </form>
      </div>
    </main>
  );
}
