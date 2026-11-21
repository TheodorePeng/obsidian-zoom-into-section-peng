import { foldedRanges, unfoldEffect } from '@codemirror/language';
import { EditorSelection, EditorState, Prec, StateEffect, StateField, Transaction } from '@codemirror/state';
import { Decoration, EditorView, keymap, showPanel } from '@codemirror/view';
import type { Panel, ViewUpdate } from '@codemirror/view';
import { changesWithin, mapSection, sectionAncestors } from './sections';
import type { Section } from './sections';

export const setZoomSection = StateEffect.define<Section | null>();

export const zoomSection = StateField.define<Section | null>({
	create: () => null,
	update(section, transaction) {
		const change = transaction.effects.find(effect => effect.is(setZoomSection));
		if (change?.is(setZoomSection)) return change.value;
		if (!section || !transaction.docChanged) return section;
		return mapSection(section, transaction.changes, transaction.startState.doc, transaction.newDoc) ?? null;
	},
});

const zoomAttributes = EditorView.editorAttributes.compute([zoomSection], (state): Record<string, string> => (
	state.field(zoomSection) ? { class: 'zoom-into-section-peng-active' } : {}
));

const hidden = Decoration.replace({ block: true });
const visibleSection = EditorView.decorations.compute([zoomSection, 'doc'], state => {
	const section = state.field(zoomSection);
	if (!section) return Decoration.none;
	const ranges = [];
	if (section.from > 1) ranges.push(hidden.range(0, section.from - 1));
	if (section.to + 1 < state.doc.length) ranges.push(hidden.range(section.to + 1, state.doc.length));
	return Decoration.set(ranges);
});

export function revealSection(editor: EditorView, section: Section): void {
	const effects: StateEffect<unknown>[] = [setZoomSection.of(section)];
	foldedRanges(editor.state).between(section.from, section.to, (from, to) => {
		if (from < section.to && to > section.from) effects.push(unfoldEffect.of({ from, to }));
	});
	editor.dispatch({
		effects,
		selection: EditorSelection.cursor(section.from),
		scrollIntoView: true,
		annotations: Transaction.addToHistory.of(false),
	});
}

interface EditorDispatcher {
	dispatchTransactions(transactions: readonly Transaction[], view: EditorView): void;
}

/** Guard at dispatch too, including commands that supply an unfiltered transaction. */
export function protectEdits(editor: EditorView): (() => void) | undefined {
	const native = editor as unknown as EditorDispatcher;
	if (typeof native.dispatchTransactions !== 'function') return;

	const original = native.dispatchTransactions.bind(native);
	const descriptor = Object.getOwnPropertyDescriptor(native, 'dispatchTransactions');
	const dispatch: EditorDispatcher['dispatchTransactions'] = (transactions, view) => {
		for (const transaction of transactions) {
			const section = transaction.startState.field(zoomSection, false);
			// Obsidian synchronizes other editors with a native set transaction.
			if (section && !transaction.isUserEvent('set') && !transaction.annotation(Transaction.remote)
				&& !changesWithin(section, transaction.changes)) return;
		}
		original(transactions, view);
	};
	native.dispatchTransactions = dispatch;
	return () => {
		if (native.dispatchTransactions !== dispatch) return;
		if (descriptor) Object.defineProperty(native, 'dispatchTransactions', descriptor);
		else Reflect.deleteProperty(native, 'dispatchTransactions');
	};
}

const limitSelection = EditorState.transactionFilter.of(transaction => {
	const section = transaction.startState.field(zoomSection, false);
	if (!section || !transaction.selection || transaction.effects.some(effect => effect.is(setZoomSection))) return transaction;
	const from = transaction.changes.mapPos(section.from, -1);
	const to = transaction.changes.mapPos(section.to, 1);
	const within = (pos: number) => Math.min(Math.max(pos, from), to);
	const selection = transaction.newSelection;
	const ranges = selection.ranges.map(range => EditorSelection.range(within(range.anchor), within(range.head)));
	const clamped = EditorSelection.create(ranges, selection.mainIndex);
	if (clamped.eq(selection)) return transaction;
	return [transaction, { selection: clamped, sequential: true }];
});

const selectSection = Prec.highest(keymap.of([{
	key: 'Mod-a',
	run(editor) {
		const section = editor.state.field(zoomSection, false);
		if (!section) return false;
		editor.dispatch({ selection: EditorSelection.range(section.from, section.to), userEvent: 'select' });
		return true;
	},
}]));

export const refreshBreadcrumbs = StateEffect.define<null>();

export function zoomBreadcrumbs(
	noteName: (editor: EditorView) => string,
	navigate: (editor: EditorView, section: Section | null) => void,
) {
	const createPanel = (editor: EditorView): Panel => {
		const dom = editor.dom.createEl('nav', {
			cls: 'zoom-into-section-peng-context',
			attr: { 'aria-label': 'Section path' },
		});
		dom.detach();

		const addLink = (label: string, destination: Section | null) => {
			const button = dom.createEl('button', { text: label, attr: { type: 'button', title: label } });
			button.addEventListener('click', () => navigate(editor, destination));
		};

		const addSeparator = () => {
			dom.createSpan({ text: '›', attr: { 'aria-hidden': 'true' } });
		};

		const render = () => {
			const section = editor.state.field(zoomSection, false);
			if (!section) return;
			dom.empty();
			addLink(noteName(editor), null);
			for (const ancestor of sectionAncestors(editor.state.doc, section)) {
				addSeparator();
				addLink(ancestor.label || 'Section', ancestor);
			}
			addSeparator();
			const label = section.label || 'Section';
			dom.createSpan({ text: label, attr: { 'aria-current': 'location', title: label } });
			dom.scrollLeft = dom.scrollWidth;
		};

		render();
		return {
			dom,
			top: true,
			mount: () => { dom.scrollLeft = dom.scrollWidth; },
			update(update: ViewUpdate) {
				if (update.docChanged || update.startState.field(zoomSection, false) !== update.state.field(zoomSection, false)
					|| update.transactions.some(transaction => transaction.effects.some(effect => effect.is(refreshBreadcrumbs)))) render();
			},
		};
	};
	return showPanel.compute([zoomSection], state => state.field(zoomSection) ? createPanel : null);
}

export const zoomEditor = [zoomSection, zoomAttributes, visibleSection, limitSelection, selectSection];
