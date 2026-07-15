import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const exampleSection = source.slice(source.indexOf('const ACTIVITY_EXAMPLES'), source.indexOf('function activityFamilyForType'));
assert.doesNotMatch(exampleSection, /temperature:/);
assert.match(html, /<details class="activity-examples-reference">/);
assert.doesNotMatch(html, /<details class="activity-examples-reference" open>/);
const families = [...exampleSection.matchAll(/family: '([^']+)'/g)].map((match) => match[1]);
for (const family of ['study', 'hobby', 'sports', 'social', 'game', 'culture', 'community', 'project', 'other']) {
    assert.equal(families.filter((value) => value === family).length, 2, `${family} needs two example cards`);
}
assert.doesNotMatch(source.slice(source.indexOf('function renderGroups'), source.indexOf('function renderBoard')), /중심 모임/);
assert.doesNotMatch(source.slice(source.indexOf('function renderGroups'), source.indexOf('function renderBoard')), /초보 참여 가능/);
assert.match(source.slice(source.indexOf('function openActivityRoom'), source.indexOf('function closeActivityRoom')), /closeNotifications\(\)/);
assert.match(source.slice(source.indexOf('function openActivityRoom'), source.indexOf('function closeActivityRoom')), /notificationModal\.classList\.add\('hidden'\)/);
assert.match(source.slice(source.indexOf('function openActivityRoom'), source.indexOf('function closeActivityRoom')), /activityRoomModal\.setAttribute\('aria-hidden', 'false'\)/);
assert.match(source.slice(source.indexOf('function openActivityRoom'), source.indexOf('function closeActivityRoom')), /openLogin\(\)/);
assert.match(source.slice(source.indexOf('async function toggleParticipation'), source.indexOf('function reportActivity')), /openLogin\(\)/);
assert.doesNotMatch(source.slice(source.indexOf('function renderGroups'), source.indexOf('function renderBoard')), /room\.disabled =/);
assert.match(html, /id="modal-report"/);
assert.match(html, /id="form-report"/);
assert.match(html, /id="btn-submit-report"[^>]*>신고 완료<\/button>/);
assert.match(source, /신고가 완료되었습니다/);
for (const tab of ['joined', 'created', 'past']) assert.match(html, new RegExp(`data-history-tab="${tab}"`));
assert.match(html, /id="history-joined-list"/);
assert.match(html, /id="history-created-list"/);
assert.match(html, /id="history-past-list"/);
assert.doesNotMatch(html, /HOW IT FEELS/);
assert.doesNotMatch(html, /id="btn-create-main"/);
assert.doesNotMatch(source, /btn-create-main/);
assert.doesNotMatch(html, /id="btn-create"/);
assert.doesNotMatch(source, /'btn-create':/);
const historySource = source.slice(source.indexOf('function renderHistoryGroupList'), source.indexOf('function renderCategoryOptions'));
assert.match(historySource, /참여 취소/);
assert.doesNotMatch(historySource, /활동 상세 보기/);
const activityTypes = source.slice(source.indexOf('const ACTIVITY_TYPES'), source.indexOf('const ACTIVITY_FAMILIES'));
const requestedTypes = ['공부·자기계발', '취미', '운동', '친목', '게임', '문화생활', '봉사·사회활동', '프로젝트', '기타'];
assert.equal([...activityTypes.matchAll(/'([^']+)'/g)].length, requestedTypes.length);
for (const type of requestedTypes) assert.match(activityTypes, new RegExp(type));
assert.match(html, /<option value="mine" selected>내 연령대<\/option>/);
assert.match(html, /<option value="all">전체 연령대<\/option>/);
assert.doesNotMatch(html, /20대 중심|30대 중심|40대 중심|50대 이상 중심/);
assert.match(source, /function setupParticipantLimitInput/);
assert.match(source, /value === 'custom'/);
assert.match(source, /Number\(\$\('input-limit-custom'\)\?\.value\)/);
assert.match(source, /function removeBeginnerGuidance/);
assert.match(source, /beginnerFriendly: true/);

console.log(JSON.stringify({ passed: true, suite: 'activity-examples', checks: 47 }));
