import { PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type ZoomIntoSection from './main';

export type OpeningLocation = 'same-group' | 'right-split';

export interface ZoomSettings {
	openingLocation: OpeningLocation;
}

export function readSettings(data: unknown): ZoomSettings {
	const location = typeof data === 'object' && data && 'openingLocation' in data ? data.openingLocation : undefined;
	return { openingLocation: location === 'same-group' ? 'same-group' : 'right-split' };
}

export class ZoomSettingTab extends PluginSettingTab {
	constructor(plugin: ZoomIntoSection) {
		super(plugin.app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [{
			name: 'Default Zoom Tab location',
			desc: 'Used when opening a Section by clicking its marker or running the default command.',
			control: {
				type: 'dropdown',
				key: 'openingLocation',
				defaultValue: 'right-split',
				options: {
					'same-group': 'Same group as Outline Tab',
					'right-split': 'Right Split Pane',
				},
			},
		}];
	}
}
