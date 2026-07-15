'use strict';

const OPENAI_URL = 'https://api.openai.com/v1';
const SEMANTIC_DIMENSIONS = [
    'learning', 'reading', 'language', 'technology',
    'exercise', 'outdoor', 'arts', 'games',
    'culture', 'food_and_social', 'volunteering', 'project',
    'quiet', 'light_conversation', 'active', 'beginner_friendly'
];

function providerError(message, code = 'provider_unavailable') {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function openAiRequest(path, body, timeoutMs = 15000) {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) throw providerError('OPENAI_API_KEY is not configured', 'provider_not_configured');
    if (typeof fetch !== 'function') throw providerError('fetch is not available', 'provider_unavailable');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(OPENAI_URL + path, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        if (!response.ok) throw providerError('provider returned ' + response.status);
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') throw providerError('provider request timed out', 'provider_timeout');
        if (error.code && error.code.startsWith('provider_')) throw error;
        throw providerError('provider request failed');
    } finally {
        clearTimeout(timeout);
    }
}

async function embedTexts(texts) {
    const result = await openAiRequest('/embeddings', {
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float'
    }, 15000);
    const vectors = Array.isArray(result?.data)
        ? result.data.slice().sort((left, right) => Number(left.index) - Number(right.index)).map((item) => item.embedding)
        : [];
    if (vectors.length !== texts.length || vectors.some((vector) => !Array.isArray(vector) || vector.length === 0)) {
        throw providerError('invalid embedding response', 'provider_invalid_response');
    }
    return vectors;
}

async function chatJson(systemPrompt, userPrompt) {
    const result = await openAiRequest('/chat/completions', {
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    }, 15000);
    const content = result?.choices?.[0]?.message?.content;
    if (!content) throw providerError('empty model response', 'provider_invalid_response');
    return content;
}

async function semanticFeatureVectors(texts) {
    const vectors = [];
    const batchSize = 12;
    for (let offset = 0; offset < texts.length; offset += batchSize) {
        const batch = texts.slice(offset, offset + batchSize).map((text) => String(text).slice(0, 1000));
        const content = await chatJson(
            '텍스트를 고정된 의미 축의 0~1 숫자 벡터로 변환한다. 설명이나 마크다운 없이 JSON만 반환한다.',
            [
                '각 텍스트를 다음 순서의 의미 축으로 평가하세요.',
                JSON.stringify(SEMANTIC_DIMENSIONS),
                '각 값은 0과 1 사이 숫자이며 모든 벡터 길이는 정확히 ' + SEMANTIC_DIMENSIONS.length + '이어야 합니다.',
                '입력 순서를 유지하고 JSON 형식 {"vectors":[number[]]}만 반환하세요.',
                '텍스트: ' + JSON.stringify(batch)
            ].join('\n')
        );
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw providerError('invalid semantic vector response', 'provider_invalid_response');
        }
        if (!Array.isArray(parsed?.vectors) || parsed.vectors.length !== batch.length) {
            throw providerError('invalid semantic vector count', 'provider_invalid_response');
        }
        for (const vector of parsed.vectors) {
            if (!Array.isArray(vector) || vector.length !== SEMANTIC_DIMENSIONS.length || vector.some((value) => !Number.isFinite(Number(value)))) {
                throw providerError('invalid semantic vector shape', 'provider_invalid_response');
            }
            vectors.push(vector.map((value) => Math.max(0, Math.min(1, Number(value)))));
        }
    }
    return vectors;
}

async function embedTextsWithFallback(texts) {
    try {
        return { vectors: await embedTexts(texts), method: 'embedding-cosine', embeddingFallback: false };
    } catch (embeddingError) {
        const vectors = await semanticFeatureVectors(texts);
        return {
            vectors,
            method: 'semantic-vector-cosine',
            embeddingFallback: true,
            fallbackReason: embeddingError.message || 'embedding unavailable'
        };
    }
}

module.exports = {
    openAiRequest,
    embedTexts,
    embedTextsWithFallback,
    semanticFeatureVectors,
    chatJson,
    providerError,
    SEMANTIC_DIMENSIONS
};
