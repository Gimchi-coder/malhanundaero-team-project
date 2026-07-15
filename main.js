// 동네 광장: browser-safe prototype with explicit persistence and safety boundaries.

const MIN_PARTICIPANTS = 3;
const DEFAULT_MAX_PARTICIPANTS = 6;
const TRUST_BASELINE = 50;
const TRUST_POSITIVE_DELTA = 1;
const TRUST_NEGATIVE_DELTA = 2;
const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000;
const GROUPS_KEY = 'dg_groups_v2';
const USER_KEY = 'dg_user';
const ACCOUNTS_KEY = 'dg_accounts_v1';
const PRIVATE_PROFILE_KEY = 'dg_private_profile_v1';
const PRIVATE_PROFILES_KEY = 'dg_private_profiles_v1';
const REPORTS_KEY = 'dg_reports_v1';
const REVIEWS_KEY = 'dg_reviews_v1';
const CONNECTION_CHECKINS_KEY = 'dg_connection_checkins_v1';
const PARTICIPATION_LOG_KEY = 'dg_participation_log_v1';
const ACTIVITY_CHAT_KEY = 'dg_activity_chat_v1';
const TRUST_KEY = 'dg_trust_projection_v1';
const NOTIFICATIONS_KEY = 'dg_notifications_v1';
const OPERATIONS_KEY = 'dg_operations_v1';
const RECOMMENDATION_CACHE_KEY = 'dg_recommendation_cache_v1';
const RECOMMENDATION_CACHE_STATS_KEY = 'dg_recommendation_cache_stats_v1';
const ACTIVITY_HISTORY_KEY = 'dg_activity_history_v1';
const ACTIVITY_SETTINGS_KEY = 'dg_activity_settings_v1';

const state = {
    user: null,
    groups: [],
    joinedGroupIds: new Set(),
    remoteJoinedGroupIds: null,
    activitySettings: null,
    recommendedGroupIds: [],
    recommendationReasons: {},
    recommendations: [],
    pendingSignupId: null,
    filters: { query: '', ageGroup: 'all', category: 'all' },
    notifications: []
};
const privateGroupState = new Map();

const $ = (id) => document.getElementById(id);
const supabaseClient = (() => {
    if (!window.supabase?.createClient || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) return null;
    try {
        return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
    } catch (error) {
        console.error('Supabase client initialization failed', error);
        return null;
    }
})();
const supabaseState = { active: Boolean(supabaseClient), hydrated: false };
const elements = {
    login: $('btn-login'),
    signup: $('btn-signup'),
    notificationsButton: $('btn-notifications'),
    notificationBadge: $('notification-badge'),
    notificationModal: $('modal-notifications'),
    closeNotifications: $('btn-close-notifications'),
    notificationList: $('notification-list'),
    reportModal: $('modal-report'),
    closeReport: $('btn-close-report'),
    reportForm: $('form-report'),
    reportActivityName: $('report-activity-name'),
    reportReason: $('input-report-reason'),
    reportSubmitStatus: $('report-submit-status'),
    reportSubmit: $('btn-submit-report'),
    loginModal: $('modal-login'),
    closeLogin: $('btn-close-login'),
    recoveryModal: $('modal-account-recovery'),
    closeRecovery: $('btn-close-recovery'),
    recoveryForm: $('form-account-recovery'),
    loginForm: $('form-login'),
    loginSubmitStatus: $('login-submit-status'),
    signupModal: $('modal-signup'),
    closeSignup: $('btn-close-signup'),
    signupForm: $('form-signup'),
    nicknameSetupModal: $('modal-nickname-setup'),
    nicknameSetupForm: $('form-nickname-setup'),
    nicknameSetupStatus: $('nickname-submit-status'),
    create: $('btn-create'),
    profile: $('user-profile'),
    profileButton: $('btn-profile'),
    profileModal: $('modal-profile'),
    closeProfile: $('btn-close-profile'),
    profileForm: $('form-profile'),
    profileStatus: $('profile-submit-status'),
    profileNickname: $('input-profile-nickname'),
    profilePreviewName: $('profile-preview-name'),
    joinedHistoryList: $('joined-history-list'),
    createdHistoryList: $('created-history-list'),
    nickname: $('user-nickname'),
    trustScore: $('user-trust-score'),
    logout: $('btn-logout'),
    createModal: $('modal-create'),
    closeCreate: $('btn-close-create'),
    form: $('form-create-group'),
    feedback: $('ai-feedback-box'),
    feedbackText: $('ai-feedback-text'),
    list: $('group-list'),
    empty: $('empty-state'),
    loader: $('global-loader'),
    status: $('global-status'),
    submit: $('btn-submit-group')
};
elements.feedbackModal = $('modal-feedback');
elements.feedbackForm = $('form-feedback');
elements.closeFeedback = $('btn-close-feedback');
elements.feedbackSubmitStatus = $('feedback-submit-status');
elements.recommendationForm = $('form-recommendation');
elements.recommendationStatus = $('recommendation-status');
elements.recommendationList = $('recommendation-list');
elements.search = $('input-group-search');
elements.applySearch = $('btn-apply-search');
elements.createMain = $('btn-create-main');
elements.recommendationHero = $('btn-recommendation-hero');
elements.ageFilters = $('age-filter-buttons');
elements.categoryFilters = $('category-filter-buttons');
elements.groupCount = $('group-count');
elements.historyList = $('history-list');
elements.historyEmpty = $('history-empty');
elements.historyCount = $('history-count');
elements.historyCompletedCount = $('history-completed-count');
elements.historyRevisitCount = $('history-revisit-count');
elements.historyTrustScore = $('history-trust-score');
elements.activityRoomModal = $('modal-activity-room');
elements.closeActivityRoom = $('btn-close-activity-room');
elements.roomTitle = $('room-title');
elements.roomMeta = $('room-meta');
elements.roomMessages = $('room-messages');
elements.roomChatMessages = $('room-chat-messages');
elements.roomChatForm = $('form-room-chat');
elements.roomChatInput = $('input-room-chat');
elements.roomChatStatus = $('room-chat-status');
elements.activityExamples = $('activity-examples');
elements.signupSubmitStatus = $('signup-submit-status');
elements.enterActivities = $('btn-enter-activities');
elements.recommendationDock = $('ai-recommendation');
elements.viewTabs = [...document.querySelectorAll('[data-view-target]')];
elements.navCreate = $('nav-create');
const signupState = {
    idAvailable: false,
    idCheckedId: '',
    verificationComplete: false,
    verificationContact: '',
    verificationMethod: '',
    isSubmitting: false
};

