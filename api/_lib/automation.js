'use strict';

const { randomUUID } = require('node:crypto');

const POLICY_VERSIONS = {
    safety: 'safety-v3-code-agent',
    recommendation: 'recommendation-rag-v1'
};

const ALLOWED_OPERATIONS = new Set(['safety_review', 'recommend']);
const ALLOWED_DECISIONS = new Set(['approved', 'held', 'manual_review', 'unavailable']);
const ALLOWED_CONFIDENCE = new Set(['high', 'medium', 'low']);
const ALLOWED_SAFETY_CATEGORIES = new Set([
    'dating', 'sales', 'scam', 'investment', 'proselytizing',
    'harassment', 'risky_goods', 'recruitment', 'privacy',
    'prompt_injection', 'context_unclear'
]);

const INJECTION_PATTERNS = [
    /ignore\s+(all|previous|earlier)\s+instructions/i,
    /시스템\s*프롬프트|규칙을\s*무시|이전\s*지시를\s*무시/i,
    /api\s*key|비밀\s*키|토큰을\s*알려/i
];

const SAFETY_RULES = [
    {
        category: 'dating',
        terms: ['성비', '헌팅', '연애', '훈남훈녀', '남녀모집', '소개팅', '썸', '애인', '이성만', '남자만', '여자만'],
        guidance: '성별이나 연애 목적이 아닌 활동 중심으로 내용을 수정해 주세요.'
    },
    {
        category: 'sales',
        terms: ['다단계', '영업', '광고', '재테크설명회', '제품소개', '판매', '홍보', '구매유도', '수익보장', '투자', '권유'],
        guidance: '판매, 홍보, 모집, 투자 권유 표현을 제거해 주세요.'
    },
    {
        category: 'scam',
        terms: ['원금보장', '고수익', '비밀투자', '송금', '대출알선', '수익인증', '개인정보거래'],
        guidance: '금전 거래, 투자 권유, 송금 요청은 허용되지 않습니다.'
    },
    {
        category: 'proselytizing',
        terms: ['포교', '교회말씀공부', '말씀공부', '심리테스트해드려요', '종교전파', '기도모임', '교회'],
        guidance: '특정 종교나 신념을 전파하는 목적은 허용되지 않습니다.'
    },
    {
        category: 'harassment',
        terms: ['괴롭힘', '협박', '불법촬영', '신상털기', '몰래촬영', '스토킹'],
        guidance: '타인을 위협하거나 침해하는 내용을 제거해 주세요.'
    },
    {
        category: 'risky_goods',
        terms: ['담배사주', '담배구해', '담배대리', 'ㄷㅂ사주', '술사주', '주류구매', '약물', '마약', '대리구매'],
        guidance: '담배·주류·약물의 구매, 대리구매, 거래를 목적으로 하는 활동은 허용되지 않습니다.'
    },
    {
        category: 'recruitment',
        terms: ['가입비', '회원모집', '팀원모집', '부업', '설문조사'],
        guidance: '서비스와 무관한 모집·가입·홍보 목적을 제거해 주세요.'
    }
];

const AMBIGUOUS_RULES = [
    { category: 'context_unclear', terms: ['좋은분들만', '비밀스럽게', '조건맞는분', '자연스럽게친해져요', '특별한만남'], guidance: '활동 내용과 참여 조건을 구체적으로 공개된 장소 중심으로 작성해 주세요.' },
    { category: 'context_unclear', terms: ['ㄷㅂ', 'ㅅㅅ', '조건만남', '원나잇'], guidance: '우회 표현 대신 활동 목적, 장소, 참여 방법을 구체적으로 작성해 주세요.' }
];

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s_\-.~!@#$%^&*()[\]{}:;,'"\x60/\\|]+/g, '');
}

function maskSensitive(value) {
    return String(value || '')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(/(?:\+?82[- ]?)?0?1[0-9][- ]?\d{3,4}[- ]?\d{4}/g, '[phone]');
}

