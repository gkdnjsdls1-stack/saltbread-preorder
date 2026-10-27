import Link from 'next/link';
import VerifyForm from '@/app/verify-form';

export const metadata = { title: '예약 조회 · 소금빵 하루 전 예약' };

export default function LookupPage() {
  return (
    <main className="wrap">
      <h1>예약 조회</h1>
      <p className="sub">예약할 때 받은 코드와 전화번호를 함께 넣어 주세요.</p>

      <nav className="nav">
        <Link href="/">새로 예약하기</Link>
      </nav>

      <VerifyForm />
    </main>
  );
}
