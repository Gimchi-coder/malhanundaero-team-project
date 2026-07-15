import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handleAutomation } = require('../api/automation.js');

process.env.OPENAI_API_KEY = 'test-only';
let chatCalls = 0;
let retrievalPrompt = '';

global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/embeddings')) return { ok: false, status: 403, json: async () => ({}) };
    chatCalls += 1;
    const prompt = body.messages?.[1]?.content || '';
    if (prompt.includes('"vectors"')) {
        retrievalPrompt = prompt;
        return {
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            vectors: [
                                [0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 1, 0.2, 0.1, 1],
                                [0.9, 1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 1, 0.2, 0.1, 1],
                                [0.1, 0.1, 0.1, 0.1, 1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 1, 0.1]
                            ]
                        })
                    }
                }]
            })
        };
    }
    return {
        ok: true,
        json: async () => ({
            choices: [{
                message: {
                    content: JSON.stringify({
                        recommendations: [{ activityId: 'book', reason: '조용히 책을 읽는 조건과 맞아요.', fit: 0.95 }],
                        policyVersion: 'test'
                    })
                }
            }]
        })
    };
};

const result = await handleAutomation({
    operation: 'recommend',
    requestId: 'fallback-test',
    preferences: { interest: '책 읽기', comfort: 'quiet', timeWindow: 'any', historyContext: '공부·자기계발: 퇴근 후 조용한 독서 · 편안하게 참여함', historyCount: 12 },
    activities: [
        { id: 'book', title: '독서', purpose: '조용히 책 읽기', description: '처음 참여 가능', location: '도서관', maxParticipants: 5, participants: 1, status: 'recruiting', conversationLevel: 'quiet', beginnerFriendly: true },
        { id: 'run', title: '러닝', purpose: '빠르게 달리기', description: '경험자 러닝', location: '공원', maxParticipants: 5, participants: 1, status: 'recruiting', conversationLevel: 'active', beginnerFriendly: false }
    ]
});

assert.equal(result.recommendations[0].activityId, 'book');
assert.equal(result.recommendations.length, 2);
assert.equal(result.retrieval.method, 'semantic-vector-cosine');
assert.equal(result.retrieval.embeddingFallback, true);
assert.equal(chatCalls, 2);
assert.match(retrievalPrompt, /이전 참여 이력: 공부·자기계발: 퇴근 후 조용한 독서/);

console.log(JSON.stringify({ passed: true, suite: 'provider-fallback', checks: 5 }));
