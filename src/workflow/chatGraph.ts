import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatMessage } from '../store/useSynapseStore';
import { Intent } from './types';
import { createIntentClassifier } from './nodes/intentClassifier';
import { contextBuilder } from './nodes/contextBuilder';
import { createChatResponder } from './nodes/chatResponder';
import { LLMConfig } from '../services/llmService';

// 定义 Graph State
const ChatAnnotation = Annotation.Root({
	userInput: Annotation<string>(),
	chatHistory: Annotation<ChatMessage[]>,
	currentNoteContent: Annotation<string | null>,
	intent: Annotation<Intent>(),
	contextMessages: Annotation<Array<{ role: string; content: string }>>,
	aiResponse: Annotation<string>(),
});

// 条件边：根据 intent 路由到不同节点
function routeByIntent(state: typeof ChatAnnotation.State): string {
	if (state.intent === 'chat') return 'chatResponder';
	return 'contextBuilder';
}

// 构建并编译 Graph
export function createChatWorkflow(llmConfig: LLMConfig) {
	const intentClassifier = createIntentClassifier(llmConfig);
	const chatResponder = createChatResponder(llmConfig);

	const graph = new StateGraph(ChatAnnotation)
		.addNode('intentClassifier', intentClassifier)
		.addNode('contextBuilder', contextBuilder)
		.addNode('chatResponder', chatResponder)
		.addEdge('__start__', 'intentClassifier')
		.addConditionalEdges('intentClassifier', routeByIntent, {
			chatResponder: 'chatResponder',
			contextBuilder: 'contextBuilder',
		})
		.addEdge('contextBuilder', 'chatResponder')
		.addEdge('chatResponder', '__end__');

	return graph.compile();
}

// 对外暴露的入口函数
export async function runChatWorkflow(
	llmConfig: LLMConfig,
	input: {
		userInput: string;
		chatHistory: ChatMessage[];
		currentNoteContent: string | null;
		intent?: Intent;  // 可选：直接指定意图，跳过 AI 识别
	}
): Promise<{ aiResponse: string }> {
	const app = createChatWorkflow(llmConfig);

	const initialState = {
		userInput: input.userInput,
		chatHistory: input.chatHistory,
		currentNoteContent: input.currentNoteContent,
		intent: input.intent ?? 'chat',
		contextMessages: [],
		aiResponse: '',
	};

	// 如果直接指定了 intent，跳过 intentClassifier 节点
	if (input.intent) {
		// 直接手动路由
		const cbResult = await contextBuilder(initialState);
		const fullState = { ...initialState, ...cbResult };
		const responder = createChatResponder(llmConfig);
		const result = await responder(fullState);
		return { aiResponse: result.aiResponse ?? '' };
	}

	const result = await app.invoke(initialState);
	return { aiResponse: result.aiResponse ?? '' };
}
