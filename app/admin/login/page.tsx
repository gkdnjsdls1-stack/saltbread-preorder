import { redirect } from 'next/navigation';
import { BrandBar } from '@/app/brand';
import { loginAction } from '@/app/admin/actions';
import { isAdmin } from '@/lib/admin-auth';

export const metadata = { title: '관리 · 소금빵 하루 전 예약' };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  if (await isAdmin()) redirect('/admin');
  const { e } = await searchParams;

  return (
    <main className="wrap">
      <BrandBar link={false} />
      <h1>관리 화면</h1>
      <p className="sub">사장님용입니다.</p>

      {e ? <p className="error">비밀번호가 맞지 않습니다.</p> : null}

      <form action={loginAction}>
        <div className="card">
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
        </div>
        <button className="btn" type="submit">
          들어가기
        </button>
      </form>
    </main>
  );
}
