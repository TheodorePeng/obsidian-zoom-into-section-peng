import { EditorView } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField, MarkdownView, Notice, WorkspaceTabs } from 'obsidian';
import type { App, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import { codeMirror, isolateFolds } from './fold-isolation';
import type { FoldIsolation } from './fold-isolation';
import { findSection, sameSection, sectionAncestors } from './sections';
import type { Section } from './sections';
import type { OpeningLocation } from './settings';
import { protectEdits, refreshBreadcrumbs, revealSection, setZoomSection, zoomSection } from './zoom-editor';

interface ZoomTab {
	group: WorkspaceTabs;
	leaf: WorkspaceLeaf;
	view: MarkdownView;
	file: TFile;
	editor: EditorView;
	foldIsolation: FoldIsolation;
	releaseEdits: () => void;
}

export class ZoomTabs {
	private readonly tabs = new Map<WorkspaceLeaf, ZoomTab>();
	private splitGroup?: WorkspaceTabs;
	private requests = Promise.resolve();
	private disposed = false;

	constructor(private readonly app: App) {}

	find(view: MarkdownView, editor: EditorView, position: number, exactLine = false): Section | undefined {
		if (view.leaf.getRoot() !== this.app.workspace.rootSplit || this.tabs.has(view.leaf)
			|| !editor.state.field(editorLivePreviewField, false)) return;
		return findSection(editor.state.doc, position, exactLine);
	}

	handleClick(event: MouseEvent, location: OpeningLocation): void {
		if (!event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0
			|| !(event.target instanceof Element)) return;

		const marker = event.target.closest('.list-bullet, .cm-formatting-list-ul, .cm-fold-indicator');
		const line = marker?.closest('.cm-line');
		const root = line?.closest('.cm-editor');
		if (!marker || !line || !root) return;
		const editor = EditorView.findFromDOM(root as HTMLElement);
		const view = editor?.state.field(editorInfoField, false);
		if (!editor || !(view instanceof MarkdownView)) return;

		const section = this.find(view, editor, editor.posAtDOM(line), true);
		if (!section) return;
		if (marker.classList.contains('cm-fold-indicator')) {
			// Obsidian can place the fold indicator over the bullet marker.
			const plugins = (this.app as App & { plugins?: { enabledPlugins?: ReadonlySet<string> } }).plugins;
			if (plugins?.enabledPlugins?.has('recursive-fold')) return;
		} else if (section.kind !== 'bullet') return;

		event.preventDefault();
		event.stopImmediatePropagation();
		this.open(view, editor, section, location);
	}

	open(source: MarkdownView, editor: EditorView, section: Section, location: OpeningLocation): void {
		const file = source.file;
		const sourceGroup = source.leaf.parent;
		const doc = editor.state.doc;
		if (!file || !(sourceGroup instanceof WorkspaceTabs)) return;

		this.enqueue(async () => {
			if (source.file !== file || source.leaf.parent !== sourceGroup
				|| source.leaf.getRoot() !== this.app.workspace.rootSplit
				|| !editor.state.doc.eq(doc)) throw new Error('The note or tab group changed. Select the node again.');
			await this.openTab(source, file, editor, section, location, sourceGroup);
		});
	}

	noteName(editor: EditorView): string {
		return this.tabFor(editor)?.file.basename ?? 'Note';
	}

	navigate(editor: EditorView, section: Section | null): void {
		const current = editor.state.field(zoomSection, false);
		const tab = this.tabFor(editor);
		if (!current || !tab) return;

		this.enqueue(() => {
			this.checkLayout();
			if (this.tabs.get(tab.leaf) !== tab || editor.state.field(zoomSection, false) !== current) return;
			if (!section) {
				this.release(tab);
				editor.focus();
				return;
			}
			if (!sectionAncestors(editor.state.doc, current).includes(section)) return;
			const existing = this.findTab(tab.group, tab.file, editor, section);
			if (existing) {
				this.app.workspace.setActiveLeaf(existing.leaf, { focus: true });
				return;
			}

			revealSection(editor, section);
			this.labelTabs();
			editor.focus();
		});
	}

	refreshFile(file: TAbstractFile): void {
		this.checkLayout();
		for (const tab of this.tabs.values()) {
			if (tab.file === file) tab.editor.dispatch({ effects: refreshBreadcrumbs.of(null) });
		}
	}

	private enqueue(action: () => void | Promise<void>): void {
		this.requests = this.requests.then(async () => {
			if (!this.disposed) await action();
		}).catch((error: unknown) => {
			if (!this.disposed) new Notice(error instanceof Error ? error.message : 'Could not open the zoom tab.');
		});
	}

	private tabFor(editor: EditorView): ZoomTab | undefined {
		return [...this.tabs.values()].find(tab => tab.editor === editor);
	}

	checkLayout(): void {
		if (!this.tabs.size) return;
		const leaves = new Set<WorkspaceLeaf>();
		this.app.workspace.iterateRootLeaves(leaf => { leaves.add(leaf); });
		for (const tab of this.tabs.values()) {
			if (!leaves.has(tab.leaf) || tab.leaf.view !== tab.view || tab.view.file !== tab.file
				|| tab.leaf.parent !== tab.group || tab.view.getMode() !== 'source'
				|| !tab.editor.state.field(editorLivePreviewField, false)) this.release(tab);
		}
		this.labelTabs();
	}

	update(update: ViewUpdate, exited: boolean): void {
		const editor = update.view;
		const tab = this.tabFor(editor);
		if (!tab) return;
		tab.foldIsolation.update(update);
		if (exited) {
			// Restoring native folding dispatches a new transaction.
			queueMicrotask(() => {
				if (this.tabs.get(tab.leaf) !== tab || editor.state.field(zoomSection, false)) return;
				this.release(tab);
				if (update.docChanged) new Notice('The node changed. Showing the full note.');
			});
		} else if (update.docChanged) {
			this.labelTabs();
		}
	}

	dispose(): void {
		this.disposed = true;
		for (const tab of this.tabs.values()) this.release(tab);
	}

	private findTab(group: WorkspaceTabs | undefined, file: TFile, editor: EditorView, section: Section): ZoomTab | undefined {
		if (!group) return undefined;
		for (const entry of this.tabs.values()) {
			if (entry.group !== group || entry.file !== file) continue;
			const current = entry.editor.state.field(zoomSection, false);
			if (!current) continue;
			if (!entry.editor.state.doc.eq(editor.state.doc)) throw new Error('The note is syncing. Try again.');
			if (sameSection(current, section)) return entry;
		}
		return undefined;
	}

	private async openTab(
		source: MarkdownView, file: TFile, editor: EditorView, section: Section,
		location: OpeningLocation, sourceGroup: WorkspaceTabs,
	): Promise<void> {
		this.checkLayout();
		const destination = location === 'same-group' ? sourceGroup : this.splitGroup;
		const existing = this.findTab(destination, file, editor, section);
		const workspace = this.app.workspace;
		if (existing) {
			workspace.setActiveLeaf(existing.leaf, { focus: true });
			return;
		}

		const doc = editor.state.doc;
		// Workspace 1.15.1 accepts a tab group here at runtime.
		const group = destination as (WorkspaceTabs & { children: WorkspaceLeaf[] }) | undefined;
		const leaf = group
			? workspace.createLeafInParent(group, group.children.length)
			: workspace.createLeafBySplit(source.leaf, 'vertical');
		try {
			await leaf.openFile(file, { active: false, state: { mode: 'source', source: false } });
			if (this.disposed) {
				leaf.detach();
				return;
			}
			const view = leaf.view;
			const target = view instanceof MarkdownView ? codeMirror(view.editor) : undefined;
			if (!(view instanceof MarkdownView) || !target?.state.doc.eq(doc) || !editor.state.doc.eq(doc)
				|| source.file !== file || source.leaf.parent !== sourceGroup
				|| !target.state.field(editorLivePreviewField, false) || !(leaf.parent instanceof WorkspaceTabs)
				|| (destination && leaf.parent !== destination)) {
				throw new Error('The source editor changed. Select the node again.');
			}
			const foldIsolation = isolateFolds(this.app, view, file, source);
			if (!foldIsolation) throw new Error('Independent folding is unavailable in this version.');

			const releaseEdits = protectEdits(target);
			if (!releaseEdits) {
				foldIsolation.release();
				throw new Error('Section editing protection is unavailable in this version.');
			}
			if (location === 'right-split') this.splitGroup = leaf.parent;
			const tab = { group: leaf.parent, leaf, view, file, editor: target, foldIsolation, releaseEdits };
			this.tabs.set(leaf, tab);
			revealSection(target, section);
			this.labelTabs();
			workspace.setActiveLeaf(leaf, { focus: true });
		} catch (error) {
			const tab = this.tabs.get(leaf);
			if (tab) this.release(tab);
			leaf.detach();
			throw error;
		}
	}

	private labelTabs(): void {
		const entries = [...this.tabs.values()].map(tab => ({ tab, section: tab.editor.state.field(zoomSection, false) }));
		for (const { tab, section } of entries) {
			const title = (tab.leaf as WorkspaceLeaf & { tabHeaderInnerTitleEl?: HTMLElement }).tabHeaderInnerTitleEl;
			if (!section || !title) continue;
			const duplicated = entries.some(other => other.tab !== tab
				&& other.tab.file.basename === tab.file.basename && other.section?.label === section.label);
			const source = duplicated ? `${tab.file.basename} (line ${section.line})` : tab.file.basename;
			title.textContent = `${section.label || 'Section'} · ${source}`;
			title.title = `${tab.file.path} · line ${section.line}`;
		}
	}

	private release(tab: ZoomTab): void {
		this.tabs.delete(tab.leaf);
		if (tab.group === this.splitGroup && ![...this.tabs.values()].some(entry => entry.group === tab.group)) {
			this.splitGroup = undefined;
		}
		try {
			if (tab.editor.state.field(zoomSection, false)) tab.editor.dispatch({ effects: setZoomSection.of(null) });
		} finally {
			try {
				tab.foldIsolation.release();
			} finally {
				tab.releaseEdits();
				const title = (tab.leaf as WorkspaceLeaf & { tabHeaderInnerTitleEl?: HTMLElement }).tabHeaderInnerTitleEl;
				if (title && tab.leaf.view === tab.view && tab.view.file === tab.file) {
					title.textContent = tab.view.getDisplayText();
					title.removeAttribute('title');
				}
				this.labelTabs();
			}
		}
	}
}