const safeJson = (value, fallback) => {
    if (value === null || value === undefined || value === '') return fallback;
    try {
        const parsed = JSON.parse(value);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
};

function localDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function defaultActivitySettings() {
    return { preferredDate: localDateInputValue(), locationMode: 'current', manualLocation: '', coordinates: null };
}

function normalizeActivitySettings(value) {
    const fallback = defaultActivitySettings();
    const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test(String(value?.preferredDate || '')) && Number.isFinite(new Date(`${value.preferredDate}T00:00:00`).getTime())
        ? value.preferredDate
        : fallback.preferredDate;
    const locationMode = value?.locationMode === 'manual' ? 'manual' : 'current';
    const manualLocation = String(value?.manualLocation || '').trim().slice(0, 60);
    const latitude = Number(value?.coordinates?.latitude);
    const longitude = Number(value?.coordinates?.longitude);
    const coordinates = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
    return { preferredDate, locationMode, manualLocation, coordinates };
}

function getActivitySettingsStore() {
    const stored = safeJson(localStorage.getItem(ACTIVITY_SETTINGS_KEY), {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function getActivitySettings(userId = state.user?.id) {
    if (!userId) return defaultActivitySettings();
    return normalizeActivitySettings(getActivitySettingsStore()[String(userId)]);
}

function saveActivitySettings(settings, userId = state.user?.id) {
    if (!userId) return;
    const store = getActivitySettingsStore();
    store[String(userId)] = normalizeActivitySettings(settings);
    localStorage.setItem(ACTIVITY_SETTINGS_KEY, JSON.stringify(store));
}

const ACTIVITY_LOCATION_HINTS = [
    { terms: ['마포', '망원', '합정', '홍대', '월드컵'], latitude: 37.556, longitude: 126.91 },
    { terms: ['상암'], latitude: 37.578, longitude: 126.89 },
    { terms: ['서울숲', '성수'], latitude: 37.545, longitude: 127.037 },
    { terms: ['서대문'], latitude: 37.574, longitude: 126.956 },
    { terms: ['강남', '잠실'], latitude: 37.505, longitude: 127.045 }
];

function locationHintCoordinates(value) {
    const normalized = String(value || '').replace(/\s/g, '');
    const hint = ACTIVITY_LOCATION_HINTS.find((item) => item.terms.some((term) => normalized.includes(term)));
    return hint ? { latitude: hint.latitude, longitude: hint.longitude } : null;
}

function distanceInKm(from, to) {
    if (!from || !to) return null;
    const toRadians = (value) => value * Math.PI / 180;
    const earthRadiusKm = 6371;
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function activityDistanceKm(group) {
    const settings = state.activitySettings || getActivitySettings();
    const origin = settings.locationMode === 'current' ? settings.coordinates : settings.coordinates || locationHintCoordinates(settings.manualLocation);
    return distanceInKm(origin, locationHintCoordinates(group?.location));
}

function sortGroupsForActivitySettings(groups) {
    const settings = state.activitySettings || getActivitySettings();
    return [...groups].sort((left, right) => {
        const leftTime = new Date(left.scheduledAt).getTime();
        const rightTime = new Date(right.scheduledAt).getTime();
        const leftDate = new Date(leftTime);
        const rightDate = new Date(rightTime);
        const leftPreferred = localDateInputValue(new Date(leftTime)) === settings.preferredDate ? 0 : 1;
        const rightPreferred = localDateInputValue(new Date(rightTime)) === settings.preferredDate ? 0 : 1;
        const preferredDateDifference = leftPreferred - rightPreferred;
        if (preferredDateDifference) return preferredDateDifference;
        const dateDifference = new Date(leftDate.getFullYear(), leftDate.getMonth(), leftDate.getDate()).getTime() - new Date(rightDate.getFullYear(), rightDate.getMonth(), rightDate.getDate()).getTime();
        if (dateDifference) return dateDifference;
        const distanceDifference = (activityDistanceKm(left) ?? Number.POSITIVE_INFINITY) - (activityDistanceKm(right) ?? Number.POSITIVE_INFINITY);
        if (distanceDifference) return distanceDifference;
        return leftTime - rightTime;
    });
}

function emptyActivityHistory() {
    return { joined: [], created: [] };
}

function getActivityHistoryStore() {
    const stored = safeJson(localStorage.getItem(ACTIVITY_HISTORY_KEY), {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

function getActivityHistory(userId = state.user?.id) {
    if (!userId) return emptyActivityHistory();
    const stored = getActivityHistoryStore()[String(userId)];
    return {
        joined: Array.isArray(stored?.joined) ? stored.joined : [],
        created: Array.isArray(stored?.created) ? stored.created : []
    };
}

function saveActivityHistory(history, userId = state.user?.id) {
    if (!userId) return;
    const store = getActivityHistoryStore();
    store[String(userId)] = {
        joined: history.joined.slice(-100),
        created: history.created.slice(-100)
    };
    localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(store));
}

function activityHistoryRecord(group) {
    return {
        activityId: String(group.id),
        title: String(group.title || '제목 없는 활동'),
        purpose: String(group.purpose || ''),
        location: String(group.location || ''),
        scheduledAt: group.scheduledAt || '',
        status: group.status || 'recruiting',
        category: String(group.category || '기타 모임'),
        participants: Number(group.participants || 0),
        maxParticipants: Number(group.maxParticipants || DEFAULT_MAX_PARTICIPANTS),
        createdAt: group.createdAt || new Date().toISOString()
    };
}

function upsertActivityHistory(type, group) {
    if (!state.user || !group?.id || !['joined', 'created'].includes(type)) return;
    const history = getActivityHistory();
    const record = activityHistoryRecord(group);
    history[type] = [...history[type].filter((item) => item.activityId !== record.activityId), record];
    saveActivityHistory(history);
    renderActivityHistory();
}

function removeJoinedActivityHistory(activityId) {
    if (!state.user) return;
    const history = getActivityHistory();
    history.joined = history.joined.filter((item) => item.activityId !== String(activityId));
    saveActivityHistory(history);
    renderActivityHistory();
}

function syncActivityHistory() {
    if (!state.user) return;
    const history = getActivityHistory();
    const groupsById = new Map(state.groups.map((group) => [String(group.id), group]));
    const createdIds = new Set();

    state.groups.filter((group) => String(group.creatorId) === String(state.user.id)).forEach((group) => {
        createdIds.add(String(group.id));
        const existing = history.created.find((item) => item.activityId === String(group.id));
        const record = activityHistoryRecord(group);
        history.created = [...history.created.filter((item) => item.activityId !== record.activityId), { ...existing, ...record }];
    });

    // 기존 mock 데이터의 participantIds도 최초 한 번은 사용자별 신청 기록으로 옮깁니다.
    state.groups.filter((group) => !createdIds.has(String(group.id)) && (group.participantIds || []).some((id) => String(id) === String(state.user.id))).forEach((group) => {
        const record = activityHistoryRecord(group);
        history.joined = [...history.joined.filter((item) => item.activityId !== record.activityId), record];
    });

    history.joined = history.joined
        .filter((record) => !createdIds.has(String(record.activityId)))
        .map((record) => ({ ...record, ...(groupsById.get(String(record.activityId)) ? activityHistoryRecord(groupsById.get(String(record.activityId))) : {}) }))
        .filter((record) => !state.remoteJoinedGroupIds || !groupsById.get(String(record.activityId))?.remote || state.remoteJoinedGroupIds.has(record.activityId));
    history.created = history.created.map((record) => ({ ...record, ...(groupsById.get(String(record.activityId)) ? activityHistoryRecord(groupsById.get(String(record.activityId))) : {}) }));
    saveActivityHistory(history);

    state.joinedGroupIds.clear();
    history.joined.forEach((record) => state.joinedGroupIds.add(record.activityId));
    history.created.forEach((record) => state.joinedGroupIds.add(record.activityId));
    renderActivityHistory();
}

function historyStatusLabel(record, type) {
    if (type === 'joined' && state.joinedGroupIds.has(record.activityId)) return '참여 중';
    return statusLabel(record.status);
}

function renderActivityHistoryList(container, records, type, emptyMessage) {
    if (!container) return;
    container.replaceChildren();
    if (!records.length) {
        container.append(createText('p', emptyMessage, 'empty-history'));
        return;
    }
    records.slice().sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).forEach((record) => {
        const card = document.createElement('article');
        card.className = 'activity-history-card';
        const header = document.createElement('div');
        header.className = 'activity-history-card-header';
        header.append(createText('span', record.category, 'category-badge'), createText('span', historyStatusLabel(record, type), 'history-status'));
        card.append(header, createText('h6', record.title), createText('p', record.purpose, 'history-purpose'), createText('span', `📍 ${record.location}`, 'card-meta'), createText('span', `🕒 ${formatDate(record.scheduledAt)}`, 'card-meta'));
        container.append(card);
    });
}

function renderActivityHistory() {
    if (!state.user) {
        renderActivityHistoryList(elements.joinedHistoryList, [], 'joined', '로그인 후 신청한 활동이 표시돼요.');
        renderActivityHistoryList(elements.createdHistoryList, [], 'created', '아직 만든 모임이 없어요.');
        return;
    }
    const history = getActivityHistory();
    renderActivityHistoryList(elements.joinedHistoryList, history.joined, 'joined', '아직 신청한 활동이 없어요.');
    renderActivityHistoryList(elements.createdHistoryList, history.created, 'created', '아직 만든 모임이 없어요.');
}

function publicUser(user) {
    if (!user) return null;
    return {
        id: String(user.id),
        nickname: String(user.nickname).slice(0, 24),
        icon: user.icon || '🌱',
        trustScore: getTrustProjection(user.id, user.trustScore)
    };
}

function normalizeNickname(nickname) {
    return String(nickname || '').normalize('NFKC').trim().toLowerCase();
}

function normalizeLoginId(loginId) {
    return String(loginId || '').normalize('NFKC').trim().toLowerCase();
}

function authEmailForLoginId(loginId) {
    const domain = String(CONFIG.SUPABASE_AUTH_EMAIL_DOMAIN || 'auth.dongne-gwangjang.local').replace(/^@+/, '');
    return `${normalizeLoginId(loginId)}@${domain}`;
}

function supabaseErrorMessage(error, fallback = 'Supabase 연결을 확인해 주세요.') {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    if (/email.*confirm|confirm.*email|email_not_confirmed/i.test(`${code} ${message}`)) return 'Supabase에서 이메일 확인이 켜져 있어요. Authentication 설정에서 Confirm email을 끄거나 이메일 인증 흐름을 먼저 완료해 주세요.';
    if (/invalid.*login|invalid.*credential|user.*not.*found/i.test(`${code} ${message}`)) return '아이디 또는 비밀번호가 올바르지 않습니다.';
    if (/relation .* does not exist|schema cache|profiles|activities/i.test(message)) return 'Supabase 테이블이 아직 준비되지 않았습니다. supabase/schema.sql을 SQL Editor에서 먼저 실행해 주세요.';
    return fallback;
}

async function remoteLoginIdAvailable(loginId) {
    if (!supabaseClient) return true;
    const { data, error } = await supabaseClient.rpc('login_id_available', { p_login_id: loginId });
    if (error) throw error;
    return data === true;
}

async function remoteProfileForUser(userId) {
    if (!supabaseClient || !userId) return null;
    const { data, error } = await supabaseClient.from('profiles')
        .select('id,login_id,nickname,name,gender,age,phone,age_group,verification_method,marketing_consent,trust_score')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

function persistRemoteProfileLocally(profile) {
    if (!profile) return;
    localStorage.setItem(PRIVATE_PROFILE_KEY, JSON.stringify({
        userId: profile.id,
        name: profile.name,
        gender: profile.gender,
        age: Number(profile.age),
        ageGroup: profile.age_group,
        phone: profile.phone,
        signupId: profile.login_id,
        verificationMethod: profile.verification_method,
        marketingConsent: Boolean(profile.marketing_consent)
    }));
    const trust = safeJson(localStorage.getItem(TRUST_KEY), {});
    trust[String(profile.id)] = normalizedTrustScore(profile.trust_score);
    localStorage.setItem(TRUST_KEY, JSON.stringify(trust));
}

function applyRemoteProfile(profile) {
    if (!profile?.id || !profile.nickname) return false;
    persistRemoteProfileLocally(profile);
    state.user = publicUser({ id: profile.id, nickname: profile.nickname, icon: '🌱', trustScore: profile.trust_score });
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    state.filters.ageGroup = 'all';
    return true;
}

async function registerRemoteAccount(draft) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.signUp({
        email: authEmailForLoginId(draft.loginId),
        password: draft.password,
        options: { data: { login_id: draft.loginId } }
    });
    if (error) throw error;
    if (!data.user || !data.session) throw new Error('email_confirmation_required');
    const profile = {
        id: data.user.id,
        login_id: draft.loginId,
        nickname: null,
        name: draft.name,
        gender: draft.gender,
        age: draft.age,
        phone: draft.phone,
        age_group: ageGroupFromAge(draft.age),
        verification_method: draft.verificationMethod,
        marketing_consent: draft.marketingConsent,
        trust_score: TRUST_BASELINE
    };
    const { error: profileError } = await supabaseClient.from('profiles').insert(profile);
    if (profileError) {
        await supabaseClient.auth.signOut();
        throw profileError;
    }
    return data.user;
}

async function updateRemoteNickname(userId, nickname) {
    if (!supabaseClient || !userId) return;
    const { error } = await supabaseClient.from('profiles').update({ nickname, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
}

async function signInRemote(loginId, password) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: authEmailForLoginId(loginId), password });
    if (error) throw error;
    const profile = await remoteProfileForUser(data.user.id);
    if (!profile?.nickname) throw new Error('nickname_missing');
    return profile;
}

async function hashSecret(secret) {
    const bytes = new TextEncoder().encode(String(secret));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getAccounts() {
    const accounts = safeJson(localStorage.getItem(ACCOUNTS_KEY), []);
    return Array.isArray(accounts) ? accounts : [];
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function upsertAccount(account) {
    const accounts = getAccounts();
    const previous = accounts.find((item) => item.id === String(account.id)) || {};
    const next = accounts.filter((item) => item.id !== String(account.id));
    next.push({ ...previous, ...account, id: String(account.id), nickname: String(account.nickname ?? previous.nickname ?? ''), trustScore: normalizedTrustScore(account.trustScore ?? previous.trustScore), createdAt: previous.createdAt || account.createdAt || new Date().toISOString() });
    saveAccounts(next);
}

function migrateCurrentUserAccount(user) {
    if (!user || getAccounts().some((account) => account.id === String(user.id))) return;
    upsertAccount({ id: user.id, nickname: user.nickname, loginId: '', passwordHash: '', trustScore: user.trustScore });
}

function ageGroupFromAge(age) {
    const value = Number(age);
    if (!Number.isInteger(value) || value < 20) return 'all';
    if (value >= 50) return '50plus';
    return `${Math.floor(value / 10)}0s`;
}

function ageGroupLabel(ageGroup) {
    return { all: '전 연령', '20s': '20대', '30s': '30대', '40s': '40대', '50plus': '50대 이상' }[ageGroup] || '전 연령';
}

function normalizeActivityAgeGroups(ageGroups) {
    const raw = Array.isArray(ageGroups) ? ageGroups.join(' ') : String(ageGroups || '');
    const normalized = raw.normalize('NFKC').toLowerCase().replace(/\s/g, '');
    if (!normalized || /all|전연령/.test(normalized)) return ['all'];
    const values = [
        [/20(?:s|대)?/, '20s'], [/30(?:s|대)?/, '30s'], [/40(?:s|대)?/, '40s'], [/50(?:plus|s|대이상|대)?/, '50plus']
    ].filter(([pattern]) => pattern.test(normalized)).map(([, value]) => value);
    return values.length ? [...new Set(values)] : ['all'];
}

function normalizeActivityAgeGroup(ageGroup) {
    return normalizeActivityAgeGroups(ageGroup)[0];
}

function ageFilterMatchesGroup(groupAgeGroups, selectedFilter, viewerAgeGroup) {
    const normalizedGroupAges = normalizeActivityAgeGroups(groupAgeGroups);
    const normalizedViewerAge = normalizeActivityAgeGroup(viewerAgeGroup);
    if (selectedFilter === 'mine') return normalizedViewerAge !== 'all' && normalizedGroupAges.includes(normalizedViewerAge);
    return normalizedGroupAges.includes('all');
}

function getPrivateProfile() {
    return safeJson(localStorage.getItem(PRIVATE_PROFILE_KEY), null);
}

function getPrivateProfiles() {
    const profiles = safeJson(localStorage.getItem(PRIVATE_PROFILES_KEY), []);
    const list = Array.isArray(profiles) ? profiles : [];
    const current = getPrivateProfile();
    if (current && !list.some((profile) => profile.userId === current.userId)) list.push(current);
    return list;
}

function normalizeContact(contact) {
    const value = String(contact || '').normalize('NFKC').trim().toLowerCase();
    return /^[-+\d\s()]+$/.test(value) ? value.replace(/\D/g, '') : value;
}

function getViewerAgeGroup() {
    return getPrivateProfile()?.ageGroup || 'all';
}

function trustScoreClass(score) {
    if (score >= 70) return 'trust-hot';
    if (score >= 50) return 'trust-warm';
    return 'trust-cool';
}

function normalizedTrustScore(score) {
    const value = Number(score);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : TRUST_BASELINE;
}

function getTrustProjection(userId, fallback = TRUST_BASELINE) {
    const trust = safeJson(localStorage.getItem(TRUST_KEY), {}) || {};
    return normalizedTrustScore(trust[String(userId)] ?? fallback);
}

function calculateTrustDelta(values) {
    const numericValues = values.map((value) => Number(value));
    if (numericValues.length && numericValues.every((value) => Number.isFinite(value) && value >= 1 && value <= 5)) {
        const average = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
        return Math.round((average - 3) * 2);
    }
    const positive = values.filter((value) => value === 'positive').length;
    const negative = values.filter((value) => value === 'negative').length;
    return positive * TRUST_POSITIVE_DELTA - negative * TRUST_NEGATIVE_DELTA;
}

function seedGroups() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const inThreeDays = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const inFourDays = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
    const inFiveDays = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();
    const inSixDays = new Date(Date.now() + 144 * 60 * 60 * 1000).toISOString();
    const inSevenDays = new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString();
    const inEightDays = new Date(Date.now() + 192 * 60 * 60 * 1000).toISOString();
    const inNineDays = new Date(Date.now() + 216 * 60 * 60 * 1000).toISOString();
    const inTenDays = new Date(Date.now() + 240 * 60 * 60 * 1000).toISOString();
    return [
        {
            id: 'seed-walk', title: '망원 한강공원 가볍게 산책하실 분',
            purpose: '퇴근 후 동네 산책과 가벼운 대화',
            description: '날씨가 좋은 날 함께 걷고 캔커피를 마시는 모임입니다.',
            location: '망원 한강공원 입구', scheduledAt: tomorrow,
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: 'all', category: '운동', hostTrustScore: 61,
            participantIds: [], privateGenderCounts: { male: 2, female: 0 }
        },
        {
            id: 'seed-reading', title: '동네 도서관에서 각자 책 읽기',
            purpose: '말없이 각자 책을 읽고 안전하게 귀가하기',
            description: '대화를 강요하지 않고 같은 공간에서 각자의 시간을 보냅니다.',
            location: '마포 중앙도서관 1층', scheduledAt: dayAfter,
            status: 'recruiting', participants: 1, maxParticipants: 4, ageGroup: '20s', category: '독서·스터디', hostTrustScore: 48,
            participantIds: [], privateGenderCounts: { male: 1, female: 0 }
        },
        {
            id: 'seed-moms', title: '40대 엄마들의 학원·교육 정보 나눔',
            purpose: '아이 학원과 지역 교육 정보를 편하게 공유',
            description: '어린 자녀를 둔 이웃끼리 공개된 카페에서 정보를 나눕니다.',
            location: '상암 주민센터 열린공간', scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: '40s', category: '친목·정보 공유', hostTrustScore: 73,
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-running', title: '초보 러너를 위한 주말 러닝 크루',
            purpose: '천천히 달리며 함께 운동 습관 만들기',
            description: '속도를 맞추고 중간 휴식을 포함하는 초보자 중심 러닝입니다.',
            location: '월드컵공원 평화광장', scheduledAt: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: 'all', category: '운동', hostTrustScore: 57,
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-ai-study', title: '30대 직장인을 위한 AI 활용 스터디',
            purpose: '업무에 바로 쓰는 AI 활용법을 함께 실습',
            description: '각자 사례를 가져와 서로의 방법을 나누고 다음 주 실천 목표를 정합니다.',
            location: '합정 공유오피스 라운지', scheduledAt: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: '20~30대', category: 'AI 활용 스터디', hostTrustScore: 66,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-history', title: '50대 이상과 함께하는 역사 유적 답사',
            purpose: '천천히 걸으며 지역의 역사와 이야기를 나누기',
            description: '무리하지 않는 동선으로 박물관과 유적을 함께 둘러봅니다.',
            location: '서대문형무소역사관 정문', scheduledAt: inSixDays,
            status: 'recruiting', participants: 4, maxParticipants: 6, ageGroup: '50plus', category: '역사 탐방 및 세미나', hostTrustScore: 45,
            participantIds: [], privateGenderCounts: { male: 3, female: 1 }
        },
        {
            id: 'seed-writing', title: '일요일 아침 조용한 글쓰기',
            purpose: '각자 쓰고 싶은 문장을 가져와 천천히 시작하기',
            description: '말을 많이 하지 않아도 괜찮은 50분 글쓰기 시간입니다.',
            location: '연남동 작은 도서관', scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 1, maxParticipants: 5, ageGroup: 'all', category: '글쓰기 모임', hostTrustScore: 52,
            participantIds: [], privateGenderCounts: { male: 1, female: 0 }
        },
        {
            id: 'seed-photo', title: '휴대폰 사진으로 동네 기록하기',
            purpose: '잘 찍는 법보다 오늘 본 장면을 함께 남기기',
            description: '사진 한 장만 가져와도 참여할 수 있는 느린 산책입니다.',
            location: '망원시장 입구', scheduledAt: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '사진 산책', hostTrustScore: 64,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-drawing', title: '카페에서 30분 드로잉',
            purpose: '서로의 그림을 평가하지 않고 각자 그려보기',
            description: '준비물이 없어도 괜찮도록 간단한 도구를 함께 준비해요.',
            location: '합정 조용한 카페', scheduledAt: new Date(Date.now() + 54 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 1, maxParticipants: 4, ageGroup: 'all', category: '그림 그리기', hostTrustScore: 47,
            participantIds: [], privateGenderCounts: { male: 0, female: 1 }
        },
        {
            id: 'seed-music', title: '퇴근 후 이어폰 음악 나누기',
            purpose: '좋아하는 곡 하나씩만 소개하며 가볍게 듣기',
            description: '말보다 음악이 편한 날에도 함께 있을 수 있는 모임입니다.',
            location: '상수 음악감상실', scheduledAt: inThreeDays,
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '악기·음악 모임', hostTrustScore: 71,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-yoga', title: '초보자를 위한 저녁 요가',
            purpose: '몸을 천천히 풀며 하루의 긴장을 덜어내기',
            description: '동작을 따라가기 어려워도 쉬어갈 수 있는 초보 수업입니다.',
            location: '연희동 주민센터 체육실', scheduledAt: inFourDays,
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: 'all', category: '요가 모임', hostTrustScore: 58,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-cafe', title: '말없이 앉아도 좋은 카페 한 시간',
            purpose: '각자 시간을 보내다 원하면 짧게 안부 나누기',
            description: '처음 만난 사이에도 침묵이 어색하지 않은 자리를 만들어요.',
            location: '공덕역 북카페', scheduledAt: inFiveDays,
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '카페 모임', hostTrustScore: 43,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-brunch', title: '주말 브런치와 느린 안부',
            purpose: '식사 속도에 맞춰 부담 없이 대화하기',
            description: '대화에 참여하지 않아도 괜찮은 작은 테이블입니다.',
            location: '망원동 브런치 식당', scheduledAt: inSevenDays,
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: '20~30대', category: '브런치 모임', hostTrustScore: 76,
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-steam', title: '처음 만난 사람과 스팀 협동게임',
            purpose: '실수해도 웃고 다시 해보는 협동 플레이',
            description: '게임을 잘하지 않아도 천천히 규칙을 익혀요.',
            location: '홍대 보드게임 라운지', scheduledAt: inFiveDays,
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: 'all', category: '스팀 협동게임', hostTrustScore: 62,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-nintendo', title: '닌텐도 스위치 가볍게 한 판',
            purpose: '승패보다 서로의 속도에 맞춰 즐기기',
            description: '컨트롤러를 처음 잡는 분도 함께 시작할 수 있어요.',
            location: '신촌 게임카페', scheduledAt: inEightDays,
            status: 'recruiting', participants: 1, maxParticipants: 4, ageGroup: 'all', category: '닌텐도 모임', hostTrustScore: 54,
            participantIds: [], privateGenderCounts: { male: 1, female: 0 }
        },
        {
            id: 'seed-mystery', title: '초보자를 위한 추리 게임 모임',
            purpose: '단서를 함께 살피고 천천히 결말을 찾아가기',
            description: '말할 차례를 기다려주는 편안한 추리 게임입니다.',
            location: '이태원 추리카페', scheduledAt: inTenDays,
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: '30s', category: '추리 게임 모임', hostTrustScore: 69,
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-exhibition', title: '전시를 보고 한 줄 감상만 나누기',
            purpose: '각자 천천히 관람하고 원하면 한 문장 남기기',
            description: '감상을 길게 설명하지 않아도 서로의 시선을 존중해요.',
            location: '서울시립미술관 서소문관', scheduledAt: inFourDays,
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '전시회 관람', hostTrustScore: 49,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-theater', title: '동네 극장 함께 가기',
            purpose: '공연 전후로 각자의 방식으로 시간을 보내기',
            description: '공연이 끝난 뒤 바로 헤어져도 자연스러운 관람 모임입니다.',
            location: '대학로 소극장 앞', scheduledAt: inNineDays,
            status: 'recruiting', participants: 1, maxParticipants: 4, ageGroup: '20s', category: '연극 관람', hostTrustScore: 74,
            participantIds: [], privateGenderCounts: { male: 0, female: 1 }
        },
        {
            id: 'seed-plogging', title: '아침 40분 동네 플로깅',
            purpose: '가볍게 걸으며 집 근처를 함께 돌보기',
            description: '봉투와 집게는 준비되어 있어 빈손으로 와도 괜찮아요.',
            location: '불광천 산책로 입구', scheduledAt: inThreeDays,
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: 'all', category: '플로깅 모임', hostTrustScore: 63,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-animal', title: '유기동물 보호소 물품 정리',
            purpose: '두 시간 동안 필요한 일을 조용히 나눠 하기',
            description: '동물을 직접 만지지 않아도 참여할 수 있는 봉사입니다.',
            location: '마포구 유기동물 보호소', scheduledAt: inSixDays,
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: 'all', category: '유기동물 봉사', hostTrustScore: 78,
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-environment', title: '하천 주변 환경정화 산책',
            purpose: '걷는 김에 작은 쓰레기를 함께 줍기',
            description: '대화보다 활동에 집중해도 괜찮은 주말 봉사 모임입니다.',
            location: '홍제천 자전거길', scheduledAt: inEightDays,
            status: 'recruiting', participants: 1, maxParticipants: 5, ageGroup: '40s', category: '환경정화 활동', hostTrustScore: 56,
            participantIds: [], privateGenderCounts: { male: 1, female: 0 }
        },
        {
            id: 'seed-side-project', title: '작게 시작하는 사이드 프로젝트',
            purpose: '아이디어를 한 장으로 정리하고 다음 행동 정하기',
            description: '완성된 계획 없이 와도 서로의 첫 단계를 응원해요.',
            location: '을지로 공유공간', scheduledAt: inFiveDays,
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '사이드 프로젝트', hostTrustScore: 67,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-app', title: '생활 속 불편을 앱 아이디어로',
            purpose: '각자 겪은 불편을 듣고 작은 해결책을 그려보기',
            description: '개발 경험이 없어도 관찰한 문제를 가져오면 충분해요.',
            location: '성수 메이커스 라운지', scheduledAt: inSevenDays,
            status: 'recruiting', participants: 1, maxParticipants: 6, ageGroup: '20~30대', category: '앱 개발 프로젝트', hostTrustScore: 51,
            participantIds: [], privateGenderCounts: { male: 1, female: 0 }
        },
        {
            id: 'seed-content', title: '동네 이야기를 담는 콘텐츠 팀',
            purpose: '사진·글·영상 중 편한 방식으로 한 편 만들기',
            description: '역할을 작게 나눠 혼자보다 가벼운 시작을 도와요.',
            location: '연남동 커뮤니티 스튜디오', scheduledAt: inNineDays,
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: 'all', category: '영상 제작 팀', hostTrustScore: 72,
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-baking', title: '처음 해보는 작은 베이킹',
            purpose: '반죽부터 포장까지 천천히 함께 해보기',
            description: '모양이 달라도 괜찮은 소규모 원데이 클래스예요.',
            location: '망원동 공유주방', scheduledAt: inFourDays,
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '베이킹 클래스', hostTrustScore: 59,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-cooking', title: '한 가지 요리만 같이 만들기',
            purpose: '각자 맡은 재료를 준비하며 천천히 친해지기',
            description: '요리를 잘하지 않아도 역할을 나눠 함께 완성해요.',
            location: '합정 공유주방', scheduledAt: inSevenDays,
            status: 'recruiting', participants: 1, maxParticipants: 4, ageGroup: '30s', category: '요리 모임', hostTrustScore: 46,
            participantIds: [], privateGenderCounts: { male: 0, female: 1 }
        },
        {
            id: 'seed-pottery', title: '흙을 만지는 조용한 도예 체험',
            purpose: '손을 움직이며 잠깐 일상에서 벗어나기',
            description: '완성도가 아니라 만드는 과정에 집중하는 체험입니다.',
            location: '연희동 도예공방', scheduledAt: inTenDays,
            status: 'recruiting', participants: 2, maxParticipants: 5, ageGroup: 'all', category: '도예 체험', hostTrustScore: 65,
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        }
    ];
}

const ACTIVITY_TYPES = [
    '공부·자기계발', '독서 모임', '영어 회화 모임', '일본어 스터디', '코딩 스터디', 'AI 활용 스터디',
    '자격증 준비 모임', '토론 모임', '논문 읽기 모임', '역사 탐방 및 세미나', '글쓰기 모임',
    '보드게임 모임', '방탈출 모임', '영화 감상 모임', '드라마 정주행 모임', '사진 출사 모임',
    '그림 그리기 모임', '뜨개질 모임', '캘리그래피 모임', '악기 합주 모임', '합창 모임',
    '노래방 모임', 'K-POP 커버댄스 모임', '러닝 크루', '등산 모임', '배드민턴 모임', '풋살 모임',
    '농구 모임', '볼링 모임', '탁구 모임', '클라이밍 모임', '자전거 라이딩 모임', '요가 모임',
    '맛집 탐방 모임', '카페 투어', '브런치 모임', '피크닉 모임', '여행 모임', '드라이브 모임',
    '캠핑 모임', '와인·티 모임', '리그 오브 레전드 내전', '발로란트 파티', '마인크래프트 서버',
    '스팀 협동게임 모임', '닌텐도 스위치 모임', '모바일 게임 길드 모임', '추리 게임 모임',
    '연극 관람', '뮤지컬 관람', '전시회 관람', '박물관 탐방', '역사 유적 답사', '축제 함께 가기',
    '콘서트 관람', '버스킹 관람', '플로깅 모임', '유기동물 봉사', '환경정화 활동', '교육봉사',
    '헌혈 캠페인 참여', '지역 축제 봉사', '창업 모임', '사이드 프로젝트', '앱 개발 프로젝트',
    '게임 개발 팀', '공모전 팀', '해커톤 팀', '영상 제작 팀', '팟캐스트 제작', '유튜브 콘텐츠 제작',
    '책 출판 프로젝트', '베이킹 클래스', '요리 모임', '바리스타 체험', '도예 체험', '향수 만들기',
    '비누 만들기', '꽃꽂이 클래스', '원데이 클래스 투어', '엄마들 정보 공유 모임'
];

const ACTIVITY_FAMILIES = [
    { id: 'study', label: '공부·자기계발', match: /스터디|공부|회화|코딩|AI 활용|자격증|토론|논문|역사|글쓰기|엄마들 정보/ },
    { id: 'hobby', label: '취미', match: /보드게임|방탈출|영화|드라마|사진|그림|뜨개질|캘리그래피|악기|합창|노래방|K-POP/ },
    { id: 'sports', label: '운동', match: /운동|러닝|등산|배드민턴|풋살|농구|볼링|탁구|클라이밍|자전거|요가|산책/ },
    { id: 'social', label: '친목', match: /맛집|카페|브런치|피크닉|여행|드라이브|캠핑|와인|친목/ },
    { id: 'game', label: '게임', match: /리그 오브 레전드|발로란트|마인크래프트|스팀|닌텐도|모바일 게임|추리 게임/ },
    { id: 'culture', label: '문화생활', match: /연극|뮤지컬|전시|박물관|역사 유적|축제|콘서트|버스킹/ },
    { id: 'community', label: '봉사·사회활동', match: /플로깅|유기동물|환경정화|교육봉사|헌혈|지역 축제 봉사/ },
    { id: 'project', label: '프로젝트', match: /창업|사이드 프로젝트|앱 개발|게임 개발|공모전|해커톤|영상 제작|팟캐스트|유튜브|책 출판/ },
    { id: 'other', label: '기타', match: /베이킹|요리|바리스타|도예|향수|비누|꽃꽂이|원데이|기타/ }
];

const ACTIVITY_EXAMPLES = [
    { family: 'study', title: '한 페이지씩 읽는 저녁 독서', description: '말하지 않아도 괜찮고, 마지막에 한 줄만 나눠요.' },
    { family: 'study', title: '퇴근 후 40분 코딩 함께하기', description: '각자 할 일을 가져와 조용히 집중해요.' },
    { family: 'hobby', title: '동네 사진 한 컷 산책', description: '잘 찍지 않아도 괜찮은 느린 사진 산책이에요.' },
    { family: 'hobby', title: '뜨개질 손을 쉬지 않는 시간', description: '각자 만들며 필요할 때만 대화해요.' },
    { family: 'sports', title: '천천히 동네 한 바퀴', description: '속도보다 함께 걷는 시간을 소중히 여겨요.' },
    { family: 'sports', title: '자전거 길을 가볍게 익히기', description: '각자 페이스를 지키며 쉬어 가요.' },
    { family: 'social', title: '커피 한 잔, 가벼운 안부', description: '처음이라도 부담 없이 1시간만 만나요.' },
    { family: 'social', title: '동네 브런치 한 접시', description: '대화가 길어지지 않아도 괜찮은 느슨한 자리예요.' },
    { family: 'game', title: '협동 게임 한 판', description: '승패보다 같이 익히는 과정을 즐겨요.' },
    { family: 'game', title: '처음 하는 보드게임 배우기', description: '규칙을 천천히 설명하며 함께 시작해요.' },
    { family: 'culture', title: '전시 보고 각자 한 줄 감상', description: '감상을 길게 말하지 않아도 괜찮아요.' },
    { family: 'culture', title: '동네 극장 조용한 관람', description: '보고 난 뒤 원하면 짧은 감상만 나눠요.' },
    { family: 'community', title: '주말 공원 플로깅', description: '동네를 가볍게 돌며 작은 변화를 만들어요.' },
    { family: 'community', title: '보호소 물품 정리 돕기', description: '필요한 일을 나누며 무리 없이 참여해요.' },
    { family: 'project', title: '작은 앱 아이디어 노트', description: '완성보다 시작을 함께 응원하는 모임이에요.' },
    { family: 'project', title: '포트폴리오 한 페이지 다듬기', description: '각자 작업하고 막힐 때만 가볍게 물어봐요.' },
    { family: 'other', title: '도예 소품 한 가지 만들기', description: '처음 만져봐도 괜찮은 원데이 작업이에요.' },
    { family: 'other', title: '계절 꽃 한 송이 고르기', description: '가까운 동네에서 취향을 천천히 나눠요.' }
];

function activityFamilyForType(type) {
    return ACTIVITY_FAMILIES.find((family) => family.match.test(String(type || '')))?.id || 'other';
}

function activityFamilyLabel(familyId) {
    return ACTIVITY_FAMILIES.find((family) => family.id === familyId)?.label || '기타';
}

const CONVERSATION_LEVEL_LABELS = {
    quiet: '대화 부담 낮음',
    light_conversation: '대화 부담 보통',
    active: '대화 중심'
};

function conversationLevelLabel(level) {
    return CONVERSATION_LEVEL_LABELS[level] || CONVERSATION_LEVEL_LABELS.light_conversation;
}

function inferConversationLevel(group) {
    const text = normalizeSafetyText(`${group.title || ''} ${group.purpose || ''} ${group.description || ''}`);
    if (/말없이|각자|조용|대화강요없/.test(text)) return 'quiet';
    if (/대화|이야기|공유|토론|회화|합주|합창/.test(text)) return 'light_conversation';
    return 'active';
}

function ensureGroupMetadata(group) {
    group.ageGroups = normalizeActivityAgeGroups(group.ageGroups || group.ageGroup);
    group.ageGroup = group.ageGroups[0];
    group.audienceType = group.ageGroups.includes('all') ? 'all_ages' : 'age_specific';
    group.category = group.category || '기타 모임';
    group.categoryFamily = ACTIVITY_FAMILIES.some((family) => family.id === group.categoryFamily) ? group.categoryFamily : activityFamilyForType(group.category);
    group.conversationLevel = group.conversationLevel || inferConversationLevel(group);
    group.beginnerFriendly = group.beginnerFriendly !== false;
    group.durationMinutes = Number(group.durationMinutes) > 0 ? Number(group.durationMinutes) : 60;
    group.hostTrustScore = getTrustProjection(group.creatorId, group.hostTrustScore);
    if (!privateGroupState.has(group.id)) {
        privateGroupState.set(group.id, group.privateGenderCounts || { male: group.participants || 0, female: 0 });
    }
    delete group.privateGenderCounts;
    return group;
}

const persistence = {
    load() {
        const stored = safeJson(localStorage.getItem(GROUPS_KEY), null);
        state.groups = Array.isArray(stored) && stored.length ? stored : seedGroups();
        const existingIds = new Set(state.groups.map((group) => group.id));
        seedGroups().filter((group) => !existingIds.has(group.id)).forEach((group) => state.groups.push(group));
        state.groups = state.groups.map(ensureGroupMetadata);
        this.save();
    },
    save() {
        const publicGroups = state.groups.map(({ privateGenderCounts, ...group }) => group);
        localStorage.setItem(GROUPS_KEY, JSON.stringify(publicGroups));
    },
    publish(group) {
        state.groups.unshift(group);
        this.save();
        window.dispatchEvent(new CustomEvent('dg:groups-changed'));
    },
    update(group) {
        const index = state.groups.findIndex((item) => item.id === group.id);
        if (index >= 0) state.groups[index] = group;
        this.save();
        window.dispatchEvent(new CustomEvent('dg:groups-changed'));
    }
};

function remoteActivityFromRow(row) {
    return {
        id: row.id,
        title: row.title,
        purpose: row.purpose,
        description: row.description,
        location: row.location,
        scheduledAt: row.scheduled_at,
        status: row.status,
        participants: Number(row.participant_count || 1),
        maxParticipants: Number(row.max_participants),
        ageGroup: row.age_group,
        category: row.category,
        categoryFamily: row.category_family,
        creatorId: row.creator_id,
        hostTrustScore: Number(row.host_trust_score),
        participantIds: [],
        remote: true,
        updatedAt: row.updated_at
    };
}

async function loadRemoteActivities() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('activities')
        .select('id,creator_id,host_nickname,host_trust_score,title,purpose,description,location,scheduled_at,category,category_family,age_group,participant_count,max_participants,status,updated_at')
        .order('scheduled_at', { ascending: true });
    if (error) throw error;
    const remoteGroups = (data || []).map(remoteActivityFromRow);
    const byId = new Map(remoteGroups.map((group) => [group.id, group]));
    state.groups = state.groups.map((group) => byId.get(group.id) || group);
    const localIds = new Set(state.groups.map((group) => group.id));
    remoteGroups.filter((group) => !localIds.has(group.id)).forEach((group) => state.groups.push(group));
    state.groups = state.groups.map(ensureGroupMetadata);
    persistence.save();
    renderGroups();
}

async function loadRemoteMemberships() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('activity_participants').select('activity_id').eq('status', 'confirmed');
    if (error) throw error;
    state.remoteJoinedGroupIds = new Set((data || []).map((row) => String(row.activity_id)));
    state.remoteJoinedGroupIds.forEach((activityId) => state.joinedGroupIds.add(activityId));
    renderGroups();
}

async function persistRemoteActivity(activity) {
    if (!supabaseClient) return;
    const row = {
        id: activity.id,
        creator_id: activity.creatorId,
        host_nickname: state.user.nickname,
        host_trust_score: activity.hostTrustScore,
        title: activity.title,
        purpose: activity.purpose,
        description: activity.description,
        location: activity.location,
        scheduled_at: activity.scheduledAt,
        category: activity.category,
        category_family: activity.categoryFamily,
        age_group: activity.ageGroup,
        participant_count: 1,
        max_participants: activity.maxParticipants,
        status: 'pending'
    };
    const { error: insertError } = await supabaseClient.from('activities').insert(row);
    if (insertError) throw insertError;
    const { error: publishError } = await supabaseClient.from('activities')
        .update({ status: 'recruiting', updated_at: new Date().toISOString() })
        .eq('id', activity.id)
        .eq('creator_id', activity.creatorId);
    if (publishError) throw publishError;
    activity.remote = true;
}

function loadNotifications() {
    state.notifications = safeJson(localStorage.getItem(NOTIFICATIONS_KEY), []);
    if (!Array.isArray(state.notifications)) state.notifications = [];
}

function saveNotifications() {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(state.notifications.slice(-30)));
}

function normalizeSafetyText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s_\-.~!@#$%^&*()[\]{}:;,'"`/\\|]+/g, '');
}

const safetyRules = [
    { category: 'dating', terms: ['성비', '헌팅', '연애', '훈남훈녀', '남녀모집', '소개팅', '썸', '애인', '이성만', '남자만', '여자만'], guidance: '성별이나 연애 목적이 아닌 활동 중심으로 내용을 수정해 주세요.' },
    { category: 'sales', terms: ['다단계', '영업', '광고', '재테크설명회', '제품소개', '판매', '홍보', '구매유도', '수익보장', '투자', '권유'], guidance: '판매, 홍보, 모집, 투자 권유 표현을 제거해 주세요.' },
    { category: 'scam', terms: ['원금보장', '고수익', '비밀투자', '송금', '대출알선', '수익인증'], guidance: '금전 거래, 투자 권유, 송금 요청은 허용되지 않습니다.' },
    { category: 'proselytizing', terms: ['포교', '교회말씀공부', '말씀공부', '심리테스트해드려요', '종교전파', '기도모임', '교회'], guidance: '특정 종교나 신념을 전파하는 목적은 허용되지 않습니다.' },
    { category: 'harassment', terms: ['괴롭힘', '협박', '불법촬영', '신상털기', '몰래촬영'], guidance: '타인을 위협하거나 침해하는 내용을 제거해 주세요.' },
    { category: 'recruitment', terms: ['가입비', '회원모집', '팀원모집', '부업', '설문조사'], guidance: '서비스와 무관한 모집·가입·홍보 목적을 제거해 주세요.' }
];

const ambiguousSafetySignals = [
    { category: 'context_unclear', terms: ['좋은분들만', '비밀스럽게', '조건맞는분', '자연스럽게친해져요', '특별한만남'], guidance: '활동 내용과 참여 조건을 구체적으로 공개된 장소 중심으로 작성해 주세요.' }
];

function operationLog(operation, outcome, startedAt, extra = {}) {
    const logs = safeJson(localStorage.getItem(OPERATIONS_KEY), []);
    logs.push({ operation, outcome, latencyMs: Date.now() - startedAt, retryCount: extra.retryCount || 0, category: extra.category || '', policyVersion: extra.policyVersion || 'safety-v1', createdAt: new Date().toISOString() });
    localStorage.setItem(OPERATIONS_KEY, JSON.stringify(logs.slice(-100)));
}

const injectionPatterns = [
    /ignore\s+(all|previous|earlier)\s+instructions/i,
    /시스템\s*프롬프트|규칙을\s*무시|이전\s*지시를\s*무시/i,
    /api\s*key|비밀\s*키|토큰을\s*알려/i
];

function maskSensitive(value) {
    return String(value || '')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(/(?:\+?82[- ]?)?0?1[0-9][- ]?\d{3,4}[- ]?\d{4}/g, '[phone]');
}

function guardRecommendationInput(value) {
    const masked = maskSensitive(value).trim();
    if (!masked) return { ok: true, value: '' };
    if (masked !== value.trim()) return { ok: false, message: '이메일·전화번호 같은 개인정보는 입력하지 말아 주세요.' };
    if (injectionPatterns.some((pattern) => pattern.test(masked))) return { ok: false, message: '서비스 목적과 관계없는 시스템 지시나 비밀정보 요청은 처리하지 않습니다.' };
    return { ok: true, value: masked.slice(0, 80) };
}

function chooseRecommendationRoute(interest) {
    return interest.length > 12 || /왜|상황|부담|조용|처음/.test(interest) ? 'protected-semantic' : 'local-fast';
}

function automationEndpoint(operation) {
    if (CONFIG.AUTOMATION_MODE === 'code' && CONFIG.CODE_AUTOMATION_URL) return CONFIG.CODE_AUTOMATION_URL;
    return operation === 'recommend' ? CONFIG.RECOMMENDATION_URL : CONFIG.SAFETY_REVIEW_URL;
}

async function requestAutomation(operation, payload, endpoint) {
    if (!endpoint) return null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ operation, requestId: crypto.randomUUID?.() || String(Date.now()), ...payload }) });
        if (!response.ok) throw new Error(`automation_${response.status}`);
        return await response.json();
    } finally { window.clearTimeout(timeout); }
}

