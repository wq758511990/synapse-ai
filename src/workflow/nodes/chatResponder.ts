import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createLLM, LLMConfig } from '../../services/llmService';
import { ChatState } from '../types';

const CHAT_SYSTEM = '你是一个友好的笔记助手，用中文简洁地回答用户的问题。';

export function createChatResponder(llmConfig: LLMConfig) {
	return async function chatResponder(state: ChatState): Promise<Partial<ChatState>> {
		const llm = createLLM(llmConfig);

		if (state.contextMessages.length > 0) {
			// 有预构建的 context（来自 contextBuilder），直接用
			const messages: BaseMessage[] = state.contextMessages.map((msg) => {
				if (msg.role === 'system') return new SystemMessage(msg.content);
				if (msg.role === 'assistant') return new AIMessage(msg.content);
				return new HumanMessage(msg.content);
			});
			const response = await llm.invoke(messages);
			return { aiResponse: response.content as string };
		}

		// 纯对话模式（intent === 'chat'）
		const messages: BaseMessage[] = [new SystemMessage(CHAT_SYSTEM)];
		for (const msg of state.chatHistory.slice(-10)) {
			if (msg.role === 'assistant') {
				messages.push(new AIMessage(msg.content));
			} else {
				messages.push(new HumanMessage(msg.content));
			}
		}
		messages.push(new HumanMessage(state.userInput));

		const response = await llm.invoke(messages);
		return { aiResponse: response.content as string };
	};
}
