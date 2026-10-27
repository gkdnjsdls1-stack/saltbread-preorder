import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * 서버 전용 Supabase 클라이언트.
 *
 * service_role 키를 쓰므로 RLS 를 우회한다. 반드시 서버(서버 컴포넌트, 서버 액션)
 * 에서만 호출한다. 클라이언트 컴포넌트에서 import 하면 키가 브라우저로 나간다.
 *
 * 환경변수가 없을 때 모듈 로드 시점이 아니라 호출 시점에 터지도록 지연 생성한다.
 * 빌드만 할 때는 환경변수가 없어도 통과해야 한다.
 */
export function db(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. .env.local 을 확인하세요.',
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