function mockSafetyReview(activity) {
    const startedAt = Date.now();
    const text = normalizeSafetyText(`${activity.title} ${activity.purpose} ${activity.description}`);
    if (injectionPatterns.some((pattern) => pattern.test(`${activity.title} ${activity.purpose} ${activity.description}`))) {
        const result = { decision: 'manual_review', categories: ['prompt_injection'], confidence: 'low', explanation: '시스템 규칙을 바꾸려는 지시가 포함되어 운영자 검토로 보류했습니다.', guidance: '활동 목적과 참여 방법만 남겨 다시 작성해 주세요.', policyVersion: 'safety-v2-local', reviewId: `mock-${Date.now()}` };
        operationLog('safety_review', result.decision, startedAt, { category: 'prompt_injection', policyVersion: result.policyVersion });
        return result;
    }
    const rule = safetyRules.find((candidate) => candidate.terms.some((term) => text.includes(normalizeSafetyText(term))));
    if (rule) {
        const result = {
            decision: 'held', categories: [rule.category], confidence: 'high',
            explanation: '활동 목적이 안전한 동네 모임의 기준과 맞지 않을 수 있습니다.',
            guidance: rule.guidance, policyVersion: 'safety-v2-local', reviewId: `mock-${Date.now()}`
        };
        operationLog('safety_review', result.decision, startedAt, { category: rule.category, policyVersion: result.policyVersion });
        return result;
    }
    const ambiguous = ambiguousSafetySignals.find((candidate) => candidate.terms.some((term) => text.includes(normalizeSafetyText(term))));
    if (ambiguous) {
        const result = { decision: 'manual_review', categories: [ambiguous.category], confidence: 'low', explanation: '표현만으로 활동 의도를 충분히 확인하기 어려워 운영자 검토로 보류했습니다.', guidance: ambiguous.guidance, policyVersion: 'safety-v2-local', reviewId: `mock-${Date.now()}` };
        operationLog('safety_review', result.decision, startedAt, { category: ambiguous.category, policyVersion: result.policyVersion });
        return result;
    }
    const result = { decision: 'approved', categories: [], confidence: 'high', explanation: '활동 목적과 공개 장소를 확인했습니다.', guidance: '', policyVersion: 'safety-v2-local', reviewId: `mock-${Date.now()}` };
    operationLog('safety_review', result.decision, startedAt, { policyVersion: result.policyVersion });
    return result;
}

