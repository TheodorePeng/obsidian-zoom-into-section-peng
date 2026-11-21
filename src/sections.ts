import { parser } from '@lezer/markdown';
import type { SyntaxNode } from '@lezer/common';
import type { ChangeDesc, Text } from '@codemirror/state';

export interface Section {
	from: number;
	to: number;
	line: number;
	kind: 'heading' | 'bullet';
	label: string;
}

const headings = /^ATXHeading([1-6])$/;
const sectionsByDocument = new WeakMap<Text, Section[]>();

function headingLevel(node: SyntaxNode): number {
	return Number(headings.exec(node.name)?.[1]) || 0;
}

function contentEnd(node: SyntaxNode, text: string): number {
	let end = node.to;
	while (end > node.from && text[end - 1] === '\n') end--;
	return end;
}

function frontmatterEnd(doc: Text): number {
	if (doc.line(1).text.trim() !== '---') return 0;
	for (let number = 2; number <= doc.lines; number++) {
		const line = doc.line(number);
		if (/^(?:---|\.\.\.)\s*$/.test(line.text)) return line.to;
	}
	return 0;
}

function withoutComments(text: string, firstContent: number): string {
	if (!text.includes('%%')) return text;

	const codeSpans: { from: number; to: number }[] = [];
	parser.parse(text).iterate({
		enter(node) {
			if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'InlineCode') {
				codeSpans.push({ from: node.from, to: node.to });
				return false;
			}
			return undefined;
		},
	});

	const parts: string[] = [];
	let from = 0;
	let opening = -1;
	let codeIndex = 0;
	for (const match of text.matchAll(/%%/g)) {
		const index = match.index;
		if (index < firstContent) continue;
		let preceding = index - 1;
		while (preceding >= 0 && text[preceding] === '\\') preceding--;
		if ((index - preceding - 1) % 2 !== 0) continue;

		if (opening !== -1) {
			const end = index + 2;
			parts.push(text.slice(from, opening), text.slice(opening, end).replace(/[^\n]/g, ' '));
			from = end;
			opening = -1;
			continue;
		}

		while (codeSpans[codeIndex] && codeSpans[codeIndex]!.to <= index) codeIndex++;
		const code = codeSpans[codeIndex];
		if (!code || index < code.from) opening = index;
	}
	parts.push(text.slice(from));
	return parts.join('');
}

function readSections(doc: Text): Section[] {
	const cached = sectionsByDocument.get(doc);
	if (cached) return cached;

	const text = doc.toString();
	const sections: Section[] = [];
	const firstContent = frontmatterEnd(doc);
	const parsedText = withoutComments(text, firstContent);
	const tree = parser.parse(parsedText);
	tree.iterate({
		enter({ node }) {
			if (node.name !== 'Document' && node.to <= firstContent) return false;
			const level = headingLevel(node);
			const isHeading = level > 0 && node.parent?.name === 'Document';
			const isBullet = node.name === 'ListItem' && node.parent?.name === 'BulletList';
			if (!isHeading && !isBullet) return undefined;

			const line = doc.lineAt(node.from);
			// Compact nested list markers share a physical line and editing boundary.
			if (sections[sections.length - 1]?.line === line.number) return undefined;
			let to = contentEnd(node, text);
			if (isHeading) {
				let sibling = node.nextSibling;
				while (sibling && !(headingLevel(sibling) && headingLevel(sibling) <= level)) {
					to = contentEnd(sibling, text);
					sibling = sibling.nextSibling;
				}
			}
			const markEnd = node.firstChild?.to ?? node.from;
			const label = parsedText.slice(markEnd, line.to).trim()
				.replace(/^\[[ xX]\]\s+/, '').replace(/\s+#+\s*$/, '');
			sections.push({ from: line.from, to, line: line.number, kind: isHeading ? 'heading' : 'bullet', label });
			return undefined;
		},
	});
	sectionsByDocument.set(doc, sections);
	return sections;
}

export function findSection(doc: Text, position: number, exactLine = false): Section | undefined {
	const line = doc.lineAt(position).number;
	const sections = readSections(doc);
	for (let index = sections.length - 1; index >= 0; index--) {
		const section = sections[index]!;
		if (section.line === line || (!exactLine && position >= section.from && position <= section.to)) return section;
	}
	return undefined;
}

export function sameSection(a: Section, b: Section): boolean {
	return a.from === b.from && a.kind === b.kind;
}

export function sectionAncestors(doc: Text, section: Section): Section[] {
	return readSections(doc).filter(candidate => candidate.from < section.from && candidate.to >= section.to);
}

export function mapSection(section: Section, changes: ChangeDesc, before: Text, after: Text): Section | undefined {
	const root = before.line(section.line);
	let deletedRoot = false;
	changes.iterChangedRanges((from, to) => {
		// Removing a whole root line can place a sibling at the same offset.
		if (from <= root.from && to > root.to) deletedRoot = true;
	});
	if (deletedRoot) return;

	// Insertions before the root move the original node to a later line.
	const moved = changes.mapPos(section.from, 1);
	const resolved = findSection(after, moved, true);
	return resolved?.kind === section.kind ? resolved : undefined;
}

export function changesWithin(section: Section, changes: ChangeDesc): boolean {
	let within = true;
	changes.iterChangedRanges((from, to) => {
		if (from < section.from || to > section.to) within = false;
	});
	return within;
}
