import { Annotation, StateGraph } from "@langchain/langgraph";
import { LLMConfig } from "../services/llmService";
import { ObsidianService } from "../services/ObsidianService";
import { ChatMessage } from "../store/useSynapseStore";
import { createChatResponder } from "./nodes/chatResponder";
import { contextBuilder } from "./nodes/contextBuilder";
import { createIntentClassifier } from "./nodes/intentClassifier";
import { createNoteSearcher } from "./nodes/noteSearcher";
import { Intent } from "./types";

// 定义 Graph State
const ChatAnnotation = Annotation.Root({
	userInput: Annotation<string>(),
	chatHistory: Annotation<ChatMessage[]>,
	currentNoteContent: Annotation<string | null>,
	intent: Annotation<Intent>(),
	contextMessages: Annotation<Array<{ role: string; content: string }>>,
	aiResponse: Annotation<string>(),
});

// 路由表：intent → 目标节点名
const INTENT_TO_NODE: Record<Intent, string> = {
	chat: "chatResponder",
	note_qa: "contextBuilder",
	note_summary: "contextBuilder",
	note_search: "noteSearcher",
};

// 节点进度提示
const NODE_LABELS: Record<string, string> = {
	intentClassifier: "正在分析你的意图...",
	contextBuilder: "正在整理笔记上下文...",
	noteSearcher: "正在搜索相关笔记...",
	chatResponder: "正在生成回复...",
};

function routeByIntent(state: typeof ChatAnnotation.State): string {
	return INTENT_TO_NODE[state.intent] ?? "chatResponder";
}

export interface WorkflowCallbacks {
	onToken?: (token: string) => void;
	onStepStart?: (label: string) => void;
	onStepDetail?: (detail: string) => void;
	onStepDone?: () => void;
}

// 包装节点函数，执行前后通知 UI
function withStepTracking<T extends (state: typeof ChatAnnotation.State) => Promise<Partial<typeof ChatAnnotation.State>>>(
	nodeName: string,
	fn: T,
	callbacks: WorkflowCallbacks,
): T {
	return (async (state: typeof ChatAnnotation.State) => {
		callbacks.onStepStart?.(NODE_LABELS[nodeName] ?? nodeName);
		try {
			return await fn(state);
		} finally {
			callbacks.onStepDone?.();
		}
	}) as T;
}

// 构建并编译 Graph
export function createChatWorkflow(
	llmConfig: LLMConfig,
	obsidian: ObsidianService,
	callbacks: WorkflowCallbacks,
) {
	const intentClassifier = createIntentClassifier(llmConfig, callbacks);
	const chatResponder = createChatResponder(llmConfig, callbacks);
	const noteSearcher = createNoteSearcher(llmConfig, obsidian, callbacks);

	const graph = new StateGraph(ChatAnnotation)
		.addNode(
			"intentClassifier",
			withStepTracking("intentClassifier", intentClassifier, callbacks),
		)
		.addNode(
			"contextBuilder",
			withStepTracking("contextBuilder", contextBuilder, callbacks),
		)
		.addNode(
			"chatResponder",
			withStepTracking("chatResponder", chatResponder, callbacks),
		)
		.addNode("noteSearcher", withStepTracking("noteSearcher", noteSearcher, callbacks))
		.addEdge("__start__", "intentClassifier")
		.addConditionalEdges("intentClassifier", routeByIntent, {
			chatResponder: "chatResponder",
			contextBuilder: "contextBuilder",
			noteSearcher: "noteSearcher",
		})
		.addEdge("contextBuilder", "chatResponder")
		.addEdge("noteSearcher", "chatResponder")
		.addEdge("chatResponder", "__end__");

	return graph.compile();
}

// 对外暴露的入口函数
export async function runChatWorkflow(
	llmConfig: LLMConfig,
	obsidian: ObsidianService,
	input: {
		userInput: string;
		chatHistory: ChatMessage[];
		currentNoteContent: string | null;
		intent?: Intent;
	},
	callbacks: WorkflowCallbacks = {},
): Promise<{ aiResponse: string }> {
	try {
		const initialState = {
			userInput: input.userInput,
			chatHistory: input.chatHistory,
			currentNoteContent: input.currentNoteContent,
			intent: input.intent ?? "chat",
			contextMessages: [],
			aiResponse: "",
		};

		// 如果直接指定了 intent，跳过 intentClassifier 节点
		if (input.intent) {
			if (input.intent === "note_search") {
				callbacks.onStepStart?.("正在搜索相关笔记...");
				const searcher = createNoteSearcher(llmConfig, obsidian, callbacks);
				const searchResult = await searcher(initialState);
				const fullState = { ...initialState, ...searchResult };
				callbacks.onStepDone?.();

				callbacks.onStepStart?.("正在生成回复...");
				const responder = createChatResponder(llmConfig, callbacks);
				const result = await responder(fullState);
				callbacks.onStepDone?.();
				return { aiResponse: result.aiResponse ?? "" };
			}

			// note_qa / note_summary 走 contextBuilder → chatResponder
			callbacks.onStepStart?.("正在整理笔记上下文...");
			const cbResult = await contextBuilder(initialState);
			const fullState = { ...initialState, ...cbResult };
			callbacks.onStepDone?.();

			callbacks.onStepStart?.("正在生成回复...");
			const responder = createChatResponder(llmConfig, callbacks);
			const result = await responder(fullState);
			callbacks.onStepDone?.();
			return { aiResponse: result.aiResponse ?? "" };
		}

		const app = createChatWorkflow(llmConfig, obsidian, callbacks);
		const result = await app.invoke(initialState);
		return { aiResponse: result.aiResponse ?? "" };
	} finally {
		// 清理由 UI 层的 finally 处理
	}
}
