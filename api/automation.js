import OpenAI from 'openai';
import { observeOpenAI } from '@langfuse/openai';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

const MAX_TEXT = 1200;
const ALLOWED_OPERATIONS = new Set(['safety_review', 'recommend']);
const ALLOWED_DECISIONS = new Set(['approved', 'held', 'manual_review']);

const langfuseProcessor = new LangfuseSpanProcessor({
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || 'production',
    exportMode: 'immediate',
});
const telemetry = new NodeSDK({ spanProcessors: [langfuseProcessor] });
telemetry.start();

function text(value, fallback = '') {
    return String(value ?? fallback).trim().slice(0, MAX_TEXT);
}

function activityForModel(value = {}) {
    return {
        id: text(value.id, ''),
        title: text(value.title),
        purpose: text(value.purpose),
        description: text(value.description),
        location: text(value.location),
        scheduledAt: text(value.scheduledAt),
        participants: Number(value.participants) || 0,
        maxParticipants: Number(value.maxParticipants) || 0,
    };
}

function jsonResponse(res, status, body) {
    res.status(status).json(body);
}

function parseModelJson(response) {
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('empty_model_response');
    try {
        return JSON.parse(content);
    } catch {
        throw new Error('invalid_model_json');
    }
}

function requireEnvironment() {
    const required = ['OPENAI_API_KEY', 'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`missing_environment:${missing.join(',')}`);
}

function safetyMessages(activity) {
    return [
        {
            role: 'system',
            content: `너는 동네 광장의 안전 검토 분류기다. 공개 장소의 건전한 관심사 활동만 approved로 판단한다. 연애·헌팅·성비 선택, 광고·영업·투자·금전 모집, 사기, 괴롭힘·협박·불법 행위, 종교 포교, 개인정보 수집 목적은 held로 판단한다. 표현이 모호하거나 판단할 정보가 부족하면 manual_review로 판단한다. 반드시 JSON만 반환한다: {"decision":"approved|held|manual_review","categories":[],"confidence":"high|medium|low","explanation":"","guidance":"","policyVersion":"safety-v3-langfuse"}`,
        },
        { role: 'user', content: JSON.stringify({ activity }) },
    ];
}

function recommendationMessages(preferences, activities) {
    return [
        {
            role: 'system',
            content: '너는 동네 광장의 활동 추천 분류기다. 입력된 activities 중 실제 id만 최대 3개 추천한다. 존재하지 않는 활동을 만들지 않는다. 관심사·편안함·시간 조건과 활동의 목적·설명을 근거로 이유를 작성한다. 반드시 JSON만 반환한다: {"recommendations":[{"activityId":"","reason":"","fit":0}],"policyVersion":"recommendation-v2-langfuse"}',
        },
        { role: 'user', content: JSON.stringify({ preferences, activities }) },
    ];
}

async function handleSafety(openai, requestId, activity) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: safetyMessages(activity),
    });
    const result = parseModelJson(response);
    const decision = ALLOWED_DECISIONS.has(result.decision) ? result.decision : 'manual_review';
    return {
        requestId,
        decision,
        categories: Array.isArray(result.categories) ? result.categories.slice(0, 5).map((item) => text(item, 'unknown')) : [],
        confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low',
        explanation: text(result.explanation, '검토 결과를 확인해 주세요.'),
        guidance: text(result.guidance),
        policyVersion: text(result.policyVersion, 'safety-v3-langfuse'),
    };
}

async function handleRecommendation(openai, requestId, preferences, activities) {
    const allowedIds = new Set(activities.map((activity) => activity.id).filter(Boolean));
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: recommendationMessages(preferences, activities),
    });
    const result = parseModelJson(response);
    const recommendations = Array.isArray(result.recommendations)
        ? result.recommendations.map((item) => ({
            activityId: text(item?.activityId || item?.id),
            reason: text(item?.reason),
            fit: Math.max(0, Math.min(1, Number(item?.fit) || 0)),
        })).filter((item) => allowedIds.has(item.activityId) && item.reason).slice(0, 3)
        : [];
    return { requestId, recommendations, policyVersion: text(result.policyVersion, 'recommendation-v2-langfuse') };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method_not_allowed' });

    let requestId = 'unknown';
    try {
        requireEnvironment();
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const operation = text(body.operation);
        requestId = text(body.requestId, crypto.randomUUID());
        if (!ALLOWED_OPERATIONS.has(operation)) return jsonResponse(res, 400, { error: 'unsupported_operation', requestId });

        const baseClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const openai = observeOpenAI(baseClient, {
            generationName: operation,
            traceName: `dongne-gwangjang-${operation}`,
            metadata: { requestId, policyVersion: operation === 'safety_review' ? 'safety-v3-langfuse' : 'recommendation-v2-langfuse' },
            tags: ['dongne-gwangjang', operation, process.env.LANGFUSE_TRACING_ENVIRONMENT || 'production'],
        });

        if (operation === 'safety_review') {
            const activity = activityForModel(body.activity);
            if (!activity.title || !activity.purpose || !activity.description || !activity.location) return jsonResponse(res, 400, { error: 'missing_activity_fields', requestId });
            return jsonResponse(res, 200, await handleSafety(openai, requestId, activity));
        }

        const activities = Array.isArray(body.activities) ? body.activities.slice(0, 50).map(activityForModel) : [];
        if (!activities.length) return jsonResponse(res, 400, { error: 'missing_activities', requestId });
        return jsonResponse(res, 200, await handleRecommendation(openai, requestId, body.preferences || {}, activities));
    } catch (error) {
        console.error('automation_failed', { requestId, message: error instanceof Error ? error.message : 'unknown_error' });
        return jsonResponse(res, 503, { error: 'automation_unavailable', requestId });
    } finally {
        await langfuseProcessor.forceFlush().catch(() => {});
    }
}
