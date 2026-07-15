import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} is missing`);
    const end = source.indexOf('\n}', start);
    assert.notEqual(end, -1, `${name} is incomplete`);
    return source.slice(start, end + 2);
}

const filterFunctions = `${extractFunction('normalizeActivityAgeGroup')}\n${extractFunction('ageFilterMatchesGroup')}`;
const { ageFilterMatchesGroup } = new Function(`${filterFunctions}; return { ageFilterMatchesGroup };`)();

// 정상: 전체 연령 필터에는 전 연령 공개 모임만 남는다.
assert.equal(ageFilterMatchesGroup('all', 'all', '20s'), true);
assert.equal(ageFilterMatchesGroup('20s', 'all', '20s'), false);

// 정상/거절: 내 연령대만은 로그인 사용자의 정확한 연령대만 남긴다.
assert.equal(ageFilterMatchesGroup('20s', 'mine', '20s'), true);
assert.equal(ageFilterMatchesGroup('all', 'mine', '20s'), false);
assert.equal(ageFilterMatchesGroup('30s', 'mine', '20s'), false);
assert.equal(ageFilterMatchesGroup('20s', 'mine', 'all'), false);

assert.match(source, /id: 'other', label: '기타'/);
assert.doesNotMatch(source, /id: 'experience', label: '체험형'/);
assert.match(source, /isAvailableForDiscovery\(group\)/);

console.log(JSON.stringify({ passed: true, suite: 'activity-filter', checks: 11 }));
