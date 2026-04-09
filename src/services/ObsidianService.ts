import { App, TFile, prepareFuzzySearch } from "obsidian";

export interface NoteInfo {
	path: string;
	name: string;
	content: string;
	tags: string[];
	links: string[];
	summary: string | null;
}

/**
 * 封装 Obsidian 底层 API 操作
 */
export class ObsidianService {
	constructor(public readonly app: App) {}

	/** 获取当前活动笔记的全文内容 */
	async getActiveNoteContent(): Promise<string | null> {
		const file = this.app.workspace.getActiveFile();
		if (!file) return null;
		return this.app.vault.read(file);
	}

	/** 将键值对写入当前活动笔记的 YAML frontmatter */
	async updateNoteProperty(key: string, value: string): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file) throw new Error("没有打开的笔记");
		await this.app.fileManager.processFrontMatter(
			file,
			(frontmatter: Record<string, unknown>) => {
				frontmatter[key] = value;
			},
		);
	}

	/** 获取所有 Markdown 文件列表 */
	getAllMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	/** 关键词搜索所有笔记（本地粗筛），返回匹配的笔记摘要列表 */
	searchNotes(query: string, maxResults = 20): NoteInfo[] {
		const searchFn = prepareFuzzySearch(query);
		const files = this.getAllMarkdownFiles();
		const results: NoteInfo[] = [];

		console.warn(`[Synapse AI] searchNotes: 共 ${files.length} 个文件, 查询: "${query}"`);

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);

			// 搜索范围：文件名 + frontmatter summary + headings + tags
			const searchableText = [
				file.basename,
				file.path,
				cache?.frontmatter?.summary ?? "",
				...(cache?.headings?.map((h) => h.heading) ?? []),
				...(cache?.tags?.map((t) => t.tag) ?? []),
			].join(" ");

			const match = searchFn(searchableText);
			if (match) {
				const tags = cache?.tags?.map((t) => t.tag) ?? [];
				const links = cache?.links?.map((l) => l.link) ?? [];
				const summary = (cache?.frontmatter?.summary as string) ?? null;

				results.push({
					path: file.path,
					name: file.basename,
					content: "",
					tags,
					links,
					summary,
				});
			}

			if (results.length >= maxResults) break;
		}

		return results;
	}

	/** 读取指定笔记的全文 */
	async readNote(path: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) return null;
		return this.app.vault.read(file);
	}

	/** 获取指定笔记的元数据（标签、链接、frontmatter） */
	getNoteMetadata(path: string): NoteInfo | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) return null;
		const cache = this.app.metadataCache.getFileCache(file);
		return {
			path: file.path,
			name: file.basename,
			content: "",
			tags: cache?.tags?.map((t) => t.tag) ?? [],
			links: cache?.links?.map((l) => l.link) ?? [],
			summary: (cache?.frontmatter?.summary as string) ?? null,
		};
	}

	/** 给指定笔记的 frontmatter 添加标签 */
	async addTagToNote(path: string, tag: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile))
			throw new Error(`找不到笔记: ${path}`);
		await this.app.fileManager.processFrontMatter(
			file,
			(frontmatter: Record<string, unknown>) => {
				const existing = Array.isArray(frontmatter.tags)
					? frontmatter.tags
					: [];
				if (!existing.includes(tag)) {
					frontmatter.tags = [...(existing as string[]), tag];
				}
			},
		);
	}

	/** 获取链接图（已解析的双向链接关系） */
	getLinkGraph(): Record<string, Record<string, number>> {
		return this.app.metadataCache.resolvedLinks;
	}
}
