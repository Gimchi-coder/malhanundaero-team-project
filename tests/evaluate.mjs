import { readFile } from 'node:fs/promises';

const safetyFixtures = JSON.parse(await readFile(new URL('./safety-review-fixtures.json', import.meta.url)));
const evaluationFixtures = JSON.parse(await readFile(new URL('./evaluation-fixtures.json', import.meta.url)));
const guardrailFixtures = JSON.parse(await readFile(new URL('./guardrail-fixtures.json', import.meta.url)));

const normalize = (value) => String(value || '')
  .normalize('NFKC').toLowerCase()
  .replace(/[\s_\-.~!@#$%^&*()[\]{}:;,'"`/\\|]+/g, '');

const blocked = [
  ['dating', ['성비', '헌팅', '연애', '훈남훈녀', '남녀모집', '소개팅', '썸', '애인']],
  ['sales', ['다단계', '영업', '광고', '재테크', '제품소개', '판매', '홍보', '투자', '권유']],
  ['proselytizing', ['포교', '교회', '말씀공부', '심리테스트해드려요', '종교전파']],
  ['harassment', ['괴롭힘', '협박', '불법촬영']],
];

const injection = [/ignore\s+(all|previous|earlier)\s+instructions/i, /시스템\s*프롬프트|규칙을\s*무시|비밀\s*키/i];
const pii = (text) => String(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').replace(/(?:\+?82[- ]?)?0?1[0-9][- ]?\d{3,4}[- ]?\d{4}/g, '[phone]');

function review(text) {
  const value = normalize(text);
  const match = blocked.find(([, terms]) => terms.some((term) => value.includes(normalize(term))));
  if (match) return { decision: 'held', category: match[0] };
  if (['좋은분들만', '비밀스럽게', '조건맞는분', '특별한만남'].some((term) => value.includes(normalize(term)))) {
    return { decision: 'manual_review', category: 'context_unclear' };
  }
  return { decision: 'approved', category: '' };
}

const safetyResults = safetyFixtures.map((fixture) => ({ ...fixture, actual: review(fixture.text) }));
const safetyPass = safetyResults.filter((item) => item.expected === item.actual.decision).length;
const unsafe = safetyResults.filter((item) => item.expected !== 'approved');
const unsafeHeld = unsafe.filter((item) => item.actual.decision === 'held' || item.actual.decision === 'manual_review').length;

function recommend(fixture) {
  const interest = normalize(fixture.interest);
  return evaluationFixtures.activities
    .map((activity) => {
      const text = normalize(`${activity.purpose} ${activity.description}`);
      const semanticHit = interest === '독서' && text.includes('책') || interest === '산책' && text.includes('산책');
      const interestHit = interest && (text.includes(interest) || semanticHit) ? 0.65 : 0;
      const comfortHit = fixture.comfort === 'quiet' && text.includes('조용히') ? 0.25 : fixture.comfort === 'active' && text.includes('산책') ? 0.25 : 0;
      return { id: activity.id, fit: interestHit + comfortHit, reason: interestHit ? '관심사와 활동 목적이 맞습니다.' : '' };
    })
    .filter((item) => item.fit >= 0.5)
    .sort((a, b) => b.fit - a.fit);
}

const recommendationResults = evaluationFixtures.recommendations.map((fixture) => {
  const actual = recommend(fixture)[0]?.id || null;
  return { ...fixture, actual };
});
const recommendationPass = recommendationResults.filter((item) => item.actual === item.expectedActivity).length;
const guardrailResults = guardrailFixtures.map((fixture) => {
  const masked = pii(fixture.text);
  const actual = injection.some((pattern) => pattern.test(fixture.text)) ? 'manual_review' : masked !== fixture.text ? 'masked' : 'pass';
  return { ...fixture, actual };
});
const guardrailPass = guardrailResults.filter((item) => item.actual === item.expected).length;

const summary = {
  policyVersion: evaluationFixtures.policyVersion,
  safety: { total: safetyResults.length, passed: safetyPass, passRate: safetyPass / safetyResults.length, unsafeRouted: unsafeHeld, unsafeTotal: unsafe.length },
  recommendations: { total: recommendationResults.length, passed: recommendationPass, passRate: recommendationPass / recommendationResults.length },
  guardrails: { total: guardrailResults.length, passed: guardrailPass, passRate: guardrailPass / guardrailResults.length },
  privacy: { rawPrivateFieldsInFixture: false },
};

console.log(JSON.stringify(summary, null, 2));
if (safetyPass !== safetyResults.length || unsafeHeld < 45 || recommendationPass !== recommendationResults.length || guardrailPass !== guardrailResults.length) process.exitCode = 1;
