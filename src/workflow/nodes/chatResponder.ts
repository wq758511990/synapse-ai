import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createLLM, LLMConfig } from '../../services/llmService';
import { ChatState } from '../types';
import { StreamingCallbacks } from '../chatGraph';

const CHAT_SYSTEM = '你是一个友好的笔记助手，用中文简洁地回答用户的问题。';

export function createChatResponder(llmConfig: LLMConfig, callbacks: StreamingCallbacks = {}) {
	return async function chatResponder(state: ChatState): Promise<Partial<ChatState>> {
		const llm = createLLM(llmConfig);
		let messages: BaseMessage[];

		if (state.contextMessages.length > 0) {
			messages = state.contextMessages.map((msg) => {
				if (msg.role === 'system') return new SystemMessage(msg.content);
				if (msg.role === 'assistant') return new AIMessage(msg.content);
				return new HumanMessage(msg.content);
			});
		} else {
			messages = [new SystemMessage(CHAT_SYSTEM)];
			for (const msg of state.chatHistory.slice(-10)) {
				if (msg.role === 'assistant') {
					messages.push(new AIMessage(msg.content));
				} else {
					messages.push(new HumanMessage(msg.content));
				}
			}
			messages.push(new HumanMessage(state.userInput));
		}

		// 流式输出
		const stream = await llm.stream(messages, { signal: callbacks.signal });
		let fullResponse = '';
		for await (const chunk of stream) {
			const token = chunk.content as string;
			fullResponse += token;
			callbacks.onToken?.(token);
		}
		return { aiResponse: fullResponse };
	};
}
