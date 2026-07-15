// Browser-safe configuration only. Never place provider secrets in this file.

const CONFIG = {
    // 공개 클라이언트에는 보호된 n8n webhook 주소만 둘 수 있습니다. provider key와
    // MODERATION_GATEWAY_TOKEN은 Censorship_Agent/n8n 서버 환경변수로만 관리합니다.
    SAFETY_REVIEW_URL: 'https://gimchi-coder.app.n8n.cloud/webhook/dongne-gwangjang/automation',
    RECOMMENDATION_URL: 'https://gimchi-coder.app.n8n.cloud/webhook/dongne-gwangjang/automation',
    // Supabase publishable key는 RLS가 켜진 브라우저 앱에서만 사용합니다.
    // SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY는 절대 넣지 않습니다.
    SUPABASE_URL: 'https://ypchrufcfbhhvfblgnnc.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_wgzpd1q9N0Tq1r8Si5Kz7Q_Wqxidt8H',
    SUPABASE_AUTH_EMAIL_DOMAIN: 'auth.dongne-gwangjang.local'
};
