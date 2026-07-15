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
const REPORTS_KEY = 'dg_reports_v1';
const REVIEWS_KEY = 'dg_reviews_v1';
const TRUST_KEY = 'dg_trust_projection_v1';
const NOTIFICATIONS_KEY = 'dg_notifications_v1';
const POSTS_KEY = 'dg_board_posts_v1';
const OPERATIONS_KEY = 'dg_operations_v1';
const RECOMMENDATION_CACHE_KEY = 'dg_recommendation_cache_v1';
const RECOMMENDATION_CACHE_STATS_KEY = 'dg_recommendation_cache_stats_v1';

const state = {
    user: null,
    groups: [],
    joinedGroupIds: new Set(),
    recommendations: [],
    pendingSignupId: null,
    filters: { query: '', ageGroup: 'all', category: 'all' },
    notifications: [],
    posts: []
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
    loginModal: $('modal-login'),
    closeLogin: $('btn-close-login'),
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
elements.createGuide = $('btn-create-guide');
elements.ageFilters = $('age-filter-buttons');
elements.categoryFilters = $('category-filter-buttons');
elements.groupCount = $('group-count');
elements.boardList = $('board-list');
elements.boardEmpty = $('board-empty');
elements.categoryList = $('category-list');
elements.activityExamples = $('activity-examples');
elements.signupSubmitStatus = $('signup-submit-status');
elements.chatModal = $('modal-chatbot');
elements.openChat = $('btn-open-chatbot');
elements.closeChat = $('btn-close-chatbot');
elements.chatForm = $('form-chatbot');
elements.chatInput = $('input-chatbot');
elements.chatMessages = $('chat-messages');
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
    state.filters.ageGroup = profile.age_group || 'all';
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

function getPrivateProfile() {
    return safeJson(localStorage.getItem(PRIVATE_PROFILE_KEY), null);
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
    const trust = safeJson(localStorage.getItem(TRUST_KEY), {});
    return normalizedTrustScore(trust[String(userId)] ?? fallback);
}

function calculateTrustDelta(values) {
    const positive = values.filter((value) => value === 'positive').length;
    const negative = values.filter((value) => value === 'negative').length;
    return positive * TRUST_POSITIVE_DELTA - negative * TRUST_NEGATIVE_DELTA;
}

function seedGroups() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    return [
        {
            id: 'seed-walk', title: '망원 한강공원 가볍게 산책하실 분',
            purpose: '퇴근 후 동네 산책과 가벼운 대화',
            description: '날씨가 좋은 날 함께 걷고 캔커피를 마시는 모임입니다.',
            location: '망원 한강공원 입구', scheduledAt: tomorrow,
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: 'all', category: '운동',
            participantIds: [], privateGenderCounts: { male: 2, female: 0 }
        },
        {
            id: 'seed-reading', title: '동네 도서관에서 각자 책 읽기',
            purpose: '말없이 각자 책을 읽고 안전하게 귀가하기',
            description: '대화를 강요하지 않고 같은 공간에서 각자의 시간을 보냅니다.',
            location: '마포 중앙도서관 1층', scheduledAt: dayAfter,
            status: 'recruiting', participants: 1, maxParticipants: 4, ageGroup: '20s', category: '독서·스터디',
            participantIds: [], privateGenderCounts: { male: 1, female: 0 }
        },
        {
            id: 'seed-moms', title: '40대 엄마들의 학원·교육 정보 나눔',
            purpose: '아이 학원과 지역 교육 정보를 편하게 공유',
            description: '어린 자녀를 둔 이웃끼리 공개된 카페에서 정보를 나눕니다.',
            location: '상암 주민센터 열린공간', scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: '40s', category: '친목·정보 공유',
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-running', title: '초보 러너를 위한 주말 러닝 크루',
            purpose: '천천히 달리며 함께 운동 습관 만들기',
            description: '속도를 맞추고 중간 휴식을 포함하는 초보자 중심 러닝입니다.',
            location: '월드컵공원 평화광장', scheduledAt: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 3, maxParticipants: 6, ageGroup: 'all', category: '운동',
            participantIds: [], privateGenderCounts: { male: 2, female: 1 }
        },
        {
            id: 'seed-ai-study', title: '30대 직장인을 위한 AI 활용 스터디',
            purpose: '업무에 바로 쓰는 AI 활용법을 함께 실습',
            description: '각자 사례를 가져와 서로의 방법을 나누고 다음 주 실천 목표를 정합니다.',
            location: '합정 공유오피스 라운지', scheduledAt: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 2, maxParticipants: 6, ageGroup: '30s', category: 'AI 활용 스터디',
            participantIds: [], privateGenderCounts: { male: 1, female: 1 }
        },
        {
            id: 'seed-history', title: '50대 이상과 함께하는 역사 유적 답사',
            purpose: '천천히 걸으며 지역의 역사와 이야기를 나누기',
            description: '무리하지 않는 동선으로 박물관과 유적을 함께 둘러봅니다.',
            location: '서대문형무소역사관 정문', scheduledAt: new Date(Date.now() + 144 * 60 * 60 * 1000).toISOString(),
            status: 'recruiting', participants: 4, maxParticipants: 6, ageGroup: '50plus', category: '역사 탐방 및 세미나',
            participantIds: [], privateGenderCounts: { male: 3, female: 1 }
        }
    ];
}

