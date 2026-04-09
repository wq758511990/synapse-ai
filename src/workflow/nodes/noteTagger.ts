import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLLM, LLMConfig } from "../../services/llmService";
import { ObsidianService } from "../../services/ObsidianService";
import { ChatState } from "../types";
import { DetailCallbacks } from "../chatGraph";

const BATCH_SIZE = 10;
const MAX_CONTENT_LENGTH = 2000;

export function createNoteTagger(
	llmConfig: LLMConfig,
	obsidian: ObsidianService,
	callbacks: DetailCallbacks = {},
) {
	return async function noteTagger(state: ChatState): Promise<Partial<ChatState>> {
		// 1. 解析作用范围
		const { files, scopeLabel } = resolveScope(state, obsidian);

		if (files.length === 0) {
			return buildResponse([], 0, scopeLabel);
		}

		// 2. 过滤已有标签的笔记
		const untagged: { path: string; content: string }[] = [];
		let skippedCount = 0;

		for (const file of files) {
			const meta = obsidian.getNoteMetadata(file.path);
			if (meta && meta.tags.length > 0) {
				skippedCount++;
				continue;
			}
			const content = await obsidian.readNote(file.path);
			if (content) {
				untagged.push({ path: file.path, content: content.slice(0, MAX_CONTENT_LENGTH) });
			}
		}

		if (untagged.length === 0) {
			return buildResponse([], skippedCount, scopeLabel);
		}

		// 3. 收集已有标签作为参考
		const existingTags = obsidian.getAllTags();

		// 4. 批量调 LLM 生成标签
		const llm = createLLM(llmConfig);
		const tagResults: Record<string, string[]> = {};

		for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
			const batch = untagged.slice(i, i + BATCH_SIZE);
			const result = await generateTags(llm, batch, existingTags, callbacks);
			Object.assign(tagResults, result);
		}

		// 5. 写入标签
		let taggedCount = 0;
		for (const [path, tags] of Object.entries(tagResults)) {
			for (const tag of tags) {
				await obsidian.addTagToNote(path, tag);
			}
			taggedCount++;
		}

		return buildResponse(Object.entries(tagResults), skippedCount, scopeLabel);
	};
}

function resolveScope(
	state: ChatState,
	obsidian: ObsidianService,
): { files: { path: string }[]; scopeLabel: string } {
	const input = state.userInput;

	if (/当前|这篇|这篇笔记|当前笔记/.test(input)) {
		const file = obsidian["app"].workspace.getActiveFile();
		if (file) {
			return { files: [{ path: file.path }], scopeLabel: `当前笔记 (${file.basename})` };
		}
		return { files: [], scopeLabel: "当前笔记（未打开）" };
	}

	// 尝试提取文件夹路径
	const folderMatch = input.match(/["""](.+?)["""]|给\s*(.+?)\s*(文件夹|目录)/);
	if (folderMatch) {
		const folderPath = (folderMatch[1] || folderMatch[2])!.trim();
		const files = obsidian.getFilesInFolder(folderPath);
		if (files.length > 0) {
			return { files: files.map((f) => ({ path: f.path })), scopeLabel: `文件夹 ${folderPath}` };
		}
	}

	// 默认：全部笔记
	if (/所有|全部|整个/.test(input)) {
		const files = obsidian.getAllMarkdownFiles();
		return { files: files.map((f) => ({ path: f.path })), scopeLabel: "全部笔记" };
	}

	// 无明确范围，默认当前笔记
	const file = obsidian["app"].workspace.getActiveFile();
	if (file) {
		return { files: [{ path: file.path }], scopeLabel: `当前笔记 (${file.basename})` };
	}
	return { files: [], scopeLabel: "当前笔记（未打开）" };
}

async function generateTags(
	llm: ReturnType<typeof createLLM>,
	batch: { path: string; content: string }[],
	existingTags: string[],
	callbacks: DetailCallbacks,
): Promise<Record<string, string[]>> {
	const noteBlocks = batch
		.map((n) => `=== ${n.path} ===\n${n.content}`)
		.join("\n\n");

	const tagRef = existingTags.length > 0
		? `\n已有标签参考（优先复用）：${existingTags.join(", ")}`
		: "";

	const systemPrompt = `你是一个笔记打标助手。根据以下笔记内容，为每篇笔记生成 2-5 个标签。
要求：
- 优先使用已有标签（见下方列表），保持标签体系一致
- 如果已有标签不适用，再生成新标签
- 标签简洁，使用中文，1-3个字为主
- 不要带 # 前缀
${tagRef}
只返回 JSON，格式如下：
{ "path1": ["标签1", "标签2"], "path2": ["标签3"] }`;

	const response = await llm.invoke(
		[new SystemMessage(systemPrompt), new HumanMessage(`请为以下笔记打标签：\n\n${noteBlocks}`)],
		{ signal: callbacks.signal },
	);

	const text = typeof response.content === "string" ? response.content : "";
	let result: Record<string, string[]> = {};

	try {
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			result = JSON.parse(jsonMatch[0]);
		}
	} catch {
		// 解析失败，返回空
	}

	// 验证格式：只保留数组类型的值
	const cleaned: Record<string, string[]> = {};
	for (const [path, tags] of Object.entries(result)) {
		if (Array.isArray(tags) && tags.length > 0) {
			cleaned[path] = tags.filter((t) => typeof t === "string");
		}
	}

	return cleaned;
}

function buildResponse(
	tagged: [string, string[]][],
	skippedCount: number,
	scopeLabel: string,
): Partial<ChatState> {
	const lines: string[] = [`打标范围：${scopeLabel}`];

	if (skippedCount > 0) {
		lines.push(`跳过 ${skippedCount} 篇已有标签的笔记`);
	}

	if (tagged.length > 0) {
		lines.push(`为 ${tagged.length} 篇笔记添加了标签：`);
		for (const [path, tags] of tagged) {
			const name = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
			lines.push(`- ${name}：${tags.join(", ")}`);
		}
	} else {
		lines.push("没有需要打标的笔记");
	}

	return {
		contextMessages: [
			{ role: "system", content: "你是一个笔记助手。根据打标结果，向用户汇报。" },
			{ role: "user", content: lines.join("\n") },
		],
	};
}