function containsInjection(value) {
    return INJECTION_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

function createRequestId(value) {
    const requestId = String(value || '').trim();
    return requestId.slice(0, 120) || randomUUID();
}

function validationError(message, field = '') {
    const error = new Error(message);
    error.code = 'invalid_request';
    error.field = field;
    return error;
}

function validateActivity(activity) {
    if (!activity || typeof activity !== 'object' || Array.isArray(activity)) throw validationError('activity is required', 'activity');
    for (const field of ['title', 'purpose', 'description', 'location']) {
        if (!String(activity[field] || '').trim()) throw validationError('missing activity field: ' + field, 'activity.' + field);
    }
    if (String(activity.title).length > 120 || String(activity.purpose).length > 240 || String(activity.description).length > 2000 || String(activity.location).length > 240) {
        throw validationError('activity field is too long', 'activity');
    }
    const activityTextValue = [activity.title, activity.purpose, activity.description, activity.location].join(' ');
    if (maskSensitive(activityTextValue) !== activityTextValue) throw validationError('private contact information is not allowed', 'activity');
    if (activity.maxParticipants !== undefined && (!Number.isInteger(Number(activity.maxParticipants)) || Number(activity.maxParticipants) < 3 || Number(activity.maxParticipants) > 6)) {
        throw validationError('maxParticipants must be between 3 and 6', 'activity.maxParticipants');
    }
    return {
        title: String(activity.title).trim(),
        purpose: String(activity.purpose).trim(),
        description: String(activity.description).trim(),
        location: String(activity.location).trim(),
        scheduledAt: activity.scheduledAt ? String(activity.scheduledAt) : '',
        maxParticipants: activity.maxParticipants === undefined ? 6 : Number(activity.maxParticipants),
        category: activity.category ? String(activity.category) : '',
        conversationLevel: activity.conversationLevel ? String(activity.conversationLevel) : '',
        beginnerFriendly: Boolean(activity.beginnerFriendly),
        durationMinutes: activity.durationMinutes ? Number(activity.durationMinutes) : 0,
        participants: Number(activity.participants || 0),
        status: activity.status ? String(activity.status) : 'recruiting',
        id: activity.id ? String(activity.id) : ''
    };
}

function validatePreferences(preferences) {
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw validationError('preferences are required', 'preferences');
    const comfort = String(preferences.comfort || 'any');
    const timeWindow = String(preferences.timeWindow || 'any');
    if (!['quiet', 'light_conversation', 'active', 'beginner', 'any'].includes(comfort)) throw validationError('unsupported comfort', 'preferences.comfort');
    if (!['today', 'this_week', 'any'].includes(timeWindow)) throw validationError('unsupported timeWindow', 'preferences.timeWindow');
    const interest = String(preferences.interest || '').trim().slice(0, 160);
    if (maskSensitive(interest) !== interest) throw validationError('private contact information is not allowed', 'preferences.interest');
    if (containsInjection(interest)) throw validationError('system instructions are not allowed', 'preferences.interest');
    return { interest, comfort, timeWindow };
}

function validateEnvelope(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw validationError('JSON body is required');
    const operation = String(body.operation || '');
    if (!ALLOWED_OPERATIONS.has(operation)) throw validationError('unsupported operation', 'operation');
    const requestId = createRequestId(body.requestId);
    if (operation === 'safety_review') return { requestId, operation, activity: validateActivity(body.activity) };
    if (!Array.isArray(body.activities)) throw validationError('activities must be an array', 'activities');
    if (body.activities.length > 100) throw validationError('activities must contain at most 100 items', 'activities');
    const activities = body.activities.map(validateActivity);
    if (activities.some((activity) => !activity.id)) throw validationError('every recommendation activity needs an id', 'activities.id');
    return { requestId, operation, activities, preferences: validatePreferences(body.preferences || {}) };
}

function activityText(activity) {
    return [activity.title, activity.purpose, activity.description, activity.category, activity.conversationLevel, activity.beginnerFriendly ? '초보 가능' : '', activity.location, activity.scheduledAt].filter(Boolean).join(' | ');
}

function recommendationQuery(preferences) {
    return [preferences.interest, preferences.comfort, preferences.timeWindow, '부담이 적고 공개된 장소에서 함께하는 건강한 동네 활동'].filter(Boolean).join(' | ');
}

function buildRecommendationDocuments(activities) {
    return activities
        .filter((activity) => activity.status === 'recruiting' && activity.participants < activity.maxParticipants)
        .map((activity) => ({ id: activity.id, text: activityText(activity), activity }));
}

function cosineSimilarity(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) return 0;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        const a = Number(left[index]) || 0;
        const b = Number(right[index]) || 0;
        dot += a * b;
        leftNorm += a * a;
        rightNorm += b * b;
    }
    return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

