import { EditorView } from '@codemirror/view';
import { MarkdownView, Plugin } from 'obsidian';
import { codeMirror } from './fold-isolation';
import { readSettings, ZoomSettingTab } from './settings';
import type { OpeningLocation } from './settings';
import { zoomBreadcrumbs, zoomEditor, zoomSection } from './zoom-editor';
import { ZoomTabs } from './zoom-tabs';

export default class ZoomIntoSection extends Plugin {
	settings = readSettings(null);

	async onload(): Promise<void> {
		this.settings = readSettings(await this.loadData());
		this.addSettingTab(new ZoomSettingTab(this));

		const tabs = new ZoomTabs(this.app);
		this.registerEditorExtension([
			zoomEditor,
			zoomBreadcrumbs(
				editor => tabs.noteName(editor),
				(editor, section) => tabs.navigate(editor, section),
			),
			EditorView.updateListener.of(update => {
				const before = update.startState.field(zoomSection, false);
				const after = update.state.field(zoomSection, false);
				if (before !== after || (before && update.docChanged)) tabs.update(update, !!before && !after);
			}),
		]);
		this.register(() => tabs.dispose());
		const addOpenCommand = (id: string, name: string, location?: OpeningLocation) => {
			this.addCommand({
				id,
				name,
				editorCheckCallback: (checking, editor, context) => {
					if (!(context instanceof MarkdownView)) return false;
					const cm = codeMirror(editor);
					if (!cm) return false;
					const section = tabs.find(context, cm, cm.state.selection.main.head);
					if (!section) return false;
					if (!checking) tabs.open(context, cm, section, location ?? this.settings.openingLocation);
					return true;
				},
			});
		};
		addOpenCommand('open-section-in-zoom-tab', 'Open section in zoom tab');
		addOpenCommand('open-section-in-current-tab-group', 'Open section in current tab group', 'same-group');
		addOpenCommand('open-section-in-right-split', 'Open section in right split', 'right-split');
		this.registerEvent(this.app.workspace.on('layout-change', () => tabs.checkLayout()));
		this.registerEvent(this.app.workspace.on('file-open', () => tabs.checkLayout()));
		this.registerEvent(this.app.vault.on('rename', file => tabs.refreshFile(file)));
		this.registerDomEvent(this.app.workspace.containerEl, 'click', event => {
			tabs.handleClick(event, this.settings.openingLocation);
		}, { capture: true });
	}
}