function validateSafetyResponse(result) {
    const allowed = ['approved', 'held', 'manual_review', 'unavailable'];
    if (!result || !allowed.includes(result.decision)) return null;
    return { ...result, categories: Array.isArray(result.categories) ? result.categories : [], confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low', explanation: String(result.explanation || ''), guidance: String(result.guidance || ''), policyVersion: String(result.policyVersion || 'safety-v2') };
}

async function safetyReview(activity) {
    const endpoint = automationEndpoint('safety_review');
    if (!endpoint) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        return mockSafetyReview(activity);
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
            body: JSON.stringify({ operation: 'safety_review', requestId: crypto.randomUUID?.() || String(Date.now()), activity: { title: activity.title, purpose: activity.purpose, description: activity.description, location: activity.location, scheduledAt: activity.scheduledAt, maxParticipants: activity.maxParticipants } })
        });
        if (!response.ok) throw new Error(`automation_${response.status}`);
        const result = validateSafetyResponse(await response.json());
        if (!result) throw new Error('invalid_automation_response');
        operationLog('safety_review', result.decision, startedAt, { category: result.categories[0], policyVersion: result.policyVersion });
        return result;
    } catch (error) {
        operationLog('safety_review', 'unavailable', startedAt, { retryCount: 1 });
        return { decision: 'unavailable', categories: [], confidence: 'low', explanation: '안전 검토 서비스를 사용할 수 없습니다.', guidance: '잠시 후 다시 시도하거나 운영자 검토를 요청해 주세요.' };
    } finally { window.clearTimeout(timeout); }
}

function setStatus(message, tone = 'info') {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
}

function setInlineStatus(element, message, tone = 'warning') {
    if (element) {
        element.textContent = message;
        element.dataset.tone = tone;
    }
    setStatus(message, tone);
    return false;
}

function setSignupStatus(message, tone = 'warning', focusId = '') {
    setInlineStatus(elements.signupSubmitStatus, message, tone);
    if (focusId) $(focusId)?.focus();
    return false;
}

function setLoginStatus(message, tone = 'warning', focusId = '') {
    if (focusId) $(focusId)?.focus();
    return setInlineStatus(elements.loginSubmitStatus, message, tone);
}

function setNicknameStatus(message, tone = 'warning', focusId = '') {
    if (focusId) $(focusId)?.focus();
    return setInlineStatus(elements.nicknameSetupStatus, message, tone);
}

function setProfileStatus(message, tone = 'warning', focusId = '') {
    if (focusId) $(focusId)?.focus();
    return setInlineStatus(elements.profileStatus, message, tone);
}

function setFeedbackStatus(message, tone = 'warning', focusId = '') {
    if (focusId) $(focusId)?.focus();
    return setInlineStatus(elements.feedbackSubmitStatus, message, tone);
}

function setLoading(isLoading) {
    elements.loader.classList.toggle('hidden', !isLoading);
    elements.submit.disabled = isLoading;
}

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '일정 미정' : date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(minutes) {
    const value = Number(minutes);
    if (value >= 180) return '3시간 이상';
    if (value >= 60) return `${Math.floor(value / 60)}시간${value % 60 ? ` ${value % 60}분` : ''}`;
    return `${value || 60}분`;
}

function statusLabel(status) {
    return { recruiting: '모집 중', confirmed: '확정', cancelled: '취소됨', pending: '검토 중', completed: '완료' }[status] || status;
}

function createText(tag, value, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
}

function groupMatchesFilters(group) {
    const query = normalizeSafetyText(state.filters.query);
    ensureGroupMetadata(group);
    const searchable = normalizeSafetyText(`${group.title} ${group.purpose} ${group.description} ${group.category} ${conversationLevelLabel(group.conversationLevel)}`);
    const queryMatches = !query || searchable.includes(query);
    const ageMatches = ageFilterMatchesGroup(group.ageGroups, state.filters.ageGroup, getViewerAgeGroup());
    const categoryMatches = state.filters.category === 'all' || group.categoryFamily === state.filters.category;
    return queryMatches && ageMatches && categoryMatches;
}

function isAvailableForDiscovery(group) {
    return !state.user || !state.joinedGroupIds.has(group.id);
}

function orderDiscoveryGroups(groups) {
    const sorted = sortGroupsForActivitySettings(groups);
    const groupsById = new Map(sorted.map((group) => [String(group.id), group]));
    const recommended = state.recommendedGroupIds.map((id) => groupsById.get(String(id))).filter(Boolean);
    const recommendedIds = new Set(recommended.map((group) => String(group.id)));
    return { groups: [...recommended, ...sorted.filter((group) => !recommendedIds.has(String(group.id)))], recommendedIds, recommendedCount: recommended.length };
}

function renderAgeFilters() {
    if (!elements.ageFilters) return;
    elements.ageFilters.replaceChildren();
    [['all', '전체 연령'], ['mine', '내 연령대만']].forEach(([value, label]) => {
        const button = createText('button', label, `filter-btn${state.filters.ageGroup === value ? ' active' : ''}`);
        button.type = 'button';
        button.dataset.ageFilter = value;
        button.setAttribute('aria-pressed', String(state.filters.ageGroup === value));
        if (value === 'mine' && (!state.user || getViewerAgeGroup() === 'all')) {
            button.disabled = true;
            button.title = '로그인 후 내 연령대의 활동을 볼 수 있어요.';
        } else {
            button.addEventListener('click', () => { state.filters.ageGroup = value; renderGroups(); setStatus(`${label} 기준으로 활동을 보고 있어요.`, 'success'); });
        }
        elements.ageFilters.append(button);
    });
}

function renderCategoryFilters() {
    if (!elements.categoryFilters) return;
    elements.categoryFilters.replaceChildren();
    const recruiting = state.groups.filter((group) => group.status === 'recruiting' && isAvailableForDiscovery(group)).map(ensureGroupMetadata);
    const options = [{ id: 'all', label: '전체 활동' }, ...ACTIVITY_FAMILIES.map((family) => ({ id: family.id, label: family.label }))];
    options.forEach(({ id, label }) => {
        const count = id === 'all' ? recruiting.length : recruiting.filter((group) => group.categoryFamily === id).length;
        const button = createText('button', `${label} ${count}`, `category-filter${state.filters.category === id ? ' active' : ''}`);
        button.type = 'button';
        button.dataset.categoryFilter = id;
        button.addEventListener('click', () => { state.filters.category = id; renderGroups(); setStatus(`${label} 활동을 보고 있어요.`, 'success'); });
        elements.categoryFilters.append(button);
    });
}

function renderGroups() {
    elements.list.replaceChildren();
    const ordered = orderDiscoveryGroups(state.groups.filter((group) => group.status === 'recruiting' && isAvailableForDiscovery(group) && groupMatchesFilters(group)));
    const recruiting = ordered.groups;
    if (elements.groupCount) elements.groupCount.textContent = `${recruiting.length}개 모집 중`;
    elements.empty.textContent = state.filters.query || state.filters.ageGroup !== 'all' || state.filters.category !== 'all'
        ? '조건에 맞는 모집방이 없어요. 검색어나 연령대 필터를 바꿔보세요.'
        : '아직 열린 활동이 없어요. 로그인 후 부담 없는 첫 만남을 만들어 보세요.';
    elements.empty.classList.toggle('hidden', recruiting.length > 0);
    renderAgeFilters();
    renderCategoryFilters();
    recruiting.forEach((group, index) => {
        if (ordered.recommendedCount && index === ordered.recommendedCount) elements.list.append(createText('p', '그다음 활동은 날짜가 빠른 순서, 같은 날짜에는 가까운 거리 순서예요.', 'activity-order-divider'));
        ensureGroupMetadata(group);
        const card = document.createElement('article');
        card.id = `activity-${group.id}`;
        card.className = 'group-card';
        const isRecommended = ordered.recommendedIds.has(String(group.id));
        const ageBadge = createText('span', group.ageGroup === 'all' ? '🌈 전체 연령 참여 가능' : '🌱 내 연령대 참여', `age-badge${group.ageGroup === 'all' ? ' age-all' : ''}`);
        const temperature = normalizedTrustScore(group.hostTrustScore);
        const temperatureBadge = createText('span', `🌡 개설자 함께하기 신뢰도 ${temperature.toFixed(1)}°C`, `temperature-badge ${trustScoreClass(temperature)}`);
        temperatureBadge.title = '시간 약속·배려와 매너·규칙 준수에 기반한 공개 지표입니다. 인기나 외모를 평가하지 않습니다.';
        const contextBadges = document.createElement('div');
        contextBadges.className = 'activity-context-badges';
        contextBadges.append(
            createText('span', `💬 ${conversationLevelLabel(group.conversationLevel)}`, 'context-badge'),
            createText('span', group.beginnerFriendly ? '🌱 초보 참여 가능' : '경험자 중심', 'context-badge'),
            createText('span', `⏱ ${formatDuration(group.durationMinutes)}`, 'context-badge')
        );
        const distance = activityDistanceKm(group);
        const locationLabel = Number.isFinite(distance) ? `📍 ${group.location} · 약 ${distance.toFixed(1)}km` : `📍 ${group.location}`;
        card.append(
            ...(isRecommended ? [createText('span', '✦ AI 추천 모임', 'ai-recommendation-badge')] : []),
            ageBadge,
            createText('span', `${activityFamilyLabel(group.categoryFamily)} · ${group.category}`, 'category-badge'),
            temperatureBadge,
            contextBadges,
            createText('h3', group.title, 'card-title'),
            createText('p', group.purpose, 'card-purpose'),
            createText('p', group.description),
            createText('span', locationLabel, 'card-meta'),
            createText('span', `🕒 ${formatDate(group.scheduledAt)}`, 'card-meta'),
            createText('span', `👥 ${group.participants}/${group.maxParticipants}명 · 최소 3명`, 'card-meta')
        );
        if (isRecommended && state.recommendationReasons[String(group.id)]) card.append(createText('p', state.recommendationReasons[String(group.id)], 'ai-recommendation-reason'));
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const status = createText('span', statusLabel(group.status), `card-status status-${group.status}`);
        const join = document.createElement('button');
        join.type = 'button'; join.className = 'btn-outline';
        join.textContent = state.joinedGroupIds.has(group.id) ? '참여 취소' : '참여 신청하기';
        join.addEventListener('click', () => toggleParticipation(group.id));
        const room = document.createElement('button');
        room.type = 'button'; room.className = 'btn-text'; room.textContent = '공지방';
        room.disabled = !state.joinedGroupIds.has(group.id);
        room.title = room.disabled ? '참여 후 열 수 있어요.' : '활동 공지·채팅방 열기';
        room.addEventListener('click', () => openActivityRoom(group.id));
        const report = document.createElement('button');
        report.type = 'button'; report.className = 'btn-text'; report.textContent = '신고';
        report.addEventListener('click', () => reportActivity(group.id));
        actions.append(status, join, room, report);
        card.append(actions);
        elements.list.append(card);
    });
    renderHistory();
}

function isActivityCompleted(group) {
    return group.status === 'completed' || new Date(group.scheduledAt).getTime() <= Date.now();
}

function getConnectionCheckins() {
    const checkins = safeJson(localStorage.getItem(CONNECTION_CHECKINS_KEY), []);
    return Array.isArray(checkins) ? checkins : [];
}

function getParticipationLog() {
    const log = safeJson(localStorage.getItem(PARTICIPATION_LOG_KEY), []);
    return Array.isArray(log) ? log : [];
}

function getActivityChats() {
    const chats = safeJson(localStorage.getItem(ACTIVITY_CHAT_KEY), {});
    return chats && typeof chats === 'object' && !Array.isArray(chats) ? chats : {};
}

function saveActivityChats(chats) {
    localStorage.setItem(ACTIVITY_CHAT_KEY, JSON.stringify(chats));
}

function renderActivityRoomChat(groupId) {
    const chats = getActivityChats();
    if (!Array.isArray(chats[groupId]) || !chats[groupId].length) {
        chats[groupId] = [{ id: `room-welcome:${groupId}`, kind: 'system', nickname: '운영팀', body: '활동 공지·채팅방이 열렸어요. 장소와 시간을 확인하고, 필요한 이야기만 남겨 주세요.', createdAt: new Date().toISOString() }];
        saveActivityChats(chats);
    }
    elements.roomChatMessages.replaceChildren();
    chats[groupId].slice(-50).forEach((message) => {
        const item = document.createElement('article');
        item.className = `room-chat-message${message.userId === state.user?.id ? ' mine' : ''}`;
        item.append(createText('strong', message.nickname || '무프로필'), createText('p', message.body), createText('time', formatDate(message.createdAt)));
        elements.roomChatMessages.append(item);
    });
    elements.roomChatMessages.scrollTop = elements.roomChatMessages.scrollHeight;
}

function submitActivityRoomChat(event) {
    event.preventDefault();
    const groupId = elements.activityRoomModal.dataset.groupId;
    const group = state.groups.find((item) => item.id === groupId);
    const body = elements.roomChatInput.value.trim();
    if (!state.user || !group || !state.joinedGroupIds.has(groupId)) return setInlineStatus(elements.roomChatStatus, '참여한 활동에서만 채팅할 수 있어요.', 'warning');
    if (!body) return setInlineStatus(elements.roomChatStatus, '메시지를 입력해 주세요.', 'warning');
    const chats = getActivityChats();
    if (!Array.isArray(chats[groupId])) chats[groupId] = [];
    chats[groupId].push({ id: `chat:${Date.now()}`, kind: 'user', userId: state.user.id, nickname: state.user.nickname, body: body.slice(0, 240), createdAt: new Date().toISOString() });
    saveActivityChats(chats);
    renderActivityRoomChat(groupId);
    elements.roomChatInput.value = '';
    setInlineStatus(elements.roomChatStatus, '닉네임으로 메시지를 남겼어요.', 'success');
}

function recordParticipationEvent(group, action) {
    if (!state.user || !group) return;
    const log = getParticipationLog();
    log.push({ groupId: group.id, userId: state.user.id, nickname: state.user.nickname, action, createdAt: new Date().toISOString() });
    localStorage.setItem(PARTICIPATION_LOG_KEY, JSON.stringify(log.slice(-100)));
}