function seedPosts() {
    return [
        { id: 'post-1', title: '처음 참여하는 분께 안내드려요', body: '공개 장소에서 만나고, 부담스러우면 언제든 참여를 취소할 수 있어요.', author: '운영팀', category: '안전 안내', createdAt: new Date().toISOString() },
        { id: 'post-2', title: '이번 주 가볍게 읽을 책 추천받아요', body: '조용히 각자 읽고 마지막 10분만 감상을 나누는 모임을 준비하고 있어요.', author: '느긋한 독서러', category: '독서·스터디', createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
        { id: 'post-3', title: '동네 운동 모임은 어떤 게 좋을까요?', body: '러닝, 산책, 배드민턴처럼 처음 참여하기 쉬운 활동을 함께 찾아봐요.', author: '주말의 시작', category: '운동', createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() }
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
    { id: 'experience', label: '체험형', match: /베이킹|요리|바리스타|도예|향수|비누|꽃꽂이|원데이/ }
];

function activityFamilyForType(type) {
    return ACTIVITY_FAMILIES.find((family) => family.match.test(String(type || '')))?.id || 'other';
}

function activityFamilyLabel(familyId) {
    return ACTIVITY_FAMILIES.find((family) => family.id === familyId)?.label || '기타';
}

function ensureGroupMetadata(group) {
    group.ageGroup = group.ageGroup || 'all';
    group.category = group.category || '기타 모임';
    group.categoryFamily = group.categoryFamily && group.categoryFamily !== 'other' ? group.categoryFamily : activityFamilyForType(group.category);
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
    (data || []).forEach((row) => state.joinedGroupIds.add(row.activity_id));
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

function loadPosts() {
    const stored = safeJson(localStorage.getItem(POSTS_KEY), null);
    state.posts = Array.isArray(stored) && stored.length ? stored : seedPosts();
    localStorage.setItem(POSTS_KEY, JSON.stringify(state.posts));
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
    if (!CONFIG.SAFETY_REVIEW_URL) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        return mockSafetyReview(activity);
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(CONFIG.SAFETY_REVIEW_URL, {
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
    const searchable = normalizeSafetyText(`${group.title} ${group.purpose} ${group.description} ${group.category}`);
    const queryMatches = !query || searchable.includes(query);
    const selectedAge = state.filters.ageGroup === 'mine' ? getViewerAgeGroup() : state.filters.ageGroup;
    const ageMatches = selectedAge === 'all' || group.ageGroup === 'all' || group.ageGroup === selectedAge;
    const categoryMatches = state.filters.category === 'all' || group.categoryFamily === state.filters.category;
    return queryMatches && ageMatches && categoryMatches;
}

function renderAgeFilters() {
    if (!elements.ageFilters) return;
    elements.ageFilters.replaceChildren();
    [['all', '전체 모집'], ['mine', '내 연령대'], ['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50plus', '50대 이상']].forEach(([value, label]) => {
        const button = createText('button', label, `filter-btn${state.filters.ageGroup === value ? ' active' : ''}`);
        button.type = 'button';
        button.dataset.ageFilter = value;
        button.addEventListener('click', () => { state.filters.ageGroup = value; renderGroups(); setStatus(`${label} 기준으로 활동을 보고 있어요.`, 'success'); });
        elements.ageFilters.append(button);
    });
}

function renderCategoryFilters() {
    if (!elements.categoryFilters) return;
    elements.categoryFilters.replaceChildren();
    const recruiting = state.groups.filter((group) => group.status === 'recruiting');
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
    const recruiting = state.groups.filter((group) => group.status === 'recruiting' && groupMatchesFilters(group));
    if (elements.groupCount) elements.groupCount.textContent = `${recruiting.length}개 모집 중`;
    elements.empty.textContent = state.filters.query || state.filters.ageGroup !== 'all' || state.filters.category !== 'all'
        ? '조건에 맞는 모집방이 없어요. 검색어나 연령대 필터를 바꿔보세요.'
        : '아직 열린 활동이 없어요. 로그인 후 부담 없는 첫 만남을 만들어 보세요.';
    elements.empty.classList.toggle('hidden', recruiting.length > 0);
    renderAgeFilters();
    renderCategoryFilters();
    recruiting.forEach((group) => {
        ensureGroupMetadata(group);
        const card = document.createElement('article');
        card.id = `activity-${group.id}`;
        card.className = 'group-card';
        const ageBadge = createText('span', group.ageGroup === 'all' ? '🌈 전 연령 참여 가능' : `${ageGroupLabel(group.ageGroup)} 중심 모임`, `age-badge${group.ageGroup === 'all' ? ' age-all' : ''}`);
        const temperature = normalizedTrustScore(group.hostTrustScore);
        const temperatureBadge = createText('span', `🌡 개설자 함께하기 신뢰도 ${temperature.toFixed(1)}°C`, `temperature-badge ${trustScoreClass(temperature)}`);
        temperatureBadge.title = '시간 약속·배려와 매너·규칙 준수에 기반한 공개 지표입니다. 인기나 외모를 평가하지 않습니다.';
        card.append(
            ageBadge,
            createText('span', `${activityFamilyLabel(group.categoryFamily)} · ${group.category}`, 'category-badge'),
            temperatureBadge,
            createText('h3', group.title, 'card-title'),
            createText('p', group.purpose, 'card-purpose'),
            createText('p', group.description),
            createText('span', `📍 ${group.location}`, 'card-meta'),
            createText('span', `🕒 ${formatDate(group.scheduledAt)}`, 'card-meta'),
            createText('span', `👥 ${group.participants}/${group.maxParticipants}명 · 최소 3명`, 'card-meta')
        );
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const status = createText('span', statusLabel(group.status), `card-status status-${group.status}`);
        const join = document.createElement('button');
        join.type = 'button'; join.className = 'btn-outline';
        join.textContent = state.joinedGroupIds.has(group.id) ? '참여 취소' : '참여 신청하기';
        join.addEventListener('click', () => toggleParticipation(group.id));
        const report = document.createElement('button');
        report.type = 'button'; report.className = 'btn-text'; report.textContent = '신고';
        report.addEventListener('click', () => reportActivity(group.id));
        actions.append(status, join, report);
        card.append(actions);
        elements.list.append(card);
    });
}

function renderBoard() {
    if (!elements.boardList) return;
    const query = normalizeSafetyText(state.filters.query);
    const posts = state.posts.filter((post) => !query || normalizeSafetyText(`${post.title} ${post.body} ${post.category}`).includes(query));
    elements.boardList.replaceChildren();
    elements.boardEmpty.classList.toggle('hidden', posts.length > 0);
    posts.forEach((post) => {
        const card = document.createElement('article');
        card.className = 'board-card';
        card.append(createText('span', post.category, 'category-badge'), createText('h3', post.title), createText('p', post.body), createText('span', `${post.author} · ${formatDate(post.createdAt)}`, 'card-meta'));
        elements.boardList.append(card);
    });
}

function renderCategoryOptions() {
    const select = $('input-category');
    if (select) ACTIVITY_TYPES.forEach((type) => select.append(createText('option', type)));
    if (elements.categoryList) {
        elements.categoryList.replaceChildren();
        ACTIVITY_TYPES.forEach((type) => elements.categoryList.append(createText('span', type, 'category-chip')));
    }
    if (elements.activityExamples) {
        elements.activityExamples.replaceChildren();
        ACTIVITY_TYPES.forEach((type) => {
            const chip = createText('button', type, 'category-chip activity-example-chip');
            chip.type = 'button';
            chip.addEventListener('click', () => {
                elements.search.value = type;
                applyGroupSearch();
            });
            elements.activityExamples.append(chip);
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
        const confirm = document.createElement('button');
        confirm.type = 'button'; confirm.className = 'btn-primary btn-small'; confirm.textContent = '확인했어요';
        confirm.addEventListener('click', () => dismissNotification(notification.id));
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'btn-outline btn-small'; cancel.textContent = '참여 취소';
        cancel.addEventListener('click', () => { if (state.joinedGroupIds.has(notification.groupId)) toggleParticipation(notification.groupId); dismissNotification(notification.id); });
        actions.append(confirm, cancel);
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
}

function closeNotifications() {
    elements.notificationModal.classList.add('hidden');
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
            const searchable = normalizeSafetyText(`${group.title} ${group.purpose} ${group.description}`);
            const interestHit = interestTerms.length === 0 ? 0.25 : interestTerms.some((term) => searchable.includes(term)) ? 0.55 : 0;
            const comfortText = comfort === 'quiet' && /말없이|각자|조용/.test(searchable) ? 0.25 : comfort === 'light_conversation' && /대화|이야기/.test(searchable) ? 0.25 : comfort === 'active' && /산책|운동|걷기/.test(searchable) ? 0.25 : comfort === 'any' ? 0.1 : 0;
            const daysAway = (new Date(group.scheduledAt).getTime() - now) / (24 * 60 * 60 * 1000);
            const timeHit = timeWindow === 'today' && daysAway <= 1.2 ? 0.15 : timeWindow === 'this_week' && daysAway <= 7 ? 0.15 : timeWindow === 'any' ? 0.1 : 0;
            const fit = Math.min(0.99, interestHit + comfortText + timeHit + 0.05);
            const reason = interestHit >= 0.5 ? `${interest} 관심과 목적이 맞고, ` : '모임 목적이 부담 없이 참여하기 좋고, ';
            const comfortReason = comfort === 'quiet' ? '조용히 각자의 시간을 보낼 수 있어요.' : comfort === 'active' ? '함께 움직이는 활동이라 잘 맞아요.' : '참여 방식이 가벼워서 시작하기 좋아요.';
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
    if (CONFIG.RECOMMENDATION_URL) {
        try {
            const result = await requestAutomation('recommend', { preferences, activities: state.groups.filter((group) => group.status === 'recruiting').map(({ id, title, purpose, description, location, scheduledAt, participants, maxParticipants }) => ({ id, title, purpose, description, location, scheduledAt, participants, maxParticipants })) }, CONFIG.RECOMMENDATION_URL);
            if (Array.isArray(result?.recommendations)) matches = result.recommendations.map((item) => ({ activityId: item.activityId, fit: Number(item.fit) || 0, reason: String(item.reason || '') })).filter((item) => item.activityId && item.reason);
        } catch { matches = null; }
    }
    matches ||= localRecommendationMatches(preferences);
    cache[key] = matches; localStorage.setItem(RECOMMENDATION_CACHE_KEY, JSON.stringify(cache));
    operationLog('recommend', matches.length ? 'success' : 'empty', startedAt, { policyVersion: CONFIG.RECOMMENDATION_URL ? 'recommendation-v1-protected' : `recommendation-v1-${route}` });
    return matches;
}

function renderRecommendations(matches, preferences) {
    elements.recommendationList.replaceChildren();
    if (!matches.length) {
        elements.recommendationStatus.textContent = preferences.interest ? '조건에 꼭 맞는 활동이 아직 없어요. 관심사를 조금 넓혀 다시 찾아보세요.' : '관심사를 한두 단어 입력하면 더 잘 맞는 활동을 찾아드려요.';
        elements.recommendationStatus.dataset.tone = 'warning';
        return;
    }
    elements.recommendationStatus.textContent = '현재 모집 중인 활동 정보와 입력한 조건을 비교해 추천했어요.';
    elements.recommendationStatus.dataset.tone = 'success';
    matches.forEach((match) => {
        const group = state.groups.find((item) => item.id === match.activityId);
        if (!group) return;
        const card = document.createElement('article');
        card.className = 'recommendation-card';
        card.append(createText('div', `${Math.round(match.fit * 100)}% 잘 맞아요`, 'fit-badge'), createText('h3', group.title), createText('p', match.reason, 'recommendation-reason'), createText('small', '근거: 현재 모집 중인 활동 정보와 입력한 조건', 'recommendation-source'), createText('span', `📍 ${group.location} · ${formatDate(group.scheduledAt)}`, 'card-meta'));
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
    elements.recommendationStatus.textContent = CONFIG.RECOMMENDATION_URL ? '보호된 추천 Agent가 활동 근거와 조건을 확인하고 있어요...' : '현재 모집 중인 활동 정보와 참여 조건을 비교하고 있어요...';
    const matches = await getRecommendations(preferences);
    renderRecommendations(matches, preferences);
}

function updateNav() {
    const loggedIn = Boolean(state.user);
    elements.login.classList.toggle('hidden', loggedIn);
    elements.signup.classList.toggle('hidden', loggedIn);
    elements.create.classList.toggle('hidden', !loggedIn);
    elements.profile.classList.toggle('hidden', !loggedIn);
    elements.notificationsButton.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
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
        state.filters.ageGroup = 'mine';
        updateNav();
        setView('activities', false);
        setStatus('회원가입과 공개 닉네임 설정이 완료되어 자동 로그인되었습니다. 그룹 활동을 시작해 보세요.', 'success');
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
    const usedIds = safeJson(localStorage.getItem('dg_signup_ids_v1'), []);
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
    if (draft.password.length < 8) return setSignupStatus('비밀번호는 8자 이상 입력해 주세요.', 'warning', 'signup-password');
    if (draft.password !== draft.passwordConfirm) return setSignupStatus('비밀번호와 확인값이 서로 일치하지 않습니다.', 'warning', 'signup-password-confirm');
    if (idInput.dataset.checkedId !== draft.loginId || idInput.dataset.idAvailable !== 'true') {
        return setSignupStatus('아이디 입력 후 중복 확인을 완료해 주세요.', 'warning', 'signup-id');
    }
    if (!signupState.verificationComplete || signupState.verificationContact !== draft.verificationContact || signupState.verificationMethod !== draft.verificationMethod) {
        return setSignupStatus('인증하기와 인증 확인을 완료해 주세요.', 'warning', 'signup-verification-code');
    }

    const usedIds = safeJson(localStorage.getItem('dg_signup_ids_v1'), []);
    const accounts = getAccounts();
    const duplicateId = usedIds.some((usedIdValue) => normalizeLoginId(usedIdValue) === draft.loginId)
        || accounts.some((account) => normalizeLoginId(account.loginId) === draft.loginId);
    if (duplicateId) {
        idInput.dataset.idAvailable = 'false';
        signupState.idAvailable = false;
        return setSignupStatus('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.', 'warning', 'signup-id');
    }

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
            ageGroup: ageGroupFromAge(draft.age), phone: draft.phone, signupId: draft.loginId,
            verificationMethod: draft.verificationMethod, marketingConsent: draft.marketingConsent
        };
        const previous = {
            accounts: localStorage.getItem(ACCOUNTS_KEY), ids: localStorage.getItem('dg_signup_ids_v1'),
            profile: localStorage.getItem(PRIVATE_PROFILE_KEY)
        };
        try {
            saveAccounts([...accounts, account]);
            localStorage.setItem('dg_signup_ids_v1', JSON.stringify([...new Set([...usedIds, draft.loginId])]));
            localStorage.setItem(PRIVATE_PROFILE_KEY, JSON.stringify(privateProfile));
        } catch (storageError) {
            if (previous.accounts === null) localStorage.removeItem(ACCOUNTS_KEY); else localStorage.setItem(ACCOUNTS_KEY, previous.accounts);
            if (previous.ids === null) localStorage.removeItem('dg_signup_ids_v1'); else localStorage.setItem('dg_signup_ids_v1', previous.ids);
            if (previous.profile === null) localStorage.removeItem(PRIVATE_PROFILE_KEY); else localStorage.setItem(PRIVATE_PROFILE_KEY, previous.profile);
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
            closeLogin(); updateNav();
            setView('activities', false);
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
    closeLogin(); updateNav();
    setView('activities', false);
    setStatus('닉네임으로 로그인되었습니다. 참여할 활동을 찾아보세요.', 'success');
}

async function logout() {
    closeProfile();
    if (supabaseClient) {
        try { await supabaseClient.auth.signOut(); } catch (error) { console.error('Supabase sign-out failed', error); }
    }
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PRIVATE_PROFILE_KEY);
    state.user = null; state.joinedGroupIds.clear();
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
                updateNav();
                renderGroups();
                await loadRemoteMemberships();
            }
        }
        await loadRemoteActivities();
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
                setStatus('Supabase에서 모임 참여를 취소했습니다.');
            } else {
                state.joinedGroupIds.add(groupId);
                setStatus(`'${group.title}' 모임에 참여했습니다.`, 'success');
                queueGenderBalanceNotification(group);
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
        setStatus('모임 참여를 취소했습니다.');
    } else {
        if (group.participants >= group.maxParticipants) return setStatus('모집 인원이 가득 찼습니다.', 'warning');
        group.participants += 1; group.participantIds = [...(group.participantIds || []), state.user.id];
        if (viewerGender && privateState) privateState[viewerGender] = Number(privateState[viewerGender] || 0) + 1;
        state.joinedGroupIds.add(groupId); setStatus(`'${group.title}' 모임에 참여했습니다.`, 'success');
        queueGenderBalanceNotification(group);
    }
    persistence.update(group); renderGroups();
}

function reportActivity(groupId) {
    if (!state.user) return setStatus('로그인 후 신고할 수 있습니다.', 'warning');
    const reason = window.prompt('신고 사유를 간단히 입력해 주세요.');
    if (!reason || !reason.trim()) return setStatus('신고 사유가 입력되지 않아 신고를 취소했습니다.', 'info');
    const reports = safeJson(localStorage.getItem(REPORTS_KEY), []);
    reports.push({ id: `${Date.now()}`, groupId, reporterId: state.user.id, reason: reason.trim().slice(0, 300), createdAt: new Date().toISOString() });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    setStatus('신고가 접수되었습니다. 운영자 검토 전까지 활동을 주의 깊게 확인합니다.', 'success');
}

function openFeedback(groupId) {
    if (!state.user) return setStatus('로그인 후 평가할 수 있습니다.', 'warning');
    const group = state.groups.find((item) => item.id === groupId);
    const subject = $('feedback-subject');
    subject.replaceChildren();
    (group?.participantIds || []).filter((id) => id !== state.user.id).forEach((id) => {
        subject.append(createText('option', id === state.user.id ? '나' : `참여자 ${id.slice(0, 6)}`));
        subject.lastElementChild.value = id;
    });
    if (!subject.options.length) return setStatus('평가할 다른 참여자가 없습니다.', 'warning');
    elements.feedbackModal.dataset.groupId = groupId;
    elements.feedbackModal.classList.remove('hidden');
    $('feedback-punctuality').focus();
}

function closeFeedback() {
    elements.feedbackModal.classList.add('hidden');
    elements.feedbackForm.reset();
    if (elements.feedbackSubmitStatus) { elements.feedbackSubmitStatus.textContent = ''; elements.feedbackSubmitStatus.dataset.tone = ''; }
}

function submitFeedback(event) {
    event.preventDefault();
    const groupId = elements.feedbackModal.dataset.groupId;
    const reviews = safeJson(localStorage.getItem(REVIEWS_KEY), []);
    const subjectId = $('feedback-subject').value;
    if (!subjectId || subjectId === state.user.id) return setFeedbackStatus('평가할 참여자를 선택해 주세요. 본인은 평가할 수 없습니다.', 'warning', 'feedback-subject');
    if (reviews.some((review) => review.groupId === groupId && review.reviewerId === state.user.id && review.subjectId === subjectId)) return setFeedbackStatus('이 참여자에게는 이미 평가를 제출했습니다.', 'warning', 'feedback-subject');
    const dimensions = ['punctuality', 'courtesy', 'rules'];
    const values = dimensions.map((dimension) => $(`feedback-${dimension}`).value);
    reviews.push({ groupId, reviewerId: state.user.id, subjectId, dimensions: Object.fromEntries(dimensions.map((key, index) => [key, values[index]])), createdAt: new Date().toISOString() });
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    const trust = safeJson(localStorage.getItem(TRUST_KEY), {});
    const score = getTrustProjection(subjectId, TRUST_BASELINE);
    trust[subjectId] = Math.max(0, Math.min(100, score + calculateTrustDelta(values)));
    localStorage.setItem(TRUST_KEY, JSON.stringify(trust));
    closeFeedback(); setStatus('행동 기반 평가가 제출되었습니다.', 'success');
}

function appendChatMessage(role, message) {
    const node = createText('div', message, `chat-message ${role}`);
    elements.chatMessages.append(node);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function chatbotReply(question) {
    const normalized = normalizeSafetyText(question);
    if (/안전|신고|개인정보|성비/.test(normalized)) return '모임은 공개된 장소에서 진행하고, 참여자의 실명·성별·나이·성비는 공개하지 않아요. 불편한 활동은 카드의 신고 버튼으로 알려주세요.';
    if (/회원가입|가입|로그인/.test(normalized)) return '회원가입에는 기본 정보와 본인인증이 필요하며, 가입이 끝나면 공개 닉네임을 설정해요. 로그인 후에는 마이페이지에서 닉네임을 바꿀 수 있어요.';
    if (/참여|최소|인원/.test(normalized)) return '모임은 최소 3명부터 운영돼요. 모집 인원이 부족하면 시작 전에 취소될 수 있고, 전 연령 참여 가능 방과 연령대 중심 방을 구분해 볼 수 있어요.';
    const matches = state.groups.filter((group) => group.status === 'recruiting' && normalizeSafetyText(`${group.title} ${group.purpose} ${group.category}`).includes(normalized)).slice(0, 2);
    if (matches.length) return `관련 모집방을 찾았어요: ${matches.map((group) => group.title).join(', ')}. 화면의 참여 신청하기 버튼에서 확인해 보세요.`;
    return '검색창에 산책·러닝·독서·스터디처럼 관심사를 입력해 보세요. 원하는 모임이 없으면 로그인 후 모임을 개설할 수 있어요.';
}

function openChatbot() {
    elements.chatModal.classList.remove('hidden');
    elements.chatInput.focus();
}

function closeChatbot() {
    elements.chatModal.classList.add('hidden');
}

function handleChatbot(event) {
    event.preventDefault();
    const guard = guardRecommendationInput(elements.chatInput.value);
    if (!guard.ok) return appendChatMessage('assistant', guard.message);
    const question = guard.value;
    appendChatMessage('user', question);
    appendChatMessage('assistant', chatbotReply(question));
    elements.chatInput.value = '';
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
    return ['home', 'activities', 'recommendation', 'board', 'guide'].includes(route) ? route : 'home';
}

function setView(view, shouldScroll = true, updateUrl = true) {
    const allowedViews = ['home', 'activities', 'recommendation', 'board', 'guide'];
    const nextView = allowedViews.includes(view) ? view : 'home';
    if (updateUrl) {
        const nextRoute = nextView === 'home' ? '#/' : `#/${nextView}`;
        if (window.location.hash !== nextRoute) window.history.pushState({ view: nextView }, '', nextRoute);
    }
    document.body.dataset.view = nextView;
    if (elements.recommendationDock) elements.recommendationDock.open = nextView === 'recommendation';
    elements.viewTabs.forEach((tab) => {
        if (tab.classList.contains('nav-tab')) tab.classList.toggle('active', tab.dataset.viewTarget === nextView);
        if (tab.dataset.viewTarget) tab.setAttribute('aria-current', tab.dataset.viewTarget === nextView ? 'page' : 'false');
    });
    if (shouldScroll) window.scrollTo({ top: 0, behavior: 'auto' });
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
    renderBoard();
    setStatus(state.filters.query ? `'${state.filters.query}' 검색 결과를 업데이트했어요.` : '전체 활동을 다시 보여드려요.', 'success');
}

function openConnectionRecommendation(interest = '', comfort = 'any') {
    setView('recommendation', false);
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
        'btn-create-guide': openCreate,
        'btn-profile': openProfile,
        'btn-close-profile': closeProfile,
        'btn-logout': logout,
        'btn-notifications': openNotifications,
        'btn-close-notifications': closeNotifications,
        'btn-close-create': closeCreate,
        'btn-apply-search': applyGroupSearch,
        'btn-open-chatbot': openChatbot,
        'btn-close-chatbot': closeChatbot,
        'btn-close-feedback': closeFeedback,
        'btn-check-id': checkSignupId,
        'btn-send-verification': sendSignupVerification,
        'btn-complete-verification': completeSignupVerification
    };
    const action = actions[button.id];
    if (!action) return false;
    event.preventDefault();
    action();
    return true;
}

function init() {
    state.user = publicUser(safeJson(localStorage.getItem(USER_KEY), null));
    if (state.user && state.user.trustScore === 36.5) {
        state.user.trustScore = 50;
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    }
    if (state.user && getPrivateProfile()?.userId === state.user.id) state.filters.ageGroup = 'mine';
    persistence.load(); loadPosts(); loadNotifications(); renderCategoryOptions(); migrateCurrentUserAccount(state.user); updateNav(); renderGroups(); renderBoard(); cancelUnderfilledGroups(); setView(viewFromLocation(), false, false);
    elements.profileForm.addEventListener('submit', submitProfile);
    $('signup-id').addEventListener('input', () => { signupState.idAvailable = false; signupState.idCheckedId = ''; $('signup-id').dataset.checkedId = ''; $('signup-id').dataset.idAvailable = 'false'; $('signup-id-status').textContent = '아이디가 변경되었습니다. 다시 중복 확인해 주세요.'; $('signup-id-status').dataset.tone = 'info'; });
    $('signup-age').addEventListener('input', enforceSignupAge);
    $('signup-verification-contact').addEventListener('input', resetSignupVerification);
    $('signup-verification-method').addEventListener('change', resetSignupVerification);
    elements.form.addEventListener('submit', handleCreate);
    elements.feedbackForm.addEventListener('submit', submitFeedback);
    elements.recommendationForm.addEventListener('submit', handleRecommendation);
    elements.search.addEventListener('input', (event) => { state.filters.query = event.target.value; renderGroups(); renderBoard(); });
    elements.chatForm.addEventListener('submit', handleChatbot);
    window.addEventListener('hashchange', () => setView(viewFromLocation(), true, false));
    window.addEventListener('popstate', () => setView(viewFromLocation(), true, false));
    window.addEventListener('storage', (event) => { if (event.key === GROUPS_KEY) { persistence.load(); renderGroups(); } if (event.key === NOTIFICATIONS_KEY) { loadNotifications(); renderNotifications(); } });
    window.addEventListener('dg:groups-changed', renderGroups);
    window.setInterval(cancelUnderfilledGroups, 30_000);
    void hydrateSupabaseSession();
}

document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (button && handleStaticButtonClick(button, event)) return;
    const target = event.target.closest?.('[data-view-target]');
    if (!target || target.id === 'nav-create') return;
    event.preventDefault();
    setView(target.dataset.viewTarget);
});

document.addEventListener('submit', (event) => {
    if (event.target.id === 'form-login') return login(event);
    if (event.target.id === 'form-signup') return submitSignup(event);
    if (event.target.id === 'form-nickname-setup') return submitNicknameSetup(event);
});

document.addEventListener('DOMContentLoaded', init);
window.openFeedback = openFeedback;
