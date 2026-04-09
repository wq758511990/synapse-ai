import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM, LLMConfig } from '../../services/llmService';
import { ChatState, Intent } from '../types';

const SYSTEM_PROMPT = `你是意图分类器。根据用户消息返回一个 JSON 对象：{"intent": "chat"|"note_qa"|"note_summary"}

分类规则：
- chat: 闲聊、一般问答，不需要参考当前笔记内容
- note_qa: 需要基于当前笔记内容来回答（如"这篇讲了什么"、"帮我分析这段内容"、"帮我改一下这段"）
- note_summary: 需要对当前笔记生成摘要或总结

只返回 JSON，不要任何其他文字。`;

export function createIntentClassifier(llmConfig: LLMConfig) {
	return async function intentClassifier(state: ChatState): Promise<Partial<ChatState>> {
		const llm = createLLM(llmConfig);
		const response = await llm.invoke([
			new SystemMessage(SYSTEM_PROMPT),
			new HumanMessage(state.userInput),
		]);

		const text = (response.content as string).trim();
		// 尝试从回复中提取 JSON
		const jsonMatch = text.match(/\{[^}]+\}/);
		if (!jsonMatch) {
			// 解析失败，默认为 chat
			return { intent: 'chat' as Intent };
		}

		try {
			const parsed = JSON.parse(jsonMatch[0]);
			const validIntents: Intent[] = ['chat', 'note_qa', 'note_summary'];
			const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'chat';
			return { intent };
		} catch {
			return { intent: 'chat' as Intent };
		}
	};
}