function openActivityRoom(groupId) {
    if (!state.user) return setStatus('로그인 후 활동 공지방을 확인할 수 있습니다.', 'warning');
    const group = state.groups.find((item) => item.id === groupId);
    if (!group || !state.joinedGroupIds.has(groupId)) return setStatus('참여한 활동의 공지방만 확인할 수 있습니다.', 'warning');
    closeNotifications();
    ensureGroupMetadata(group);
    elements.activityRoomModal.dataset.groupId = groupId;
    elements.roomTitle.textContent = group.title;
    elements.roomMeta.textContent = `${formatDate(group.scheduledAt)} · ${group.location} · ${group.participants}/${group.maxParticipants}명`;
    elements.roomMessages.replaceChildren();
    const notice = document.createElement('article');
    notice.className = 'room-message room-notice';
    notice.append(createText('strong', '운영 공지'), createText('p', `공개 장소에서 ${formatDuration(group.durationMinutes)} 동안 진행합니다. 불편하면 언제든 참여를 취소할 수 있어요.`));
    elements.roomMessages.append(notice);
    const userEvents = getParticipationLog().filter((item) => item.groupId === group.id && item.userId === state.user.id);
    userEvents.forEach((event) => {
        const label = { joined: '참여 신청이 완료되었습니다.', withdrawn: '참여를 취소했습니다.', completed: '참여 완료로 기록했습니다.', underfilled_adjust: '인원을 조정해 계속 모집하기로 했습니다.' }[event.action] || event.action;
        const message = document.createElement('article');
        message.className = 'room-message room-system';
        message.append(createText('strong', '참여 기록'), createText('p', `${label} · ${formatDate(event.createdAt)}`));
        elements.roomMessages.append(message);
    });
    if (group.participants < MIN_PARTICIPANTS) {
        const wait = document.createElement('article');
        wait.className = 'room-message room-warning';
        wait.append(createText('strong', '인원 안내'), createText('p', `현재 ${group.participants}명 참여 상태예요. 최소 ${MIN_PARTICIPANTS}명이 모이지 않으면 일정이 조정되거나 취소될 수 있습니다.`));
        elements.roomMessages.append(wait);
    }
    renderActivityRoomChat(groupId);
    elements.roomChatStatus.textContent = '';
    elements.roomChatStatus.dataset.tone = '';
    elements.notificationModal.classList.add('hidden');
    elements.notificationModal.setAttribute('aria-hidden', 'true');
    elements.activityRoomModal.classList.remove('hidden');
    elements.activityRoomModal.setAttribute('aria-hidden', 'false');
}

function closeActivityRoom() {
    elements.activityRoomModal.classList.add('hidden');
    elements.activityRoomModal.setAttribute('aria-hidden', 'true');
    elements.roomMessages.replaceChildren();
    elements.roomChatMessages.replaceChildren();
    elements.roomChatInput.value = '';
    elements.roomChatStatus.textContent = '';
}

function markActivityCompleted(groupId) {
    if (!state.user) return setStatus('로그인 후 참여 완료를 기록할 수 있습니다.', 'warning');
    const group = state.groups.find((item) => item.id === groupId);
    if (!group || !state.joinedGroupIds.has(groupId)) return setStatus('참여한 활동만 완료로 기록할 수 있습니다.', 'warning');
    if (group.status === 'cancelled') return setStatus('취소된 활동은 완료로 기록할 수 없습니다.', 'warning');
    if (new Date(group.scheduledAt).getTime() > Date.now()) return setStatus(`활동 완료는 ${formatDate(group.scheduledAt)} 이후에 기록할 수 있어요.`, 'warning');
    group.status = 'completed';
    group.completedAt = new Date().toISOString();
    recordParticipationEvent(group, 'completed');
    persistence.update(group);
    renderGroups();
    renderHistory();
    setStatus(`'${group.title}' 활동을 참여 완료로 기록했습니다. 이제 활동 후 평가를 남겨 보세요.`, 'success');
}