function metadataBonus(activity, preferences) {
    let bonus = 0;
    if (preferences.comfort === 'quiet' && activity.conversationLevel === 'quiet') bonus += 0.08;
    if (preferences.comfort === 'light_conversation' && activity.conversationLevel === 'light_conversation') bonus += 0.08;
    if (preferences.comfort === 'active' && activity.conversationLevel === 'active') bonus += 0.08;
    if (preferences.comfort === 'beginner' && activity.beginnerFriendly) bonus += 0.08;
    if (preferences.timeWindow === 'any') bonus += 0.03;
    if (preferences.timeWindow === 'today' && activity.scheduledAt && Date.parse(activity.scheduledAt) - Date.now() <= 36 * 60 * 60 * 1000) bonus += 0.08;
    if (preferences.timeWindow === 'this_week' && activity.scheduledAt && Date.parse(activity.scheduledAt) - Date.now() <= 8 * 24 * 60 * 60 * 1000) bonus += 0.08;
    return bonus;
}

function rankRecommendationDocuments(documents, queryVector, documentVectors, preferences, topK = 5) {
    return documents
        .map((document, index) => {
            const similarity = cosineSimilarity(queryVector, documentVectors[index]);
            const fit = Math.max(0, Math.min(1, ((similarity + 1) / 2) * 0.85 + metadataBonus(document.activity, preferences)));
            return Object.assign({}, document, { similarity, fit });
        })
        .sort((left, right) => right.fit - left.fit)
        .slice(0, topK);
}

function deterministicSafetyGate(activity) {
    const rawText = [activity.title, activity.purpose, activity.description, activity.location].join(' ');
    const normalized = normalizeText(rawText);
    if (containsInjection(rawText)) return { state: 'manual_review', category: 'prompt_injection', guidance: '시스템 지시나 비밀정보 요청은 제거하고 활동 목적과 참여 방법만 남겨 주세요.' };
    const preventionContext = /금연|피우지않|하지않|예방|교육|뉴스|상담|비판/.test(normalized);
    for (const rule of SAFETY_RULES) {
        if (rule.terms.some((term) => normalized.includes(normalizeText(term))) && !(preventionContext && rule.category === 'risky_goods')) {
            return { state: 'held', category: rule.category, guidance: rule.guidance };
        }
    }
    for (const rule of AMBIGUOUS_RULES) {
        if (rule.terms.some((term) => normalized.includes(normalizeText(term)))) return { state: 'manual_review', category: rule.category, guidance: rule.guidance };
    }
    return { state: 'safe', category: '', guidance: '' };
}

function safetyPrompt(activity) {
    return [
        '너는 동네 광장의 안전 검토 문맥 분류 Agent다.',
        '이 서비스는 외로움을 줄이고 공개된 장소에서 건전한 관심사 활동으로 사람을 연결한다.',
        '표면 단어만 보지 말고 문맥, 실제 의도, 완곡어법, 초성·자모·띄어쓰기 우회, 은어를 함께 판단한다.',
        '담배·주류·약물 구매/대리구매, 불법·위험 행위, 사기·투자·금전 모집, 성적 만남·조건만남·데이트, 괴롭힘·혐오·협박, 개인정보 수집·거래, 앱 취지와 무관한 모집은 승인하지 않는다.',
        '예방 교육·뉴스·상담·비판적 언급처럼 실제 행위 모집이 아닌 맥락은 구분한다.',
        '애매하거나 정보가 부족하면 approved가 아니라 manual_review를 선택한다.',
        'categories는 dating, sales, scam, investment, proselytizing, harassment, risky_goods, recruitment, privacy, context_unclear 중에서만 고른다. approved이면 categories는 빈 배열이다.',
        'JSON 하나만 반환한다. 키는 decision(approved|held|manual_review), categories(string[]), confidence(high|medium|low), explanation(string), guidance(string)이다.',
        '활동 입력: ' + JSON.stringify({ title: maskSensitive(activity.title), purpose: maskSensitive(activity.purpose), description: maskSensitive(activity.description), location: maskSensitive(activity.location), scheduledAt: activity.scheduledAt, maxParticipants: activity.maxParticipants })
    ].join('\n');
}

