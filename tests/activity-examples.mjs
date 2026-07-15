import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const exampleSection = source.slice(source.indexOf('const ACTIVITY_EXAMPLES'), source.indexOf('function activityFamilyForType'));
assert.doesNotMatch(exampleSection, /temperature:/);
const families = [...exampleSection.matchAll(/family: '([^']+)'/g)].map((match) => match[1]);
for (const family of ['study', 'hobby', 'sports', 'social', 'game', 'culture', 'community', 'project', 'other']) {
    assert.equal(families.filter((value) => value === family).length, 2, `${family} needs two example cards`);
}
assert.doesNotMatch(source.slice(source.indexOf('function renderGroups'), source.indexOf('function renderBoard')), /중심 모임/);
assert.match(source.slice(source.indexOf('function openActivityRoom'), source.indexOf('function closeActivityRoom')), /closeNotifications\(\)/);
assert.match(html, /id="modal-report"/);
assert.match(html, /id="form-report"/);
assert.match(source, /신고가 완료되었습니다/);

console.log(JSON.stringify({ passed: true, suite: 'activity-examples', checks: 15 }));
