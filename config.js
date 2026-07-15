// Browser-safe configuration only. Never place provider secrets in this file.

const CONFIG = {
    // 브라우저는 Vercel Serverless Function만 호출합니다. OpenAI·Langfuse 키는
    // /api/automation 서버 환경변수로만 관리하며 이 파일에 넣지 않습니다.
    SAFETY_REVIEW_URL: '/api/automation',
    RECOMMENDATION_URL: '/api/automation',
    // Supabase publishable key는 RLS가 켜진 브라우저 앱에서만 사용합니다.
    // SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY는 절대 넣지 않습니다.
    SUPABASE_URL: 'https://ypchrufcfbhhvfblgnnc.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_wgzpd1q9N0Tq1r8Si5Kz7Q_Wqxidt8H',
    SUPABASE_AUTH_EMAIL_DOMAIN: 'auth.dongne-gwangjang.local'
};
