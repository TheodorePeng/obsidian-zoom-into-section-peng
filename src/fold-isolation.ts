import { foldEffect, foldedRanges, unfoldEffect } from '@codemirror/language';
import { Transaction } from '@codemirror/state';
import type { StateEffect } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import type { Text } from '@codemirror/state';
import type { App, Editor, MarkdownView, TFile } from 'obsidian';

interface FoldInfo {
	folds: { from: number; to: number }[];
	lines: number;
}

interface NativeEditMode {
	getFoldInfo(): FoldInfo | null;
	requestSaveFolds?: { cancel(): void };
}

interface NativeMarkdownView {
	currentMode: NativeEditMode;
	onMarkdownFold(): void;
}

export function codeMirror(editor: Editor): EditorView | undefined {
	return (editor as Editor & { cm?: EditorView }).cm;
}

/**
 * Fold persistence in Obsidian 1.15.1 is keyed by file, including from
 * independently folded editors. Scope the interception to this native view.
 */
export interface FoldIsolation {
	update(update: ViewUpdate): void;
	release(): void;
}

function outlineFolds(outline: MarkdownView, file: TFile, doc: Text): FoldInfo | null | undefined {
	if (outline.file !== file || outline.getMode() !== 'source' || !codeMirror(outline.editor)?.state.doc.eq(doc)) return;
	const native = outline as unknown as NativeMarkdownView;
	return native.currentMode.getFoldInfo();
}

function mapFoldInfo(info: FoldInfo | null, update: ViewUpdate): FoldInfo | null {
	if (!info || info.lines !== update.startState.doc.lines) return null;
	const before = update.startState.doc;
	const after = update.state.doc;
	const folds: FoldInfo['folds'] = [];
	for (const fold of info.folds) {
		const start = before.line(fold.from + 1);
		const end = before.line(Math.min(fold.to + 1, before.lines));
		let deletedRoot = false;
		update.changes.iterChangedRanges((from, to) => {
			if (from <= start.from && to > start.to) deletedRoot = true;
		});
		if (deletedRoot) continue;
		const newStart = after.lineAt(update.changes.mapPos(start.from, 1)).number - 1;
		const newEnd = after.lineAt(update.changes.mapPos(end.to, 1)).number - 1;
		if (newStart < newEnd || fold.from === fold.to) folds.push({ from: newStart, to: newEnd });
	}
	return { folds, lines: after.lines };
}

function restoreFolds(editor: EditorView, info: FoldInfo | null): void {
	const doc = editor.state.doc;
	const effects: StateEffect<unknown>[] = [];
	foldedRanges(editor.state).between(0, doc.length, (from, to) => {
		effects.push(unfoldEffect.of({ from, to }));
	});
	if (info?.lines === doc.lines) {
		// The native restore routine widens saved folds to the current heading
		// boundary. Keep the actual prior extent if a structural edit changed it.
		for (const fold of info.folds) {
			const from = doc.line(fold.from + 1).to;
			const to = doc.line(Math.min(fold.to + 1, doc.lines)).to;
			if (to > from) effects.push(foldEffect.of({ from, to }));
		}
	}
	if (effects.length) editor.dispatch({ effects, annotations: Transaction.addToHistory.of(false) });
}

export function isolateFolds(app: App, view: MarkdownView, file: TFile, outline: MarkdownView): FoldIsolation | undefined {
	const native = view as unknown as NativeMarkdownView;
	const mode = native.currentMode;
	const manager = (app as App & { foldManager?: { load(file: TFile): FoldInfo | null } }).foldManager;
	if (typeof manager?.load !== 'function' || typeof native.onMarkdownFold !== 'function'
		|| typeof mode?.getFoldInfo !== 'function'
		|| typeof mode.requestSaveFolds?.cancel !== 'function') return;

	const previousSave = native.onMarkdownFold.bind(native);
	const previousGet = mode.getFoldInfo.bind(mode);
	const saveDescriptor = Object.getOwnPropertyDescriptor(native, 'onMarkdownFold');
	const getDescriptor = Object.getOwnPropertyDescriptor(mode, 'getFoldInfo');
	const save = () => {
		if (view.file !== file) previousSave();
	};
	const get = () => view.file === file ? manager.load(file) : previousGet();

	// The mode switch also calls getFoldInfo directly before saving.
	native.onMarkdownFold = save;
	mode.getFoldInfo = get;

	let projected = previousGet();
	let modified = false;

	return {
		update(update) {
			if (!update.docChanged) return;
			modified = true;
			const saved = manager.load(file);
			const original = outlineFolds(outline, file, update.startState.doc);
			const folds = original !== undefined
				? original
				: saved?.lines === update.startState.doc.lines ? saved : projected;
			projected = mapFoldInfo(folds, update);
		},
		release() {
			try {
				const editor = codeMirror(view.editor);
				if (editor && view.file === file && native.currentMode === mode) {
					const doc = editor.state.doc;
					const original = outlineFolds(outline, file, doc);
					const saved = manager.load(file);
					// A structural edit may exit zoom before the Outline Tab receives it.
					const folds = original !== undefined ? original : modified ? projected : saved;
					restoreFolds(editor, folds);
				}
			} finally {
				mode.requestSaveFolds?.cancel();
				if (mode.getFoldInfo === get) {
					if (getDescriptor) Object.defineProperty(mode, 'getFoldInfo', getDescriptor);
					else Reflect.deleteProperty(mode, 'getFoldInfo');
				}
				if (native.onMarkdownFold === save) {
					if (saveDescriptor) Object.defineProperty(native, 'onMarkdownFold', saveDescriptor);
					else Reflect.deleteProperty(native, 'onMarkdownFold');
				}
			}
		},
	};
}
