// Copy the public values into config.js for local browser testing.
// Never put a service_role key or any other secret in browser-delivered code.

const CONFIG = {
    SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_KEY',
    SAFETY_REVIEW_URL: '',
    RECOMMENDATION_URL: ''
};

function createConfiguredSupabaseClient() {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) return null;
    if (!window.supabase?.createClient) return null;
    return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY);
}
