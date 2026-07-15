import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

assert.doesNotMatch(html, /id="btn-recommendation-hero"/);
assert.doesNotMatch(html, /class="nav-tab" type="button" data-view-target="recommendation"/);
assert.doesNotMatch(source.slice(source.indexOf('function viewFromLocation'), source.indexOf('function setView')), /'recommendation'/);
assert.match(source, /const requestedRecommendation = view === 'recommendation';/);
assert.match(source, /elements\.recommendationDock\.open = requestedRecommendation/);

console.log(JSON.stringify({ passed: true, suite: 'recommendation-route', checks: 5 }));
