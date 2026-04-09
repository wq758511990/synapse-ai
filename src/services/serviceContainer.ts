import { App } from 'obsidian';
import { ObsidianService } from './ObsidianService';

let _app: App | null = null;
let _obsidian: ObsidianService | null = null;

export function initServices(app: App): void {
	_app = app;
	_obsidian = new ObsidianService(app);
}

export function getObsidianService(): ObsidianService {
	if (!_obsidian) throw new Error('Services not initialized');
	return _obsidian;
}

export function getApp(): App {
	if (!_app) throw new Error('Services not initialized');
	return _app;
}
