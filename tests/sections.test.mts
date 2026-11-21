import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChangeSet, Text } from '@codemirror/state';
import { changesWithin, findSection, mapSection, sectionAncestors } from '../src/sections.ts';

const markdown = (text: string) => Text.of(text.split('\n'));

test('an ATX heading includes lower headings and stops before its next peer', () => {
	const doc = markdown('# A\nBody\n\n## Child\n- bullet\n\n# B\nOutside');
	const a = findSection(doc, 0);
	assert.equal(a?.label, 'A');
	assert.equal(doc.sliceString(a!.from, a!.to), '# A\nBody\n\n## Child\n- bullet');
	assert.equal(findSection(doc, doc.line(7).from)?.label, 'B');
});

test('a bullet includes continuation paragraphs, images and fenced code', () => {
	const doc = markdown([
		'- Summary',
		'  Paragraph one.',
		'',
		'  Second paragraph ![[image.png]]',
		'',
		'  - Nested',
		'',
		'  ```markdown',
		'  - Example, not a node',
		'  ```',
		'- Summary',
		'  Next branch',
	].join('\n'));
	const first = findSection(doc, 0)!;
	const second = findSection(doc, doc.line(11).from)!;
	assert.equal(first.label, second.label);
	assert.notEqual(first.from, second.from);
	assert.equal(first.to, doc.line(10).to);
	assert.equal(findSection(doc, doc.line(9).from, true), undefined);
	assert.equal(findSection(doc, doc.line(4).from)?.from, first.from);
	assert.equal(findSection(doc, doc.line(6).from)?.label, 'Nested');
});

test('frontmatter cannot become a heading or bullet target', () => {
	const doc = markdown('---\n# comment\n- value\n---\n\n# Real heading\nBody');
	assert.equal(findSection(doc, doc.line(2).from, true), undefined);
	assert.equal(findSection(doc, doc.line(3).from, true), undefined);
	assert.equal(findSection(doc, doc.line(6).from)?.label, 'Real heading');
});

test('renaming a node updates the Section and inserts above it shift the identity', () => {
	const doc = markdown('# One\nBody\n# Two\nBody');
	const target = findSection(doc, doc.line(3).from)!;
	const changes = ChangeSet.of([
		{ from: 0, insert: 'Introduction\n' },
		{ from: doc.line(3).from + 2, to: doc.line(3).to, insert: 'Renamed' },
	], doc.length);
	const next = mapSection(target, changes, doc, changes.apply(doc));
	assert.equal(next?.line, 4);
	assert.equal(next?.label, 'Renamed');
});

test('deleting a node cannot silently reuse the next identically named node', () => {
	const doc = markdown('- Same\n  First\n- Same\n  Other');
	const target = findSection(doc, 0)!;
	const changes = ChangeSet.of({ from: 0, to: doc.line(3).from }, doc.length);
	assert.equal(mapSection(target, changes, doc, changes.apply(doc)), undefined);
});

test('the edit guard accepts content edits and rejects any boundary crossing', () => {
	const doc = markdown('# Before\nbody\n# Target\nvisible\n# After\nhidden');
	const section = findSection(doc, doc.line(3).from)!;
	const check = (change: { from: number; to?: number; insert?: string }) => changesWithin(section, ChangeSet.of(change, doc.length));
	assert.equal(check({ from: section.from, to: section.to }), true);
	assert.equal(check({ from: section.to, insert: '!' }), true);
	assert.equal(check({ from: section.from - 1, to: section.from }), false);
	assert.equal(check({ from: section.to, to: section.to + 1 }), false);
});

test('breadcrumbs follow heading and bullet ancestry and avoid same-named siblings', () => {
	const doc = markdown('# Main\n### Child heading\n- Parent\n  - Leaf\n    - Deep\n- Parent\n  - Leaf');
	const first = findSection(doc, doc.line(5).from)!;
	const second = findSection(doc, doc.line(7).from)!;
	assert.deepEqual(sectionAncestors(doc, first).map(s => s.label), ['Main', 'Child heading', 'Parent', 'Leaf']);
	assert.deepEqual(sectionAncestors(doc, second).map(s => [s.label, s.line]), [['Main', 1], ['Child heading', 2], ['Parent', 6]]);
});

test('Obsidian comments do not become nodes or split real sections', () => {
	const doc = markdown([
		'# A %% hide label %%', 'Before', '%%', '# Fake', '- Fake bullet', '%%', 'After', '# B',
	].join('\n'));
	const a = findSection(doc, 0)!;
	assert.equal(a.label, 'A');
	assert.equal(a.to, doc.line(7).to);
	assert.equal(findSection(doc, doc.line(4).from, true), undefined);
	assert.equal(findSection(doc, doc.line(5).from, true), undefined);
	assert.equal(findSection(doc, doc.line(8).from, true)?.label, 'B');
});

test('literal percent marks in Markdown code cannot start a comment', () => {
	const doc = markdown([
		'# A', 'Inline \`%%\` literal.', '\`\`\`md', '%%', '# Code heading', '\`\`\`', '# B', 'text', '# C',
	].join('\n'));
	assert.equal(findSection(doc, doc.line(7).from, true)?.label, 'B');
	assert.equal(findSection(doc, doc.line(5).from, true), undefined);
	assert.equal(findSection(doc, doc.line(9).from, true)?.label, 'C');
});

test('compact nested bullets share the outer entry for their physical line', () => {
	const doc = markdown('# A\n- - Compact child\n    - Another item\n- Neighbor');
	const section = findSection(doc, doc.line(2).from + 2, true)!;
	assert.equal(section.label, '- Compact child');
	assert.equal(section.to, doc.line(3).to);
	const nested = findSection(doc, doc.line(3).from, true)!;
	assert.deepEqual(sectionAncestors(doc, nested).map(s => s.line), [1, 2]);
});
