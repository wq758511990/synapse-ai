import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLLM, LLMConfig } from "../../services/llmService";
import { NoteInfo, ObsidianService } from "../../services/ObsidianService";
import { ChatState } from "../types";
import { DetailCallbacks } from "../chatGraph";
import { invokeWithThinking } from "./thinkingUtils";

const EXTRACT_KEYWORDS_PROMPT = `从用户的搜索请求中提取核心搜索关键词，返回 JSON 数组：["关键词1", "关键词2"]
去掉"找一下"、"帮我找"、"搜索"、"相关内容"等噪音词，只保留核心名词和主题。
示例：
输入："找一下 旅游事项 相关内容" → ["旅游事项"]
输入："帮我找关于机器学习的笔记" → ["机器学习"]
输入："搜索 react hooks" → ["react hooks"]
只返回 JSON，不要其他内容。`;

const FILTER_SYSTEM_PROMPT = `你是一个笔记筛选助手。根据用户的搜索意图，从候选笔记列表中选出最相关的笔记。
返回一个 JSON 数组，包含选中的笔记路径：["path1", "path2", ...]，最多选 5 篇。
如果没有相关笔记，返回空数组 []。
只返回 JSON，不要其他内容。`;

export function createNoteSearcher(
	llmConfig: LLMConfig,
	obsidian: ObsidianService,
	callbacks: DetailCallbacks = {},
) {
	return async function noteSearcher(
		state: ChatState,
	): Promise<Partial<ChatState>> {
		const llm = createLLM(llmConfig);

		// 1. AI 提取核心关键词
		const { text: kwText } = await invokeWithThinking(
			llm,
			[new SystemMessage(EXTRACT_KEYWORDS_PROMPT), new HumanMessage(state.userInput)],
			callbacks,
			'关键词提取：',
		);

		let searchKeywords: string[] = [];
		try {
			const jsonMatch = kwText.match(/\[[^\]]*\]/);
			if (jsonMatch) {
				searchKeywords = JSON.parse(jsonMatch[0]) as string[];
			}
		} catch { /* ignore */ }

		if (searchKeywords.length === 0) {
			searchKeywords = [state.userInput];
		}

		console.warn("[Synapse AI] 提取的搜索关键词:", searchKeywords);

		// 2. 用每个关键词搜索，去重合并
		const seen = new Map<string, NoteInfo>();
		for (const keyword of searchKeywords) {
			const results = obsidian.searchNotes(keyword, 10);
			for (const r of results) {
				if (!seen.has(r.path)) {
					seen.set(r.path, r);
				}
			}
		}
		const candidates = Array.from(seen.values()).slice(0, 20);

		console.warn("[Synapse AI] 候选笔记数:", candidates.length);
		console.warn("[Synapse AI] 候选笔记:", candidates.map((c) => c.name));

		if (candidates.length === 0) {
			return { aiResponse: `没有找到与"${state.userInput}"相关的笔记。` };
		}

		// 3. AI 精筛
		const candidateInfo = candidates
			.map(
				(n) =>
					`- ${n.name} (path: ${n.path}) tags: [${n.tags.join(", ")}] summary: ${n.summary || "无"}`,
			)
			.join("\n");

		const { text: filterText } = await invokeWithThinking(
			llm,
			[
				new SystemMessage(FILTER_SYSTEM_PROMPT),
				new HumanMessage(`搜索意图：${state.userInput}\n\n候选笔记：\n${candidateInfo}`),
			],
			callbacks,
			'笔记筛选：',
		);

		let selectedPaths: string[] = [];
		try {
			const jsonMatch = filterText.match(/\[[^\]]*\]/);
			if (jsonMatch) {
				selectedPaths = JSON.parse(jsonMatch[0]) as string[];
			}
		} catch {
			selectedPaths = candidates.slice(0, 3).map((n) => n.path);
		}

		if (selectedPaths.length === 0) {
			selectedPaths = candidates.slice(0, 3).map((n) => n.path);
		}

		console.warn("[Synapse AI] AI 精筛选中:", selectedPaths);

		// 4. 读取选中笔记全文
		const noteContents: string[] = [];
		for (const path of selectedPaths) {
			const content = await obsidian.readNote(path);
			if (content) {
				noteContents.push(`=== ${path} ===\n${content}`);
			}
		}

		if (noteContents.length === 0) {
			return { aiResponse: "找到了相关笔记但无法读取内容。" };
		}

		// 5. 组装 context 给 chatResponder
		const systemPrompt =
			"你是一个笔记助手。根据搜索到的相关笔记内容，回答用户的问题。请引用笔记中的具体内容来回答。";
		const userContent = [
			`用户搜索意图：${state.userInput}`,
			`找到 ${noteContents.length} 篇相关笔记：`,
			...noteContents,
		].join("\n\n");

		const messages = [
			{ role: "system", content: systemPrompt },
			...state.chatHistory
				.slice(-10)
				.map((m) => ({ role: m.role, content: m.content })),
			{ role: "user", content: userContent },
		];

		return { contextMessages: messages };
	};
}
