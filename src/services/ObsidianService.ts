import { App } from 'obsidian';

/**
 * 封装 Obsidian 底层 API 操作
 */
export class ObsidianService {
	constructor(private app: App) {}

	/** 获取当前活动笔记的全文内容 */
	async getActiveNoteContent(): Promise<string | null> {
		const file = this.app.workspace.getActiveFile();
		if (!file) return null;
		return this.app.vault.read(file);
	}

	/** 将键值对写入当前活动笔记的 YAML frontmatter */
	async updateNoteProperty(key: string, value: string): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file) throw new Error('没有打开的笔记');
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter[key] = value;
		});
	}
}
