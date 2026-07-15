import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const exampleSection = source.slice(source.indexOf('const ACTIVITY_EXAMPLES'), source.indexOf('function activityFamilyForType'));
const temperatures = [...exampleSection.matchAll(/temperature: (\d+)/g)].map((match) => Number(match[1]));

assert.equal(temperatures.length, 12);
assert.ok(new Set(temperatures).size > 6, 'example temperatures must vary');
assert.doesNotMatch(source.slice(source.indexOf('function renderGroups'), source.indexOf('function renderBoard')), /중심 모임/);
assert.match(source.slice(source.indexOf('function openActivityRoom'), source.indexOf('function closeActivityRoom')), /closeNotifications\(\)/);
assert.match(html, /id="modal-report"/);
assert.match(html, /id="form-report"/);
assert.match(source, /신고가 완료되었습니다/);

console.log(JSON.stringify({ passed: true, suite: 'activity-examples', checks: 7 }));
