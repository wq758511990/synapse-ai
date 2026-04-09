import { Annotation, StateGraph } from "@langchain/langgraph";
import { LLMConfig } from "../services/llmService";
import { ObsidianService } from "../services/ObsidianService";
import { ChatMessage } from "../store/useSynapseStore";
import { createChatResponder } from "./nodes/chatResponder";
import { contextBuilder } from "./nodes/contextBuilder";
import { createIntentClassifier } from "./nodes/intentClassifier";
import { createNoteSearcher } from "./nodes/noteSearcher";
import { createNoteTagger } from "./nodes/noteTagger";
import { writingAssist } from "./nodes/writingAssist";
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
	note_tagging: "noteTagger",
	writing_assist: "writingAssist",
};

// 节点进度提示
const NODE_LABELS: Record<string, string> = {
	intentClassifier: "正在分析你的意图...",
	contextBuilder: "正在整理笔记上下文...",
	noteSearcher: "正在搜索相关笔记...",
	noteTagger: "正在为笔记打标签...",
	writingAssist: "正在处理写作请求...",
	chatResponder: "正在生成回复...",
};

function routeByIntent(state: typeof ChatAnnotation.State): string {
	return INTENT_TO_NODE[state.intent] ?? "chatResponder";
}

/** 流式回调（仅 chatResponder 使用） */
export interface StreamingCallbacks {
	onToken?: (token: string) => void;
	signal?: AbortSignal;
}

/** 步骤进度回调（withStepTracking 使用） */
export interface StepCallbacks {
	onStepStart?: (label: string) => void;
	onStepDone?: () => void;
}

/** thinking 内容回调（intentClassifier、noteSearcher 使用） */
export interface DetailCallbacks {
	onStepDetail?: (detail: string) => void;
	signal?: AbortSignal;
}

/** 组合接口 — 调用方使用 */
export interface WorkflowCallbacks extends StreamingCallbacks, StepCallbacks, DetailCallbacks {}

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
	const noteTagger = createNoteTagger(llmConfig, obsidian, callbacks);

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
		.addNode("noteTagger", withStepTracking("noteTagger", noteTagger, callbacks))
		.addNode("writingAssist", withStepTracking("writingAssist", writingAssist, callbacks))
		.addEdge("__start__", "intentClassifier")
		.addConditionalEdges("intentClassifier", routeByIntent, {
			chatResponder: "chatResponder",
			contextBuilder: "contextBuilder",
			noteSearcher: "noteSearcher",
			noteTagger: "noteTagger",
			writingAssist: "writingAssist",
		})
		.addEdge("contextBuilder", "chatResponder")
		.addEdge("noteSearcher", "chatResponder")
		.addEdge("noteTagger", "chatResponder")
		.addEdge("writingAssist", "chatResponder")
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
	const initialState = {
		userInput: input.userInput,
		chatHistory: input.chatHistory,
		currentNoteContent: input.currentNoteContent,
		intent: input.intent ?? "chat",
		contextMessages: [],
		aiResponse: "",
	};

	const app = createChatWorkflow(llmConfig, obsidian, callbacks);
	const result = await app.invoke(initialState, { signal: callbacks.signal });
	return { aiResponse: result.aiResponse ?? "" };
}
