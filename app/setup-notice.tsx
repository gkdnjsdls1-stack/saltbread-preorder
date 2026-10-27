/**
 * 환경변수나 스키마가 아직 준비되지 않았을 때, 빈 화면 대신 무엇을 해야 하는지 보여준다.
 * 운영에서는 보일 일이 없다.
 */
export default function SetupNotice({ message }: { message: string }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>아직 연결이 안 됐습니다</h2>
      <p className="muted">{message}</p>
      <ol className="muted">
        <li>
          <code>.env.local.example</code> 을 <code>.env.local</code> 로 복사하고 값을 채웁니다.
        </li>
        <li>
          Supabase SQL Editor 에서 <code>supabase/schema.sql</code> 을 실행합니다.
        </li>
        <li>
          샘플 상품을 넣으려면 <code>supabase/seed.sql</code> 도 실행합니다.
        </li>
        <li>개발 서버를 다시 시작합니다.</li>
      </ol>
    </div>
  );
}
