/* ============================================
   SUPABASE CONFIG
   ============================================ */

const SUPABASE_URL = 'https://vftveigtokamnhjclciz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LccKTCGMI6KJZgxoq-aL7Q_ssl58SUn';

if (!window.supabase) {
    console.error('Supabase SDK не загружен (CDN недоступен или заблокирован)');
    window.supabaseClient = null;
} else {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
