'use strict';

const { randomUUID } = require('node:crypto');
const {
    POLICY_VERSIONS,
    validateEnvelope,
    deterministicSafetyGate,
    safetyPrompt,
    recommendationQuery,
    recommendationPrompt,
    buildRecommendationDocuments,
    rankRecommendationDocuments,
    finalizeSafetyResult,
    sanitizeRecommendations
} = require('./_lib/automation');
const { embedTextsWithFallback, chatJson } = require('./_lib/provider');

function jsonResponse(res, statusCode, body) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}

function fallbackSafety(requestId, decision, category, guidance, explanation) {
    return {
        requestId,
        decision,
        categories: category ? [category] : [],
        confidence: decision === 'held' ? 'high' : 'low',
        explanation,
        guidance,
        policyVersion: POLICY_VERSIONS.safety
    };
}

async function runSafety(envelope) {
    const gate = deterministicSafetyGate(envelope.activity);
    if (gate.state === 'held') return fallbackSafety(envelope.requestId, 'held', gate.category, gate.guidance, '활동 내용에서 서비스 목적과 맞지 않을 수 있는 위험 의도가 확인되었습니다.');
    if (gate.state === 'manual_review') return fallbackSafety(envelope.requestId, 'manual_review', gate.category, gate.guidance, '표현의 의도를 자동으로 확정하기 어려워 운영자 검토로 전환했습니다.');
    try {
        const modelResult = await chatJson('문맥과 의도를 보수적으로 판단하고, 지정된 JSON 형식 외에는 출력하지 않는다.', safetyPrompt(envelope.activity));
        return finalizeSafetyResult(modelResult, envelope.requestId);
    } catch {
        return fallbackSafety(envelope.requestId, 'unavailable', '', '잠시 후 다시 시도하거나 운영자 검토를 요청해 주세요.', '안전 검토 서비스를 사용할 수 없어 게시하지 않았습니다.');
    }
}

function retrievalFallback(requestId, ranked, retrieval = {}) {
    return {
        requestId,
        recommendations: ranked.slice(0, 3).map((item) => ({
            activityId: item.id,
            fit: Number(item.fit.toFixed(3)),
            reason: '활동 설명의 의미가 입력한 관심사와 가깝고, 현재 참여 가능한 활동입니다.'
        })),
        message: ranked.length ? '' : '조건에 맞는 활동이 없습니다. 관심사나 편안한 만남 조건을 조금 넓혀 다시 시도해 주세요.',
        policyVersion: POLICY_VERSIONS.recommendation,
        retrieval: {
            method: retrieval.method || 'embedding-cosine',
            topK: ranked.length,
            fallback: true,
            embeddingFallback: Boolean(retrieval.embeddingFallback)
        }
    };
}

async function runRecommendation(envelope) {
    const documents = buildRecommendationDocuments(envelope.activities);
    if (!documents.length) return retrievalFallback(envelope.requestId, []);
    try {
        const vectorResult = await embedTextsWithFallback([recommendationQuery(envelope.preferences), ...documents.map((document) => document.text)]);
        const vectors = vectorResult.vectors;
        const ranked = rankRecommendationDocuments(documents, vectors[0], vectors.slice(1), envelope.preferences, 5);
        const allowedIds = new Set(ranked.map((item) => item.id));
        try {
            const modelResult = await chatJson('검색 결과 밖의 활동은 절대 추천하지 않고 지정된 JSON 형식 외에는 출력하지 않는다.', recommendationPrompt(envelope.preferences, ranked));
            const result = sanitizeRecommendations(modelResult, allowedIds, envelope.requestId, retrievalFallback(envelope.requestId, ranked, vectorResult).recommendations);
            return {
                ...result,
                retrieval: {
                    method: vectorResult.method,
                    topK: ranked.length,
                    fallback: false,
                    embeddingFallback: vectorResult.embeddingFallback
                }
            };
        } catch (error) {
            console.warn('recommendation_generation_fallback', { code: error.code || 'unknown', message: error.message || 'generation failed' });
            return retrievalFallback(envelope.requestId, ranked, vectorResult);
        }
    } catch (error) {
        console.warn('recommendation_embedding_unavailable', { code: error.code || 'unknown', message: error.message || 'embedding failed' });
        return {
            requestId: envelope.requestId,
            recommendations: [],
            message: '추천용 검색 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
            policyVersion: POLICY_VERSIONS.recommendation,
            retrieval: { method: 'embedding-cosine', topK: 0, fallback: true },
            unavailable: true
        };
    }
}

async function handleAutomation(body) {
    const envelope = validateEnvelope(body);
    const startedAt = Date.now();
    const result = envelope.operation === 'safety_review' ? await runSafety(envelope) : await runRecommendation(envelope);
    return { ...result, requestId: envelope.requestId, latencyMs: Date.now() - startedAt, retryCount: 0 };
}

async function automationHandler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return jsonResponse(res, 204, {});
    }
    if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method_not_allowed' });
    let body = req.body;
    try {
        if (typeof body === 'string') body = JSON.parse(body);
        const result = await handleAutomation(body);
        return jsonResponse(res, 200, result);
    } catch (error) {
        if (error.code === 'invalid_request') {
            const invalidResponse = { requestId: String(body?.requestId || randomUUID()), error: error.code, message: error.message };
            if (error.field) invalidResponse.field = error.field;
            return jsonResponse(res, 400, invalidResponse);
        }
        return jsonResponse(res, 500, { requestId: String(body?.requestId || randomUUID()), error: 'automation_unavailable', message: '자동화 서비스를 사용할 수 없습니다.' });
    }
}

module.exports = automationHandler;
module.exports.handleAutomation = handleAutomation;