function renderHistory() {
    if (!elements.historyList) return;
    elements.historyList.replaceChildren();
    const checkins = getConnectionCheckins();
    const joined = state.user ? state.groups.filter((group) => state.joinedGroupIds.has(group.id)) : [];
    const completed = joined.filter(isActivityCompleted);
    const revisitCount = completed.filter((group) => checkins.some((item) => item.groupId === group.id && item.userId === state.user?.id && item.revisit === 'yes')).length;
    if (elements.historyCount) elements.historyCount.textContent = `${joined.length}개 활동`;
    if (elements.historyCompletedCount) elements.historyCompletedCount.textContent = String(completed.length);
    if (elements.historyRevisitCount) elements.historyRevisitCount.textContent = String(revisitCount);
    if (elements.historyTrustScore) elements.historyTrustScore.textContent = `${normalizedTrustScore(state.user?.trustScore)}°C`;
    if (elements.historyEmpty) {
        elements.historyEmpty.classList.toggle('hidden', joined.length > 0);
        const emptyTitle = elements.historyEmpty.querySelector('strong');
        const emptyDescription = elements.historyEmpty.querySelector('p');
        if (!state.user) {
            if (emptyTitle) emptyTitle.textContent = '로그인 후 나의 활동 기록을 확인할 수 있어요.';
            if (emptyDescription) emptyDescription.textContent = '활동은 로그인 없이 둘러볼 수 있고, 참여 신청과 활동 후 평가는 로그인 후 이용할 수 있습니다.';
        } else {
            if (emptyTitle) emptyTitle.textContent = '활동에 참여하면 이곳에 기록이 남아요.';
            if (emptyDescription) emptyDescription.textContent = '활동이 끝난 뒤 편안함과 다시 참여할 의향을 남기고, 원한다면 다른 참여자의 시간 약속·배려·규칙 준수도 평가할 수 있어요.';
        }
    }
    joined.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).forEach((group) => {
        ensureGroupMetadata(group);
        const completedActivity = isActivityCompleted(group);
        const checkin = checkins.find((item) => item.groupId === group.id && item.userId === state.user.id);
        const card = document.createElement('article');
        card.className = 'history-card';
        const header = document.createElement('div');
        header.className = 'history-card-header';
        header.append(createText('span', completedActivity ? '활동 완료' : '참여 예정', `history-status ${completedActivity ? 'history-status-complete' : 'history-status-upcoming'}`), createText('span', formatDate(group.scheduledAt), 'card-meta'));
        card.append(header, createText('span', `${activityFamilyLabel(group.categoryFamily)} · ${group.category}`, 'category-badge'), createText('h3', group.title), createText('p', `${group.purpose} · ${conversationLevelLabel(group.conversationLevel)}`, 'card-purpose'), createText('span', `📍 ${group.location} · ${formatDuration(group.durationMinutes)}`, 'card-meta'));
        if (checkin) card.append(createText('p', `내 기록: ${checkin.feelingLabel} · ${checkin.revisitLabel}`, 'history-checkin-note'));
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const room = document.createElement('button');
        room.type = 'button'; room.className = 'btn-outline btn-small'; room.textContent = '공지방 열기';
        room.addEventListener('click', () => openActivityRoom(group.id));
        actions.append(room);
        if (completedActivity) {
            const evaluate = document.createElement('button');
            evaluate.type = 'button'; evaluate.className = 'btn-primary btn-small'; evaluate.textContent = checkin ? '기록 다시 보기' : '활동 후 평가하기';
            evaluate.addEventListener('click', () => openFeedback(group.id));
            actions.append(evaluate);
        } else {
            const complete = document.createElement('button');
            complete.type = 'button'; complete.className = 'btn-outline btn-small'; complete.textContent = '참여 완료 기록';
            complete.title = '활동이 끝난 뒤 눌러 주세요.';
            complete.addEventListener('click', () => markActivityCompleted(group.id));
            const view = document.createElement('button');
            view.type = 'button'; view.className = 'btn-outline btn-small'; view.textContent = '활동 상세 보기';
            view.addEventListener('click', () => {
                setView('activities');
                window.setTimeout(() => document.getElementById(`activity-${group.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
            });
            actions.append(complete, view);
        }
        card.append(actions);
        elements.historyList.append(card);
    });
}

function renderCategoryOptions() {
    const select = $('input-category');
    if (select) ACTIVITY_TYPES.forEach((type) => select.append(createText('option', type)));
    if (elements.activityExamples) {
        elements.activityExamples.replaceChildren();
        ACTIVITY_EXAMPLES.forEach((example) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'activity-example-card';
            card.append(
                createText('span', activityFamilyLabel(example.family), 'category-badge'),
                createText('strong', example.title),
                createText('p', example.description)
            );
            card.addEventListener('click', () => {
                state.filters.category = example.family;
                elements.search.value = '';
                renderGroups();
                setStatus(`${activityFamilyLabel(example.family)} 활동을 먼저 보여드려요.`, 'success');
            });
            elements.activityExamples.append(card);
        });
    }
}

function renderNotifications() {
    if (!elements.notificationList || !elements.notificationBadge) return;
    elements.notificationList.replaceChildren();
    elements.notificationBadge.textContent = String(state.notifications.length);
    elements.notificationBadge.classList.toggle('hidden', state.notifications.length === 0);
    if (!state.notifications.length) {
        elements.notificationList.append(createText('p', '새 알림이 없어요.', 'empty-notification'));
        return;
    }
    state.notifications.slice().reverse().forEach((notification) => {
        const card = document.createElement('article');
        card.className = 'notification-card';
        card.append(createText('h4', notification.title), createText('p', notification.message));
        const actions = document.createElement('div');
        actions.className = 'notification-actions';
        if (notification.kind === 'underfilled') {
            const adjust = document.createElement('button');
            adjust.type = 'button'; adjust.className = 'btn-primary btn-small'; adjust.textContent = '인원 조정 후 계속';
            adjust.addEventListener('click', () => resolveUnderfilledNotification(notification.id, 'adjust'));
            const cancel = document.createElement('button');
            cancel.type = 'button'; cancel.className = 'btn-outline btn-small'; cancel.textContent = '이번 활동 취소';
            cancel.addEventListener('click', () => resolveUnderfilledNotification(notification.id, 'cancel'));
            actions.append(adjust, cancel);
        } else if (notification.kind === 'participation') {
            const room = document.createElement('button');
            room.type = 'button'; room.className = 'btn-primary btn-small'; room.textContent = '공지방 열기';
            room.addEventListener('click', () => openActivityRoom(notification.groupId));
            const confirm = document.createElement('button');
            confirm.type = 'button'; confirm.className = 'btn-outline btn-small'; confirm.textContent = '확인했어요';
            confirm.addEventListener('click', () => dismissNotification(notification.id));
            actions.append(room, confirm);
        } else {
            const confirm = document.createElement('button');
            confirm.type = 'button'; confirm.className = 'btn-primary btn-small'; confirm.textContent = '확인했어요';
            confirm.addEventListener('click', () => dismissNotification(notification.id));
            const cancel = document.createElement('button');
            cancel.type = 'button'; cancel.className = 'btn-outline btn-small'; cancel.textContent = '참여 취소';
            cancel.addEventListener('click', () => { if (state.joinedGroupIds.has(notification.groupId)) toggleParticipation(notification.groupId); dismissNotification(notification.id); });
            actions.append(confirm, cancel);
        }
        card.append(actions);
        elements.notificationList.append(card);
    });
}

function dismissNotification(notificationId) {
    state.notifications = state.notifications.filter((item) => item.id !== notificationId);
    saveNotifications();
    renderNotifications();
    setStatus('알림을 확인 처리했습니다.', 'success');
}

function openNotifications() {
    if (!state.user) return openLogin();
    renderNotifications();
    elements.notificationModal.classList.remove('hidden');
    elements.notificationModal.setAttribute('aria-hidden', 'false');
}

function closeNotifications() {
    elements.notificationModal.classList.add('hidden');
    elements.notificationModal.setAttribute('aria-hidden', 'true');
}

function queueParticipationNotification(group, action) {
    if (!state.user || !group) return;
    const joined = action === 'joined';
    state.notifications.push({
        id: `participation:${group.id}:${state.user.id}:${action}:${Date.now()}`,
        kind: 'participation',
        groupId: group.id,
        title: joined ? '참여 신청이 완료되었어요' : '참여 취소가 완료되었어요',
        message: joined ? `'${group.title}'에 참여했어요. 활동 기록과 공지방에서 일정을 확인할 수 있습니다.` : `'${group.title}' 참여를 취소했어요.`,
        createdAt: new Date().toISOString()
    });
    saveNotifications();
    renderNotifications();
}

function queueUnderfilledNotification(group) {
    if (!state.user || !group || group.participants >= MIN_PARTICIPANTS) return;
    const notificationId = `underfilled:${group.id}:${state.user.id}`;
    if (state.notifications.some((item) => item.id === notificationId)) return;
    state.notifications.push({
        id: notificationId,
        kind: 'underfilled',
        groupId: group.id,
        title: '참여 인원을 함께 확인해 주세요',
        message: `'${group.title}'은 현재 ${group.participants}/${group.maxParticipants}명입니다. 이번 활동을 취소하거나, 모집 인원을 조정해 최소 ${MIN_PARTICIPANTS}명이 모일 때까지 계속 모집할 수 있어요.`,
        createdAt: new Date().toISOString()
    });
    saveNotifications();
    renderNotifications();
}

function resolveUnderfilledNotification(notificationId, decision) {
    const notification = state.notifications.find((item) => item.id === notificationId);
    const group = notification && state.groups.find((item) => item.id === notification.groupId);
    if (!notification || !group) return dismissNotification(notificationId);
    if (decision === 'adjust') {
        group.maxParticipants = Math.max(MIN_PARTICIPANTS, Math.min(group.maxParticipants, Math.max(group.participants, MIN_PARTICIPANTS)));
        group.underfilledDecision = 'adjust';
        persistence.update(group);
        recordParticipationEvent(group, 'underfilled_adjust');
        dismissNotification(notificationId);
        renderGroups();
        setStatus(`'${group.title}'은 인원을 조정해 계속 모집합니다. 최소 ${MIN_PARTICIPANTS}명이 모이면 진행할 수 있어요.`, 'success');
        return;
    }
    if (state.joinedGroupIds.has(group.id)) toggleParticipation(group.id);
    dismissNotification(notificationId);
    setStatus(`'${group.title}' 참여를 취소했습니다.`, 'info');
}

function queueGenderBalanceNotification(group) {
    const profile = getPrivateProfile();
    const counts = privateGroupState.get(group.id);
    if (!profile || !counts) return;
    const ownCount = Number(counts[profile.gender] || 0);
    const otherGender = profile.gender === 'female' ? 'male' : 'female';
    const otherCount = Number(counts[otherGender] || 0);
    if (ownCount !== 1 || otherCount < 1) return;
    const notificationId = `gender-balance:${group.id}:${profile.userId}`;
    if (state.notifications.some((item) => item.id === notificationId)) return;
    state.notifications.push({
        id: notificationId,
        groupId: group.id,
        title: '참여 전 확인해 주세요',
        message: `'${group.title}'은 현재 나와 다른 성별의 참여자가 대부분일 수 있어요. 괜찮다면 참여를 계속하고, 부담스럽다면 취소할 수 있습니다.`
    });
    saveNotifications();
    renderNotifications();
    setStatus('참여자 구성에 관한 확인 알림이 도착했습니다. 성비 숫자는 공개하지 않습니다.', 'info');
}

function localRecommendationMatches({ interest, comfort, timeWindow }) {
    const startedAt = Date.now();
    const interestTerms = String(interest || '').toLowerCase().split(/[\s,、，/]+/).map((term) => normalizeSafetyText(term)).filter(Boolean);
    const now = Date.now();
    const matches = state.groups
        .filter((group) => group.status === 'recruiting')
        .map((group) => {
            ensureGroupMetadata(group);
            const searchable = normalizeSafetyText(`${group.title} ${group.purpose} ${group.description}`);
            const interestHit = interestTerms.length === 0 ? 0.25 : interestTerms.some((term) => searchable.includes(term)) ? 0.55 : 0;
            const comfortText = comfort === 'quiet' && group.conversationLevel === 'quiet' ? 0.25 : comfort === 'light_conversation' && group.conversationLevel === 'light_conversation' ? 0.25 : comfort === 'active' && group.conversationLevel === 'active' ? 0.25 : comfort === 'beginner' && group.beginnerFriendly ? 0.25 : comfort === 'any' ? 0.1 : 0;
            const daysAway = (new Date(group.scheduledAt).getTime() - now) / (24 * 60 * 60 * 1000);
            const timeHit = timeWindow === 'today' && daysAway <= 1.2 ? 0.15 : timeWindow === 'this_week' && daysAway <= 7 ? 0.15 : timeWindow === 'any' ? 0.1 : 0;
            const fit = Math.min(0.99, interestHit + comfortText + timeHit + 0.05);
            const reason = interestHit >= 0.5 ? `${interest} 관심과 목적이 맞고, ` : '모임 목적이 부담 없이 참여하기 좋고, ';
            const comfortReason = comfort === 'quiet' ? '대화 부담이 낮은 방식이에요.' : comfort === 'active' ? '함께 이야기하고 움직이는 활동이에요.' : comfort === 'beginner' ? '처음 참여하는 분도 괜찮은 활동이에요.' : '내 속도에 맞춰 참여하기 좋아요.';
            return { activityId: group.id, fit, reason: `${reason}${comfortReason}` };
        })
        .filter((item) => item.fit >= 0.35)
        .sort((a, b) => b.fit - a.fit)
        .slice(0, 3);
    return matches;
}

function recommendationCacheKey(preferences) {
    return JSON.stringify({ ...preferences, activities: state.groups.filter((group) => group.status === 'recruiting').map((group) => `${group.id}:${group.updatedAt || group.participants}`) });
}

async function getRecommendations(preferences) {
    const startedAt = Date.now();
    const cache = safeJson(localStorage.getItem(RECOMMENDATION_CACHE_KEY), {});
    const key = recommendationCacheKey(preferences);
    const cacheStats = safeJson(localStorage.getItem(RECOMMENDATION_CACHE_STATS_KEY), { hits: 0, misses: 0 });
    if (cache[key]) {
        cacheStats.hits += 1; localStorage.setItem(RECOMMENDATION_CACHE_STATS_KEY, JSON.stringify(cacheStats));
        operationLog('recommend', 'cache_hit', startedAt, { policyVersion: 'recommendation-v1-local' });
        return cache[key];
    }
    cacheStats.misses += 1; localStorage.setItem(RECOMMENDATION_CACHE_STATS_KEY, JSON.stringify(cacheStats));
    const route = chooseRecommendationRoute(preferences.interest);
    let matches = null;
    const endpoint = automationEndpoint('recommend');
    if (endpoint) {
        try {
            const result = await requestAutomation('recommend', { preferences, activities: state.groups.filter((group) => group.status === 'recruiting').map((group) => ({ id: group.id, title: group.title, purpose: group.purpose, description: group.description, location: group.location, scheduledAt: group.scheduledAt, participants: group.participants, maxParticipants: group.maxParticipants, category: group.category, conversationLevel: group.conversationLevel, beginnerFriendly: group.beginnerFriendly, durationMinutes: group.durationMinutes, status: group.status })) }, endpoint);
            if (Array.isArray(result?.recommendations)) matches = result.recommendations.map((item) => ({ activityId: item.activityId, fit: Number(item.fit) || 0, reason: String(item.reason || ''), source: result.retrieval?.method || '' })).filter((item) => item.activityId && item.reason);
        } catch { matches = null; }
    }
    matches ||= localRecommendationMatches(preferences);
    cache[key] = matches; localStorage.setItem(RECOMMENDATION_CACHE_KEY, JSON.stringify(cache));
    operationLog('recommend', matches.length ? 'success' : 'empty', startedAt, { policyVersion: endpoint ? 'recommendation-v1-protected' : 'recommendation-v1-' + route });
    return matches;
}

function renderRecommendations(matches, preferences) {
    elements.recommendationList.replaceChildren();
    if (!matches.length) {
        elements.recommendationStatus.textContent = preferences.interest ? '조건에 꼭 맞는 활동이 아직 없어요. 관심사를 조금 넓혀 다시 찾아보세요.' : '관심사를 한두 단어 입력하면 더 잘 맞는 활동을 찾아드려요.';
        elements.recommendationStatus.dataset.tone = 'warning';
        return;
    }
    elements.recommendationStatus.textContent = matches.some((match) => ['embedding-cosine', 'semantic-vector-cosine'].includes(match.source)) ? '활동 설명을 의미 벡터로 검색한 뒤, 조건에 맞는 연결을 추천했어요.' : '현재 모집 중인 활동 정보와 입력한 조건을 비교해 추천했어요.';
    elements.recommendationStatus.dataset.tone = 'success';
    matches.forEach((match) => {
        const group = state.groups.find((item) => item.id === match.activityId);
        if (!group) return;
        const card = document.createElement('article');
        card.className = 'recommendation-card';
        const source = match.source === 'embedding-cosine'
            ? '근거: 활동 문서를 임베딩해 의미 유사도 검색'
            : match.source === 'semantic-vector-cosine'
                ? '근거: 활동 문서를 의미 축 벡터로 변환해 유사도 검색'
                : '근거: 현재 모집 중인 활동 정보와 입력한 조건';
        card.append(createText('div', `${Math.round(match.fit * 100)}% 잘 맞아요`, 'fit-badge'), createText('h3', group.title), createText('p', match.reason, 'recommendation-reason'), createText('small', source, 'recommendation-source'), createText('span', `📍 ${group.location} · ${formatDate(group.scheduledAt)}`, 'card-meta'));
        const view = document.createElement('button');
        view.type = 'button'; view.className = 'btn-outline btn-small'; view.textContent = '활동 보기';
        view.addEventListener('click', () => {
            setView('activities');
            window.setTimeout(() => document.getElementById(`activity-${group.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
        });
        card.append(view); elements.recommendationList.append(card);
    });
}

async function handleRecommendation(event) {
    event.preventDefault();
    const guard = guardRecommendationInput($('input-interest').value);
    if (!guard.ok) { elements.recommendationStatus.textContent = guard.message; elements.recommendationStatus.dataset.tone = 'warning'; return; }
    const preferences = { interest: guard.value, comfort: $('input-comfort').value, timeWindow: $('input-time-window').value };
    elements.recommendationStatus.textContent = automationEndpoint('recommend') ? '추천 RAG가 활동 근거와 조건을 확인하고 있어요...' : '현재 모집 중인 활동 정보와 참여 조건을 비교하고 있어요...';
    const matches = await getRecommendations(preferences);
    renderRecommendations(matches, preferences);
}

async function showAiRecommendedActivities() {
    const interest = elements.search.value.trim() || $('input-interest')?.value.trim() || '';
    const guard = guardRecommendationInput(interest);
    if (!guard.ok) return setStatus(guard.message, 'warning');
    const preferences = { interest: guard.value, comfort: $('input-comfort')?.value || 'any', timeWindow: $('input-time-window')?.value || 'any' };
    setStatus('AI가 현재 모집 중인 활동을 근거로 추천 모임을 찾고 있어요…', 'info');
    const matches = await getRecommendations(preferences);
    state.recommendedGroupIds = matches.map((match) => String(match.activityId));
    state.recommendationReasons = Object.fromEntries(matches.map((match) => [String(match.activityId), match.reason]));
    renderGroups();
    if (!state.recommendedGroupIds.length) return setStatus('지금 조건에 맞는 AI 추천 모임이 없어요. 관심사나 연결 속도를 바꿔 다시 찾아보세요.', 'info');
    setStatus(`AI 추천 모임 ${state.recommendedGroupIds.length}개를 먼저 보여드려요. 그다음은 날짜와 거리 순서예요.`, 'success');
    elements.list.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateNav() {
    const loggedIn = Boolean(state.user);
    elements.login.classList.toggle('hidden', loggedIn);
    elements.signup.classList.toggle('hidden', loggedIn);
    elements.create.classList.toggle('hidden', !loggedIn);
    elements.profile.classList.toggle('hidden', !loggedIn);
    elements.notificationsButton.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
        state.activitySettings ||= getActivitySettings();
        elements.nickname.textContent = `${state.user.icon} ${state.user.nickname}`;
        if (elements.profilePreviewName) elements.profilePreviewName.textContent = state.user.nickname;
        elements.trustScore.textContent = `${state.user.trustScore.toFixed(1)}°C`;
        elements.trustScore.classList.remove('trust-hot', 'trust-warm', 'trust-cool');
        elements.trustScore.classList.add(trustScoreClass(state.user.trustScore));
    }
    renderNotifications();
}

function openLogin() {
    elements.loginModal.classList.remove('hidden');
    $('input-login-id').focus();
}

function closeLogin() {
    elements.loginModal.classList.add('hidden');
    elements.loginForm.reset();
    if (elements.loginSubmitStatus) { elements.loginSubmitStatus.textContent = ''; elements.loginSubmitStatus.dataset.tone = ''; }
}

function openSignup() {
    elements.signupModal.classList.remove('hidden');
    $('signup-name').focus();
}

function resetSignupState() {
    signupState.idAvailable = false;
    signupState.idCheckedId = '';
    signupState.verificationComplete = false;
    signupState.verificationContact = '';
    signupState.verificationMethod = '';
    signupState.isSubmitting = false;
    const idInput = $('signup-id');
    if (idInput) {
        idInput.dataset.checkedId = '';
        idInput.dataset.idAvailable = '';
    }
}

function closeSignup() {
    elements.signupModal.classList.add('hidden');
    elements.signupForm.reset();
    resetSignupState();
    $('signup-id-status').textContent = '';
    elements.signupSubmitStatus.textContent = '';
    elements.signupSubmitStatus.dataset.tone = '';
    $('signup-age-status').textContent = '만 20세 이상만 가입할 수 있어요.';
    $('signup-age-status').dataset.tone = '';
    $('signup-password-status').textContent = '영문, 숫자, 특수문자를 포함해 8자 이상 입력해 주세요.';
    $('signup-password-status').dataset.tone = '';
    $('signup-password-confirm-status').textContent = '비밀번호를 한 번 더 입력해 주세요.';
    $('signup-password-confirm-status').dataset.tone = '';
    $('signup-verification-status').textContent = '개발용 인증 흐름입니다.';
    $('signup-verification-status').dataset.tone = '';
}

function openNicknameSetup() {
    if (elements.nicknameSetupStatus) { elements.nicknameSetupStatus.textContent = ''; elements.nicknameSetupStatus.dataset.tone = ''; }
    elements.nicknameSetupModal.classList.remove('hidden');
    $('input-signup-nickname').focus();
}

function openProfile() {
    if (!state.user) return openLogin();
    renderActivityHistory();
    elements.profileNickname.value = state.user.nickname;
    elements.profileModal.classList.remove('hidden');
    elements.profileNickname.focus();
}

function closeProfile() {
    elements.profileModal.classList.add('hidden');
    elements.profileForm.reset();
    if (elements.profileStatus) { elements.profileStatus.textContent = ''; elements.profileStatus.dataset.tone = ''; }
}

async function submitProfile(event) {
    event.preventDefault();
    if (!state.user) return closeProfile();
    const nickname = elements.profileNickname.value.trim();
    if (nickname.length < 2 || nickname.length > 24) return setProfileStatus('닉네임은 2~24자로 입력해 주세요.', 'warning', 'input-profile-nickname');
    if (!/^[\p{L}\p{N} _-]+$/u.test(nickname)) return setProfileStatus('닉네임에는 한글, 영문, 숫자와 기본 기호만 사용할 수 있습니다.', 'warning', 'input-profile-nickname');
    const duplicate = getAccounts().some((account) => account.id !== state.user.id && normalizeNickname(account.nickname) === normalizeNickname(nickname));
    if (duplicate) return setProfileStatus('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.', 'warning', 'input-profile-nickname');
    if (supabaseClient) {
        try {
            await updateRemoteNickname(state.user.id, nickname);
        } catch (error) {
            return setProfileStatus(supabaseErrorMessage(error, 'Supabase에 닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'), 'warning', 'input-profile-nickname');
        }
    }
    state.user = publicUser({ ...state.user, nickname });
    upsertAccount({ id: state.user.id, nickname, trustScore: state.user.trustScore });
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    closeProfile();
    updateNav();
    setStatus('닉네임이 변경되었습니다.', 'success');
}

async function submitNicknameSetup(event) {
    event.preventDefault();
    const nickname = $('input-signup-nickname').value.trim();
    if (nickname.length < 2 || nickname.length > 24) return setNicknameStatus('닉네임은 2~24자로 입력해 주세요.', 'warning', 'input-signup-nickname');
    if (!/^[\p{L}\p{N} _-]+$/u.test(nickname)) return setNicknameStatus('닉네임에는 한글, 영문, 숫자와 기본 기호만 사용할 수 있습니다.', 'warning', 'input-signup-nickname');
    if (!state.pendingSignupId) return setNicknameStatus('가입 정보가 만료되었습니다. 회원가입을 다시 진행해 주세요.', 'warning', 'input-signup-nickname');
    if (getAccounts().some((account) => String(account.id) !== String(state.pendingSignupId) && normalizeNickname(account.nickname) === normalizeNickname(nickname))) {
        return setNicknameStatus('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.', 'warning', 'input-signup-nickname');
    }

    try {
        const account = getAccounts().find((item) => String(item.id) === String(state.pendingSignupId));
        if (!account) return setNicknameStatus('가입 정보를 찾을 수 없습니다. 회원가입을 다시 진행해 주세요.', 'warning', 'input-signup-nickname');
        if (supabaseClient) {
            try {
                await updateRemoteNickname(state.pendingSignupId, nickname);
            } catch (error) {
                return setNicknameStatus(supabaseErrorMessage(error, 'Supabase에 닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'), 'warning', 'input-signup-nickname');
            }
        }
        state.user = publicUser({ id: account.id, nickname, icon: '🌱', trustScore: account.trustScore });
        upsertAccount({ id: account.id, nickname, trustScore: state.user.trustScore });
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
        state.pendingSignupId = null;
        elements.nicknameSetupModal.classList.add('hidden');
        elements.nicknameSetupForm.reset();
        state.filters.ageGroup = 'all';
        state.activitySettings = defaultActivitySettings();
        updateNav();
        setView('activities', false);
        setStatus('회원가입과 공개 닉네임 설정이 완료되었습니다. 참여할 활동을 찾아보세요.', 'success');
    } catch (error) {
        console.error(error);
        setNicknameStatus('닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'warning', 'input-signup-nickname');
    }
}

async function checkSignupId() {
    const input = $('signup-id');
    const id = normalizeLoginId(input.value);
    const status = $('signup-id-status');
    if (!/^[a-z0-9][a-z0-9_-]{3,23}$/.test(id)) {
        signupState.idAvailable = false;
        signupState.idCheckedId = '';
        input.dataset.checkedId = '';
        input.dataset.idAvailable = 'false';
        status.textContent = '아이디는 영문·숫자·_- 조합 4~24자로 입력해 주세요.';
        status.dataset.tone = 'warning';
        return;
    }
    const usedIds = safeJson(localStorage.getItem('dg_signup_ids_v1'), []) || [];
    const usedId = Array.isArray(usedIds) && usedIds.some((usedIdValue) => normalizeLoginId(usedIdValue) === id);
    const accountIdUsed = getAccounts().some((account) => normalizeLoginId(account.loginId) === id);
    signupState.idCheckedId = id;
    if (usedId || accountIdUsed) {
        signupState.idAvailable = false;
        input.dataset.checkedId = id;
        input.dataset.idAvailable = 'false';
        status.textContent = '이미 사용 중인 아이디입니다.';
        status.dataset.tone = 'warning';
        return false;
    }
    if (supabaseClient) {
        status.textContent = 'Supabase에서 아이디 중복 여부를 확인하고 있어요...';
        status.dataset.tone = 'info';
        try {
            if (!await remoteLoginIdAvailable(id)) {
                signupState.idAvailable = false;
                input.dataset.checkedId = id;
                input.dataset.idAvailable = 'false';
                status.textContent = '이미 사용 중인 아이디입니다.';
                status.dataset.tone = 'warning';
                return false;
            }
        } catch (error) {
            signupState.idAvailable = false;
            input.dataset.checkedId = '';
            input.dataset.idAvailable = 'false';
            status.textContent = supabaseErrorMessage(error, '아이디 중복 확인에 실패했습니다. Supabase 설정을 확인해 주세요.');
            status.dataset.tone = 'warning';
            return false;
        }
    }
    signupState.idAvailable = true;
    input.dataset.checkedId = id;
    input.dataset.idAvailable = 'true';
    status.textContent = supabaseClient ? 'Supabase 확인 완료 · 사용 가능한 아이디입니다.' : '사용 가능한 아이디입니다.';
    status.dataset.tone = 'success';
    return signupState.idAvailable;
}

function sendSignupVerification() {
    const contact = $('signup-verification-contact').value.normalize('NFKC').trim();
    const method = $('signup-verification-method').value;
    if (!contact) {
        $('signup-verification-status').textContent = '인증 연락처를 입력해 주세요.';
        $('signup-verification-status').dataset.tone = 'warning';
        $('signup-verification-contact').focus();
        return false;
    }
    signupState.verificationComplete = true;
    signupState.verificationContact = contact;
    signupState.verificationMethod = method;
    $('signup-verification-status').textContent = `${method === 'phone' ? '휴대폰' : '이메일'} 본인인증이 완료되었습니다. (개발용)`;
    $('signup-verification-status').dataset.tone = 'success';
    return true;
}

function resetSignupVerification() {
    const contact = $('signup-verification-contact').value.normalize('NFKC').trim();
    const method = $('signup-verification-method').value;
    if (signupState.verificationComplete && contact === signupState.verificationContact && method === signupState.verificationMethod) return;
    signupState.verificationComplete = false;
    signupState.verificationContact = '';
    signupState.verificationMethod = '';
    $('signup-verification-status').textContent = '인증 연락처가 변경되었습니다. 다시 인증해 주세요.';
    $('signup-verification-status').dataset.tone = 'info';
}

function enforceSignupAge(event) {
    const input = event.target;
    const value = input.value.trim();
    if ((value.length === 1 && Number(value) < 2) || (value.length >= 2 && Number(value) < 20)) {
        input.value = '';
        input.setCustomValidity('만 20세 이상만 가입할 수 있습니다.');
        $('signup-age-status').textContent = '20세 미만은 가입할 수 없습니다.';
        $('signup-age-status').dataset.tone = 'warning';
        setStatus('나이는 20세 이상만 입력할 수 있습니다.', 'warning');
        return;
    }
    input.setCustomValidity('');
    $('signup-age-status').textContent = '만 20세 이상만 가입할 수 있어요.';
    $('signup-age-status').dataset.tone = '';
}

function openRecovery(mode = 'id') {
    elements.recoveryModal.classList.remove('hidden');
    $('recovery-mode').value = mode;
    updateRecoveryMode();
    $('recovery-contact').focus();
}

function closeRecovery() {
    elements.recoveryModal.classList.add('hidden');
    elements.recoveryForm.reset();
    $('recovery-status').textContent = '';
    $('recovery-status').dataset.tone = '';
    updateRecoveryMode();
}

function updateRecoveryMode() {
    const passwordMode = $('recovery-mode').value === 'password';
    $('recovery-title').textContent = passwordMode ? '비밀번호 찾기' : '아이디 찾기';
    $('recovery-id-group').classList.toggle('hidden', !passwordMode);
    $('recovery-password-group').classList.toggle('hidden', !passwordMode);
    $('btn-submit-recovery').textContent = passwordMode ? '비밀번호 변경' : '아이디 확인';
}

function setRecoveryStatus(message, tone = 'warning') {
    $('recovery-status').textContent = message;
    $('recovery-status').dataset.tone = tone;
}

function isValidPassword(password) {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9\s]/.test(password);
}

async function submitAccountRecovery(event) {
    event.preventDefault();
    const mode = $('recovery-mode').value;
    const contact = normalizeContact($('recovery-contact').value);
    const code = $('recovery-code').value.trim();
    if (!contact) return setRecoveryStatus('가입 시 입력한 연락처를 입력해 주세요.');
    if (code !== '123456') return setRecoveryStatus('개발용 인증번호는 123456입니다.');
    const profiles = getPrivateProfiles();
    const profile = profiles.find((item) => normalizeContact(item.verificationContact || item.phone) === contact);
    if (!profile) return setRecoveryStatus('일치하는 가입 연락처를 찾을 수 없습니다.');
    if (mode === 'id') return setRecoveryStatus(`가입된 아이디는 ${profile.signupId}입니다.`, 'success');
    const loginId = normalizeLoginId($('recovery-login-id').value);
    if (!loginId || normalizeLoginId(profile.signupId) !== loginId) return setRecoveryStatus('아이디와 가입 연락처가 일치하지 않습니다.');
    const password = $('recovery-password').value;
    if (!isValidPassword(password)) return setRecoveryStatus('새 비밀번호는 영문, 숫자, 특수문자를 포함해 8자 이상 입력해 주세요.');
    if (password !== $('recovery-password-confirm').value) return setRecoveryStatus('새 비밀번호와 확인값이 일치하지 않습니다.');
    const account = getAccounts().find((item) => normalizeLoginId(item.loginId) === loginId);
    if (!account) return setRecoveryStatus('가입된 아이디를 찾을 수 없습니다.');
    account.passwordHash = await hashSecret(password);
    saveAccounts(getAccounts().map((item) => item.id === account.id ? account : item));
    setRecoveryStatus('개발용 비밀번호 변경이 완료되었습니다. 로그인해 주세요.', 'success');
}

function validateSignupPassword(event) {
    const password = event.target.value;
    const status = $('signup-password-status');
    if (!password) {
        status.textContent = '영문, 숫자, 특수문자를 포함해 8자 이상 입력해 주세요.';
        status.dataset.tone = '';
        return;
    }
    const valid = isValidPassword(password);
    status.textContent = valid
        ? '사용 가능한 비밀번호입니다.'
        : '영문, 숫자, 특수문자를 모두 포함해 8자 이상 입력해 주세요.';
    status.dataset.tone = valid ? 'success' : 'warning';
    validateSignupPasswordMatch();
}

function validateSignupPasswordMatch() {
    const password = $('signup-password').value;
    const confirmation = $('signup-password-confirm').value;
    const status = $('signup-password-confirm-status');
    if (!confirmation) {
        status.textContent = '비밀번호를 한 번 더 입력해 주세요.';
        status.dataset.tone = '';
        return;
    }
    const matches = password === confirmation;
    status.textContent = matches ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.';
    status.dataset.tone = matches ? 'success' : 'warning';
}

function completeSignupVerification() {
    const code = $('signup-verification-code').value.trim();
    if (!signupState.verificationComplete) {
        $('signup-verification-status').textContent = '먼저 인증하기를 눌러 인증을 시작해 주세요.';
        $('signup-verification-status').dataset.tone = 'warning';
        return;
    }
    if (!code) {
        $('signup-verification-status').textContent = '본인인증이 완료되었습니다. 인증번호 입력은 선택 사항입니다. (개발용)';
        $('signup-verification-status').dataset.tone = 'success';
        return true;
    }
    if (code !== '123456') {
        $('signup-verification-status').textContent = '개발용 인증번호는 123456을 입력해 주세요.';
        $('signup-verification-status').dataset.tone = 'info';
        return false;
    }
    $('signup-verification-status').textContent = '본인인증이 완료되었습니다. (개발용)';
    $('signup-verification-status').dataset.tone = 'success';
    return true;
}

async function submitSignup(event) {
    event.preventDefault();
    if (signupState.isSubmitting) return false;
    const idInput = $('signup-id');
    const draft = {
        name: $('signup-name').value.normalize('NFKC').trim(),
        gender: $('signup-gender').value,
        age: Number($('signup-age').value),
        phone: $('signup-phone').value.normalize('NFKC').trim(),
        loginId: normalizeLoginId(idInput.value),
        password: $('signup-password').value,
        passwordConfirm: $('signup-password-confirm').value,
        verificationContact: $('signup-verification-contact').value.normalize('NFKC').trim(),
        verificationMethod: $('signup-verification-method').value,
        marketingConsent: $('signup-marketing-consent').checked,
        privacyConsent: $('signup-privacy-consent').checked
    };

    const requiredFields = [
        ['name', '이름', 'signup-name'], ['gender', '성별', 'signup-gender'], ['age', '나이', 'signup-age'],
        ['phone', '휴대폰 번호', 'signup-phone'], ['loginId', '아이디', 'signup-id'], ['password', '비밀번호', 'signup-password'],
        ['passwordConfirm', '비밀번호 확인', 'signup-password-confirm'], ['verificationContact', '인증 연락처', 'signup-verification-contact']
    ];
    for (const [field, label, focusId] of requiredFields) {
        if (!String(draft[field] ?? '').trim()) return setSignupStatus(`${label}을(를) 입력해 주세요.`, 'warning', focusId);
    }
    if (!draft.privacyConsent) return setSignupStatus('개인정보 수집·이용 동의가 필요합니다.', 'warning', 'signup-privacy-consent');
    if (!['male', 'female'].includes(draft.gender)) return setSignupStatus('성별을 선택해 주세요.', 'warning', 'signup-gender');
    if (!Number.isInteger(draft.age) || draft.age < 20 || draft.age > 100) {
        $('signup-age-status').textContent = '20세 미만은 가입할 수 없습니다.';
        $('signup-age-status').dataset.tone = 'warning';
        return setSignupStatus('만 20세 이상만 가입할 수 있습니다.', 'warning', 'signup-age');
    }
    if (draft.phone.replace(/\D/g, '').length < 8) return setSignupStatus('휴대폰 번호를 올바르게 입력해 주세요.', 'warning', 'signup-phone');
    if (!/^[a-z0-9][a-z0-9_-]{3,23}$/.test(draft.loginId)) return setSignupStatus('아이디는 영문·숫자·_- 조합 4~24자로 입력해 주세요.', 'warning', 'signup-id');
    if (!isValidPassword(draft.password)) return setSignupStatus('비밀번호는 영문, 숫자, 특수문자를 모두 포함해 8자 이상 입력해 주세요.', 'warning', 'signup-password');
    if (draft.password !== draft.passwordConfirm) return setSignupStatus('비밀번호와 확인값이 서로 일치하지 않습니다.', 'warning', 'signup-password-confirm');
    if (idInput.dataset.checkedId !== draft.loginId || idInput.dataset.idAvailable !== 'true') return setSignupStatus('아이디 입력 후 중복 확인을 완료해 주세요.', 'warning', 'signup-id');
    if (!signupState.verificationComplete || signupState.verificationContact !== draft.verificationContact || signupState.verificationMethod !== draft.verificationMethod) return setSignupStatus('인증하기와 인증 확인을 완료해 주세요.', 'warning', 'signup-verification-code');
    const usedIds = safeJson(localStorage.getItem('dg_signup_ids_v1'), []) || [];
    const accounts = getAccounts();
    const duplicateId = usedIds.some((usedIdValue) => normalizeLoginId(usedIdValue) === draft.loginId) || accounts.some((account) => normalizeLoginId(account.loginId) === draft.loginId);
    if (duplicateId) return setSignupStatus('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.', 'warning', 'signup-id');
    const submitButton = elements.signupForm.querySelector('button[type="submit"]');
    signupState.isSubmitting = true;
    if (submitButton) { submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); }
    try {
        const remoteUser = supabaseClient ? await registerRemoteAccount(draft) : null;
        const passwordHash = supabaseClient ? '' : await hashSecret(draft.password);
        const accountId = remoteUser?.id || window.crypto?.randomUUID?.() || `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const account = { id: accountId, loginId: draft.loginId, passwordHash, nickname: '', trustScore: TRUST_BASELINE };
        const privateProfile = {
            userId: accountId, name: draft.name, gender: draft.gender, age: draft.age,
            ageGroup: ageGroupFromAge(draft.age), phone: draft.phone, verificationContact: draft.verificationContact, signupId: draft.loginId,
            verificationMethod: draft.verificationMethod, marketingConsent: draft.marketingConsent
        };
        const previous = {
            accounts: localStorage.getItem(ACCOUNTS_KEY), ids: localStorage.getItem('dg_signup_ids_v1'),
            profile: localStorage.getItem(PRIVATE_PROFILE_KEY), profiles: localStorage.getItem(PRIVATE_PROFILES_KEY)
        };
        try {
            saveAccounts([...accounts, account]);
            localStorage.setItem('dg_signup_ids_v1', JSON.stringify([...new Set([...usedIds, draft.loginId])]));
            localStorage.setItem(PRIVATE_PROFILE_KEY, JSON.stringify(privateProfile));
            const profiles = getPrivateProfiles().filter((profile) => profile.userId !== privateProfile.userId);
            localStorage.setItem(PRIVATE_PROFILES_KEY, JSON.stringify([...profiles, privateProfile]));
        } catch (storageError) {
            if (previous.accounts === null) localStorage.removeItem(ACCOUNTS_KEY); else localStorage.setItem(ACCOUNTS_KEY, previous.accounts);
            if (previous.ids === null) localStorage.removeItem('dg_signup_ids_v1'); else localStorage.setItem('dg_signup_ids_v1', previous.ids);
            if (previous.profile === null) localStorage.removeItem(PRIVATE_PROFILE_KEY); else localStorage.setItem(PRIVATE_PROFILE_KEY, previous.profile);
            if (previous.profiles === null) localStorage.removeItem(PRIVATE_PROFILES_KEY); else localStorage.setItem(PRIVATE_PROFILES_KEY, previous.profiles);
            throw storageError;
        }
        state.pendingSignupId = accountId;
        closeSignup();
        openNicknameSetup();
        setStatus('회원가입이 완료되었습니다. 공개 닉네임을 설정해 주세요.', 'success');
        return true;
    } catch (error) {
        console.error(error);
        return setSignupStatus('회원가입 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'warning');
    } finally {
        signupState.isSubmitting = false;
        if (submitButton) { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); }
    }
}

async function login(event) {
    event.preventDefault();
    const loginId = normalizeLoginId($('input-login-id').value);
    const password = $('input-login-password').value;
    if (!/^[a-z0-9][a-z0-9_-]{3,23}$/.test(loginId)) return setLoginStatus('아이디를 올바르게 입력해 주세요.', 'warning', 'input-login-id');
    if (!password) return setLoginStatus('비밀번호를 입력해 주세요.', 'warning', 'input-login-password');
    if (!$('login-consent').checked) return setLoginStatus('커뮤니티 안전 규칙과 개인정보 최소 이용 안내를 확인해 주세요.', 'warning', 'login-consent');
    const account = getAccounts().find((item) => normalizeLoginId(item.loginId) === loginId);
    if (supabaseClient) {
        try {
            const profile = await signInRemote(loginId, password);
            applyRemoteProfile(profile);
            await loadRemoteMemberships();
            syncActivityHistory();
            state.activitySettings = getActivitySettings();
            closeLogin(); updateNav(); setView('activities', false);
            setStatus('Supabase 로그인에 성공했습니다. 참여할 활동을 찾아보세요.', 'success');
            return true;
        } catch (error) {
            // Supabase 연결 장애 때만 기존 브라우저 계정으로 제한적인 데모 fallback을 허용합니다.
            if (!account?.passwordHash) return setLoginStatus(error?.message === 'nickname_missing' ? '회원가입 후 공개 닉네임 설정을 완료해 주세요.' : supabaseErrorMessage(error, 'Supabase 로그인에 실패했습니다.'), 'warning', 'input-login-id');
        }
    }
    if (!account) return setLoginStatus('가입된 아이디를 찾을 수 없습니다. 먼저 회원가입을 완료해 주세요.', 'warning', 'input-login-id');
    if (!account.nickname) return setLoginStatus('회원가입 후 공개 닉네임 설정을 완료해 주세요.', 'warning', 'input-login-id');
    let passwordHash;
    try {
        passwordHash = await hashSecret(password);
    } catch {
        return setLoginStatus('비밀번호를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'warning', 'input-login-password');
    }
    if (passwordHash !== account.passwordHash) return setLoginStatus('아이디 또는 비밀번호가 올바르지 않습니다.', 'warning', 'input-login-password');
    state.user = publicUser({ id: account.id, nickname: account.nickname, icon: '🌱', trustScore: account.trustScore });
    state.filters.ageGroup = 'all';
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    state.remoteJoinedGroupIds = null;
    state.activitySettings = getActivitySettings();
    syncActivityHistory();
    closeLogin(); updateNav(); setView('activities', false);
    setStatus('닉네임으로 로그인되었습니다. 참여할 활동을 찾아보세요.', 'success');
}

async function logout() {
    closeProfile();
    if (supabaseClient) {
        try { await supabaseClient.auth.signOut(); } catch (error) { console.error('Supabase sign-out failed', error); }
    }
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PRIVATE_PROFILE_KEY);
    state.user = null; state.joinedGroupIds.clear(); state.remoteJoinedGroupIds = null; state.activitySettings = null;
    updateNav(); renderGroups(); setStatus('로그아웃했습니다.');
}

async function hydrateSupabaseSession() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (data.session?.user) {
            const profile = await remoteProfileForUser(data.session.user.id);
            if (profile?.nickname) {
                applyRemoteProfile(profile);
                state.activitySettings = getActivitySettings();
                updateNav();
                renderGroups();
                await loadRemoteMemberships();
            }
        }
        await loadRemoteActivities();
        syncActivityHistory();
        supabaseState.hydrated = true;
    } catch (error) {
        console.error('Supabase session restore failed', error);
        if (!state.user) setStatus(supabaseErrorMessage(error, 'Supabase 세션을 복원하지 못했습니다. 잠시 후 다시 시도해 주세요.'), 'warning');
    }
}

function validateActivity(activity) {
    if (!activity.title || !activity.purpose || !activity.description || !activity.location || !activity.scheduledAt || !activity.category || !activity.ageGroup) return '모든 필수 항목을 입력해 주세요.';
    const scheduledTime = new Date(activity.scheduledAt).getTime();
    if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) return '모임 시간은 현재보다 이후여야 합니다.';
    if (activity.maxParticipants < MIN_PARTICIPANTS || activity.maxParticipants > DEFAULT_MAX_PARTICIPANTS) return '모집 인원은 3명에서 6명 사이여야 합니다.';
    if (/자택|집|호텔|개인s*주소|우리집/i.test(activity.location)) return '공개된 상업·공공장소를 입력해 주세요.';
    return '';
}

async function handleCreate(event) {
    event.preventDefault();
    if (!state.user) return setStatus('로그인 후 모임을 개설할 수 있습니다.', 'warning');
    const rawScheduledAt = $('input-time').value;
    const parsedScheduledAt = rawScheduledAt ? new Date(rawScheduledAt) : null;
    const activity = {
        id: crypto.randomUUID?.() || String(Date.now()),
        title: $('input-title').value.trim(), purpose: $('input-purpose').value.trim(),
        description: $('input-desc').value.trim(), location: $('input-location').value.trim(),
        scheduledAt: parsedScheduledAt && Number.isFinite(parsedScheduledAt.getTime()) ? parsedScheduledAt.toISOString() : '',
        maxParticipants: Number($('input-limit').value), creatorId: state.user.id, hostTrustScore: state.user.trustScore,
        category: $('input-category').value, categoryFamily: activityFamilyForType($('input-category').value), ageGroup: $('input-age-group').value,
        conversationLevel: $('input-conversation-level').value, beginnerFriendly: $('input-beginner-friendly').checked, durationMinutes: Number($('input-duration').value),
        participants: 1, participantIds: [state.user.id], status: 'pending'
    };
    ensureGroupMetadata(activity);
    const creatorProfile = getPrivateProfile();
    if (creatorProfile?.gender) activity.privateGenderCounts = { male: creatorProfile.gender === 'male' ? 1 : 0, female: creatorProfile.gender === 'female' ? 1 : 0 };
    const validationError = validateActivity(activity);
    if (validationError) return showFeedback(validationError, false);
    setLoading(true); elements.feedback.classList.add('hidden'); setStatus('안전 검토 중입니다.');
    try {
        const verdict = await safetyReview(activity);
        if (verdict.decision !== 'approved') {
            showFeedback(`${verdict.explanation || '모임 개설이 보류되었습니다.'} ${verdict.guidance || '잠시 후 다시 시도해 주세요.'}`, false);
            setStatus('모임이 게시되지 않았습니다.', 'warning');
            return;
        }
        if (supabaseClient) await persistRemoteActivity(activity);
        activity.status = 'recruiting';
        persistence.publish(activity);
        state.joinedGroupIds.add(activity.id);
        upsertActivityHistory('created', activity);
        closeCreate(); renderGroups();
        setStatus('모임이 안전 검토를 통과해 게시되었습니다.', 'success');
    } catch (error) {
        console.error(error);
        showFeedback('안전 검토에 연결할 수 없습니다. 게시하지 않고 재시도를 기다립니다.', false);
        setStatus('안전 검토를 완료하지 못했습니다.', 'warning');
    } finally { setLoading(false); }
}

function showFeedback(message, safe) {
    elements.feedback.classList.remove('hidden', 'safe');
    if (safe) elements.feedback.classList.add('safe');
    elements.feedbackText.textContent = message;
}

async function toggleParticipation(groupId) {
    if (!state.user) return setStatus('로그인 후 참여할 수 있습니다.', 'warning');
    const group = state.groups.find((item) => item.id === groupId);
    if (!group || group.status !== 'recruiting') return setStatus('현재 참여할 수 없는 모임입니다.', 'warning');
    const joined = state.joinedGroupIds.has(groupId);
    ensureGroupMetadata(group);
    if (supabaseClient && group.remote) {
        try {
            const functionName = joined ? 'withdraw_activity' : 'join_activity';
            const { data, error } = await supabaseClient.rpc(functionName, { p_activity_id: groupId });
            if (error) throw error;
            const result = Array.isArray(data) ? data[0] : data;
            if (result?.status === 'full_or_unavailable') return setStatus('모집 인원이 가득 찼거나 참여할 수 없는 모임입니다.', 'warning');
            if (result?.status === 'already_joined') return setStatus('이미 참여 중인 모임입니다.', 'info');
            if (result?.status === 'not_joined') return setStatus('현재 참여 중인 모임이 아닙니다.', 'info');
            group.participants = Number(result?.participant_count ?? group.participants + (joined ? -1 : 1));
            if (joined) {
                state.joinedGroupIds.delete(groupId);
                recordParticipationEvent(group, 'withdrawn');
                queueParticipationNotification(group, 'withdrawn');
                removeJoinedActivityHistory(groupId);
                state.remoteJoinedGroupIds?.delete(String(groupId));
                setStatus('Supabase에서 모임 참여를 취소했습니다.');
            } else {
                state.joinedGroupIds.add(groupId);
                recordParticipationEvent(group, 'joined');
                queueParticipationNotification(group, 'joined');
                upsertActivityHistory('joined', group);
                state.remoteJoinedGroupIds?.add(String(groupId));
                setStatus(`'${group.title}' 모임에 참여했습니다.`, 'success');
                queueGenderBalanceNotification(group);
                queueUnderfilledNotification(group);
            }
            persistence.update(group); renderGroups();
        } catch (error) {
            setStatus(supabaseErrorMessage(error, 'Supabase에서 참여 상태를 저장하지 못했습니다. 다시 시도해 주세요.'), 'warning');
        }
        return;
    }
    const privateState = privateGroupState.get(group.id);
    const viewerGender = getPrivateProfile()?.gender;
    if (joined) {
        group.participants = Math.max(0, group.participants - 1);
        group.participantIds = (group.participantIds || []).filter((id) => id !== state.user.id);
        if (viewerGender && privateState) privateState[viewerGender] = Math.max(0, Number(privateState[viewerGender] || 0) - 1);
        state.joinedGroupIds.delete(groupId);
        recordParticipationEvent(group, 'withdrawn');
        queueParticipationNotification(group, 'withdrawn');
        removeJoinedActivityHistory(groupId);
        setStatus('모임 참여를 취소했습니다.');
    } else {
        if (group.participants >= group.maxParticipants) return setStatus('모집 인원이 가득 찼습니다.', 'warning');
        group.participants += 1; group.participantIds = [...(group.participantIds || []), state.user.id];
        if (viewerGender && privateState) privateState[viewerGender] = Number(privateState[viewerGender] || 0) + 1;
        state.joinedGroupIds.add(groupId);
        recordParticipationEvent(group, 'joined');
        queueParticipationNotification(group, 'joined');
        setStatus(`'${group.title}' 모임에 참여했습니다.`, 'success');
        upsertActivityHistory('joined', group);
        queueGenderBalanceNotification(group);
        queueUnderfilledNotification(group);
    }
    persistence.update(group); renderGroups();
}

function reportActivity(groupId) {
    if (!state.user) return setStatus('로그인 후 신고할 수 있습니다.', 'warning');
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) return setStatus('신고할 활동을 찾을 수 없습니다.', 'warning');
    elements.reportForm.reset();
    elements.reportModal.dataset.groupId = groupId;
    elements.reportActivityName.textContent = `'${group.title}' 활동을 신고합니다.`;
    elements.reportSubmitStatus.textContent = '';
    elements.reportSubmitStatus.dataset.tone = '';
    elements.reportSubmit.disabled = false;
    elements.reportSubmit.textContent = '신고 완료';
    elements.reportModal.classList.remove('hidden');
    elements.reportReason.focus();
}

function closeReport() {
    elements.reportModal.classList.add('hidden');
    elements.reportForm.reset();
    elements.reportSubmitStatus.textContent = '';
    elements.reportSubmitStatus.dataset.tone = '';
}

function submitReport(event) {
    event.preventDefault();
    if (!state.user) return closeReport();
    const groupId = elements.reportModal.dataset.groupId;
    const reason = elements.reportReason.value.trim();
    if (!reason) {
        elements.reportSubmitStatus.textContent = '신고 내용을 입력해 주세요.';
        elements.reportSubmitStatus.dataset.tone = 'warning';
        elements.reportReason.focus();
        return;
    }
    const reports = safeJson(localStorage.getItem(REPORTS_KEY), []);
    reports.push({ id: `${Date.now()}`, groupId, reporterId: state.user.id, reason: reason.trim().slice(0, 300), createdAt: new Date().toISOString() });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    elements.reportSubmitStatus.textContent = '신고가 완료되었습니다. 운영팀이 확인할게요.';
    elements.reportSubmitStatus.dataset.tone = 'success';
    elements.reportSubmit.disabled = true;
    elements.reportSubmit.textContent = '신고 완료됨';
    setStatus('신고가 접수되었습니다. 운영자 검토 전까지 활동을 주의 깊게 확인합니다.', 'success');
}

function setFeedbackRating(field, rating) {
    const input = $(`feedback-${field}`);
    const picker = document.querySelector(`.star-picker[data-rating-field="${field}"]`);
    if (!input || !picker) return;
    input.value = String(rating);
    picker.querySelectorAll('button[data-rating]').forEach((button) => {
        button.classList.toggle('selected', Number(button.dataset.rating) <= Number(rating));
        button.setAttribute('aria-checked', Number(button.dataset.rating) === Number(rating) ? 'true' : 'false');
    });
}

function resetFeedbackRatings() {
    ['punctuality', 'courtesy', 'rules'].forEach((field) => {
        const input = $(`feedback-${field}`);
        const picker = document.querySelector(`.star-picker[data-rating-field="${field}"]`);
        if (input) input.value = '';
        picker?.querySelectorAll('button[data-rating]').forEach((button) => {
            button.classList.remove('selected');
            button.setAttribute('aria-checked', 'false');
        });
    });
}

function openFeedback(groupId) {
    if (!state.user) return setStatus('로그인 후 평가할 수 있습니다.', 'warning');
    const group = state.groups.find((item) => item.id === groupId);
    const subject = $('feedback-subject');
    subject.replaceChildren();
    subject.append(createText('option', '참여자 평가 없이 내 활동만 기록'));
    subject.lastElementChild.value = '';
    (group?.participantIds || []).filter((id) => id !== state.user.id).forEach((id) => {
        subject.append(createText('option', id === state.user.id ? '나' : `참여자 ${id.slice(0, 6)}`));
        subject.lastElementChild.value = id;
    });
    elements.feedbackModal.dataset.groupId = groupId;
    elements.feedbackModal.classList.remove('hidden');
    const existingCheckin = getConnectionCheckins().find((item) => item.groupId === groupId && item.userId === state.user.id);
    if (existingCheckin) {
        $('feedback-feeling').value = existingCheckin.feeling;
        $('feedback-revisit').value = existingCheckin.revisit;
    }
    $('feedback-feeling').focus();
}

function closeFeedback() {
    elements.feedbackModal.classList.add('hidden');
    elements.feedbackForm.reset();
    resetFeedbackRatings();
    if (elements.feedbackSubmitStatus) { elements.feedbackSubmitStatus.textContent = ''; elements.feedbackSubmitStatus.dataset.tone = ''; }
}

function submitFeedback(event) {
    event.preventDefault();
    const groupId = elements.feedbackModal.dataset.groupId;
    const reviews = safeJson(localStorage.getItem(REVIEWS_KEY), []);
    const subjectId = $('feedback-subject').value;
    const checkins = getConnectionCheckins();
    const existingCheckinIndex = checkins.findIndex((item) => item.groupId === groupId && item.userId === state.user.id);
    const dimensions = ['punctuality', 'courtesy', 'rules'];
    const values = dimensions.map((dimension) => $(`feedback-${dimension}`).value);
    let behaviorRecorded = false;
    if (subjectId) {
        if (subjectId === state.user.id) return setFeedbackStatus('본인은 평가할 수 없습니다. 참여자 평가 없이 내 활동만 기록해 주세요.', 'warning', 'feedback-subject');
        if (values.some((value) => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) return setFeedbackStatus('참여자 평가를 하려면 세 가지 행동 별점을 모두 선택해 주세요.', 'warning');
        if (reviews.some((review) => review.groupId === groupId && review.reviewerId === state.user.id && review.subjectId === subjectId)) return setFeedbackStatus('이 참여자에게는 이미 평가를 제출했습니다.', 'warning', 'feedback-subject');
        reviews.push({ groupId, reviewerId: state.user.id, subjectId, dimensions: Object.fromEntries(dimensions.map((key, index) => [key, values[index]])), createdAt: new Date().toISOString() });
        localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
        const trust = safeJson(localStorage.getItem(TRUST_KEY), {});
        const score = getTrustProjection(subjectId, TRUST_BASELINE);
        trust[subjectId] = Math.max(0, Math.min(100, score + calculateTrustDelta(values)));
        localStorage.setItem(TRUST_KEY, JSON.stringify(trust));
        behaviorRecorded = true;
    }
    const feelingLabels = { comfortable: '편안하게 참여함', mixed: '조금 어색했지만 괜찮았음', slow: '다음에는 더 천천히 참여하고 싶음' };
    const revisitLabels = { yes: '다시 참여하고 싶음', maybe: '관심은 있지만 잠시 쉬고 싶음', not_now: '당분간 쉬고 싶음' };
    const nextCheckin = {
        groupId,
        userId: state.user.id,
        feeling: $('feedback-feeling').value,
        feelingLabel: feelingLabels[$('feedback-feeling').value],
        revisit: $('feedback-revisit').value,
        revisitLabel: revisitLabels[$('feedback-revisit').value],
        createdAt: new Date().toISOString()
    };
    if (existingCheckinIndex >= 0) checkins[existingCheckinIndex] = nextCheckin;
    else checkins.push(nextCheckin);
    localStorage.setItem(CONNECTION_CHECKINS_KEY, JSON.stringify(checkins));
    closeFeedback(); renderHistory(); setStatus(behaviorRecorded ? '활동 후 기록과 행동 기반 평가가 저장되었습니다.' : '활동 후 연결 기록이 저장되었습니다. 참여 온도에는 영향을 주지 않아요.', 'success');
}

function cancelUnderfilledGroups() {
    const now = Date.now(); let changed = false;
    state.groups.forEach((group) => {
        if (group.status === 'recruiting' && new Date(group.scheduledAt).getTime() - now <= CANCEL_WINDOW_MS && group.participants < MIN_PARTICIPANTS) {
            group.status = 'cancelled'; changed = true;
        }
    });
    if (changed) { persistence.save(); renderGroups(); setStatus('인원 미달 모임이 취소되었습니다.', 'warning'); }
}

function viewFromLocation() {
    const route = window.location.hash.replace(/^#\/?/, '');
    return ['home', 'activities', 'history', 'guide'].includes(route) ? route : 'home';
}

function setView(view, shouldScroll = true, updateUrl = true) {
    const requestedRecommendation = view === 'recommendation';
    const allowedViews = ['home', 'activities', 'history', 'guide'];
    const nextView = allowedViews.includes(view) ? view : 'home';
    if (updateUrl) {
        const nextRoute = nextView === 'home' ? '#/' : `#/${nextView}`;
        if (window.location.hash !== nextRoute) window.history.pushState({ view: nextView }, '', nextRoute);
    }
    document.body.dataset.view = nextView;
    if (elements.recommendationDock) elements.recommendationDock.open = requestedRecommendation;
    if (nextView === 'history') renderHistory();
    elements.viewTabs.forEach((tab) => {
        if (tab.classList.contains('nav-tab')) tab.classList.toggle('active', tab.dataset.viewTarget === nextView);
        if (tab.dataset.viewTarget) tab.setAttribute('aria-current', tab.dataset.viewTarget === nextView ? 'page' : 'false');
    });
    if (shouldScroll) window.scrollTo({ top: 0, behavior: 'auto' });
    if (requestedRecommendation) window.setTimeout(() => elements.recommendationDock?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
}

function openCreate() {
    if (!state.user) {
        openLogin();
        setStatus('모임 만들기는 로그인 후 이용할 수 있어요. 로그인 창에서 먼저 시작해 주세요.', 'info');
        return false;
    }
    setView('activities', false);
    elements.createModal.classList.remove('hidden'); elements.feedback.classList.add('hidden'); $('input-title').focus();
    setStatus('새 모임 정보를 입력한 뒤 안전 검토 후 모임 등록을 눌러 주세요.', 'info');
    return true;
}
function closeCreate() { elements.createModal.classList.add('hidden'); elements.form.reset(); elements.feedback.classList.add('hidden'); }

function applyGroupSearch() {
    state.filters.query = elements.search.value.trim();
    renderGroups();
    setStatus(state.filters.query ? `'${state.filters.query}' 검색 결과를 업데이트했어요.` : '전체 활동을 다시 보여드려요.', 'success');
}

function openConnectionRecommendation(interest = '', comfort = 'any') {
    setView('home', false);
    $('input-interest').value = interest;
    $('input-comfort').value = comfort;
    elements.recommendationDock.open = true;
    elements.recommendationDock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => $('input-interest').focus(), 250);
}

function handleStaticButtonClick(button, event) {
    const actions = {
        'btn-login': openLogin,
        'btn-signup': openSignup,
        'btn-close-login': closeLogin,
        'btn-close-signup': closeSignup,
        'btn-create': openCreate,
        'nav-create': openCreate,
        'btn-create-main': openCreate,
        'btn-profile': openProfile,
        'btn-close-profile': closeProfile,
        'btn-logout': logout,
        'btn-notifications': openNotifications,
        'btn-close-notifications': closeNotifications,
        'btn-close-report': closeReport,
        'btn-close-create': closeCreate,
        'btn-apply-search': applyGroupSearch,
        'btn-ai-recommendations': showAiRecommendedActivities,
        'btn-close-feedback': closeFeedback,
        'btn-close-activity-room': closeActivityRoom,
        'btn-check-id': checkSignupId,
        'btn-send-verification': sendSignupVerification,
        'btn-complete-verification': completeSignupVerification,
        'btn-find-id': () => { closeLogin(); openRecovery('id'); },
        'btn-find-password': () => { closeLogin(); openRecovery('password'); },
        'btn-close-recovery': closeRecovery
    };
    const action = actions[button.id];
    if (!action) return false;
    event.preventDefault();
    action();
    return true;
}

function init() {
    $('recovery-mode').addEventListener('change', updateRecoveryMode);
    state.user = publicUser(safeJson(localStorage.getItem(USER_KEY), null));
    state.activitySettings = getActivitySettings();
    if (state.user && state.user.trustScore === 36.5) {
        state.user.trustScore = 50;
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    }
    state.filters.ageGroup = 'all';
    persistence.load(); loadNotifications(); renderCategoryOptions(); migrateCurrentUserAccount(state.user); syncActivityHistory(); updateNav(); renderGroups(); cancelUnderfilledGroups(); setView(viewFromLocation(), false, false);
    elements.profileForm.addEventListener('submit', submitProfile);
    $('signup-id').addEventListener('input', () => { signupState.idAvailable = false; signupState.idCheckedId = ''; $('signup-id').dataset.checkedId = ''; $('signup-id').dataset.idAvailable = 'false'; $('signup-id-status').textContent = '아이디가 변경되었습니다. 다시 중복 확인해 주세요.'; $('signup-id-status').dataset.tone = 'info'; });
    $('signup-password').addEventListener('input', validateSignupPassword);
    $('signup-password-confirm').addEventListener('input', validateSignupPasswordMatch);
    $('signup-age').addEventListener('input', enforceSignupAge);
    $('signup-verification-contact').addEventListener('input', resetSignupVerification);
    $('signup-verification-method').addEventListener('change', resetSignupVerification);
    elements.form.addEventListener('submit', handleCreate);
    elements.feedbackForm.addEventListener('submit', submitFeedback);
    elements.roomChatForm.addEventListener('submit', submitActivityRoomChat);
    elements.reportForm.addEventListener('submit', submitReport);
    elements.recommendationForm.addEventListener('submit', handleRecommendation);
    elements.search.addEventListener('input', (event) => { state.filters.query = event.target.value; renderGroups(); });
    window.addEventListener('hashchange', () => setView(viewFromLocation(), true, false));
    window.addEventListener('popstate', () => setView(viewFromLocation(), true, false));
    window.addEventListener('storage', (event) => { if (event.key === GROUPS_KEY) { persistence.load(); renderGroups(); } if (event.key === NOTIFICATIONS_KEY) { loadNotifications(); renderNotifications(); } if (event.key === ACTIVITY_CHAT_KEY && elements.activityRoomModal.dataset.groupId) renderActivityRoomChat(elements.activityRoomModal.dataset.groupId); });
    window.addEventListener('dg:groups-changed', renderGroups);
    window.setInterval(cancelUnderfilledGroups, 30_000);
    void hydrateSupabaseSession();
}

document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (button && handleStaticButtonClick(button, event)) return;
    const star = event.target.closest?.('.star-picker button[data-rating]');
    if (star) {
        event.preventDefault();
        setFeedbackRating(star.closest('.star-picker').dataset.ratingField, star.dataset.rating);
        return;
    }
    const target = event.target.closest?.('[data-view-target]');
    if (!target || target.id === 'nav-create') return;
    event.preventDefault();
    setView(target.dataset.viewTarget);
});

document.addEventListener('submit', (event) => {
    if (event.target.id === 'form-login') return login(event);
    if (event.target.id === 'form-signup') return submitSignup(event);
    if (event.target.id === 'form-account-recovery') return submitAccountRecovery(event);
    if (event.target.id === 'form-nickname-setup') return submitNicknameSetup(event);
});

document.addEventListener('DOMContentLoaded', init);
window.openFeedback = openFeedback;
