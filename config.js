// Browser-safe configuration only. Never place provider secrets in this file.

const CONFIG = {
    // Supabase public client configuration. Keep blank until the project is ready.
    // Never place a service_role key or any other secret in browser-delivered code.
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    // 공개 클라이언트에는 보호된 n8n webhook 주소만 둘 수 있습니다. provider key와
    // MODERATION_GATEWAY_TOKEN은 Censorship_Agent/n8n 서버 환경변수로만 관리합니다.
    SAFETY_REVIEW_URL: '',
    RECOMMENDATION_URL: ''
};

function createConfiguredSupabaseClient() {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) return null;
    if (!window.supabase?.createClient) return null;
    return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY);
}

// Client creation only. Auth and database operations are intentionally not wired yet.
const supabaseClient = createConfiguredSupabaseClient();
window.supabaseClient = supabaseClient;
window.supabaseConfigStatus = Object.freeze({
    configured: Boolean(supabaseClient),
    hasUrl: Boolean(CONFIG.SUPABASE_URL),
    hasPublishableKey: Boolean(CONFIG.SUPABASE_PUBLISHABLE_KEY),
    sdkLoaded: Boolean(window.supabase?.createClient)
});