function recommendationPrompt(preferences, retrieved) {
    return [
        '너는 동네 광장의 추천 생성 Agent다.',
        '검색된 활동 후보만 사용해 사용자의 관심사와 편안함에 맞는 활동을 최대 3개 추천한다.',
        '검색 후보에 없는 activityId를 만들지 않는다. 이유는 후보 문서의 실제 정보에 근거해 짧고 따뜻하게 작성한다.',
        'JSON 하나만 반환한다. 키는 recommendations([{activityId, reason, fit}]), policyVersion이다. fit은 0과 1 사이 숫자다.',
        '사용자 조건: ' + JSON.stringify(preferences),
        '검색 후보: ' + JSON.stringify(retrieved.map((item) => ({ id: item.id, text: item.text, fit: item.fit, similarity: item.similarity })))
    ].join('\n');
}

function parseJsonObject(value) {
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    const cleaned = value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '');
    try { return JSON.parse(cleaned); } catch { return null; }
}

function sanitizeSafetyResult(value, requestId) {
    const parsed = parseJsonObject(value) || {};
    const mapped = { allow: 'approved', revise: 'held', block: 'held', review: 'manual_review' };
    const decision = mapped[parsed.decision] || parsed.decision;
    const safeDecision = ALLOWED_DECISIONS.has(decision) ? decision : 'manual_review';
    const categories = Array.isArray(parsed.categories)
        ? parsed.categories.map((item) => String(item)).filter((item) => ALLOWED_SAFETY_CATEGORIES.has(item)).slice(0, 5)
        : [];
    return {
        requestId,
        decision: safeDecision,
        categories: safeDecision === 'approved' ? [] : categories,
        confidence: ALLOWED_CONFIDENCE.has(parsed.confidence) ? parsed.confidence : 'low',
        explanation: String(parsed.explanation || '검토 결과를 확인해 주세요.').slice(0, 500),
        guidance: String(parsed.guidance || '내용을 수정하거나 운영자 검토를 요청해 주세요.').slice(0, 500),
        policyVersion: POLICY_VERSIONS.safety
    };
}

function finalizeSafetyResult(result, requestId) {
    const normalized = sanitizeSafetyResult(result, requestId);
    if (normalized.decision === 'approved' && normalized.confidence !== 'high') {
        return Object.assign({}, normalized, { decision: 'manual_review', explanation: '안전하다고 단정하기 어려워 운영자 검토로 전환했습니다.' });
    }
    return normalized;
}

function sanitizeRecommendations(value, allowedIds, requestId, fallback = []) {
    const parsed = parseJsonObject(value) || {};
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const safe = recommendations.map((item) => ({
        activityId: String(item?.activityId || item?.id || ''),
        reason: String(item?.reason || '').slice(0, 500),
        fit: Math.max(0, Math.min(1, Number(item?.fit) || 0))
    })).filter((item) => allowedIds.has(item.activityId) && item.reason).slice(0, 3);
    return {
        requestId,
        recommendations: safe.length ? safe : fallback,
        message: safe.length || fallback.length ? '' : '조건에 맞는 활동이 없습니다. 관심사나 편안한 만남 조건을 조금 넓혀 다시 시도해 주세요.',
        policyVersion: POLICY_VERSIONS.recommendation
    };
}

module.exports = {
    ALLOWED_OPERATIONS,
    POLICY_VERSIONS,
    containsInjection,
    normalizeText,
    maskSensitive,
    validateEnvelope,
    validateActivity,
    validatePreferences,
    activityText,
    recommendationQuery,
    buildRecommendationDocuments,
    cosineSimilarity,
    rankRecommendationDocuments,
    deterministicSafetyGate,
    safetyPrompt,
    recommendationPrompt,
    parseJsonObject,
    sanitizeSafetyResult,
    finalizeSafetyResult,
    sanitizeRecommendations,
    validationError
};
