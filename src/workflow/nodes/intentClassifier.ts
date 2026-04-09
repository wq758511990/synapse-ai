import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM, LLMConfig } from '../../services/llmService';
import { ChatState, Intent } from '../types';
import { DetailCallbacks } from '../chatGraph';
import { extractThinking } from './thinkingUtils';

const SYSTEM_PROMPT = `你是意图分类器。根据用户消息返回一个 JSON 对象：{"intent": "chat"|"note_qa"|"note_summary"|"note_search"|"note_tagging"|"writing_assist"}

分类规则：
- chat: 闲聊、一般问答，不需要参考笔记内容
- note_qa: 需要基于当前笔记内容来回答（如"这篇讲了什么"、"帮我分析这段内容"、"帮我改一下这段"）
- note_summary: 需要对当前笔记生成摘要或总结
- note_search: 需要在整个笔记库中搜索相关笔记（如"帮我找关于XX的笔记"、"我之前写的关于XX的内容在哪里"、"搜索一下相关笔记"）
- note_tagging: 需要给笔记添加标签（如"给这篇笔记打标签"、"帮我给所有笔记打标签"、"给XX文件夹下的笔记添加标签"）
- writing_assist: AI写作辅助，用户消息以方括号开头标记操作类型，如"[续写]"、"[改写]"、"[润色]"、"[解释]"后跟代码块包裹的选中文本

只返回 JSON，不要任何其他文字。`;

export function createIntentClassifier(llmConfig: LLMConfig, callbacks: DetailCallbacks = {}) {
	return async function intentClassifier(state: ChatState): Promise<Partial<ChatState>> {
		// 如果调用方已经指定了 intent，跳过分类
		if (state.intent && state.intent !== 'chat') {
			return { intent: state.intent };
		}

		const llm = createLLM(llmConfig);
		const response = await llm.invoke([
			new SystemMessage(SYSTEM_PROMPT),
			new HumanMessage(state.userInput),
		], { signal: callbacks.signal });

		const { thinking, text } = extractThinking(response.content);

		if (thinking) {
			callbacks.onStepDetail?.(thinking);
		}

		console.warn('[Synapse AI] AI 分类处理后文本:', text);

		// 从回复中提取最后一个合法的 JSON 对象
		// deepseek-reasoner 会在 content 中混杂推理文本，简单正则可能匹配到截断的 JSON
		let parsed: Record<string, unknown> | null = null;
		const allBraces = [...text.matchAll(/\{[^}]*\}/g)];
		for (let i = allBraces.length - 1; i >= 0; i--) {
			const match = allBraces[i];
			if (!match?.[0]) continue;
			try {
				parsed = JSON.parse(match[0]) as Record<string, unknown>;
				break;
			} catch {
				continue;
			}
		}

		if (!parsed) {
			console.warn('[Synapse AI] AI 分类未找到合法 JSON，fallback chat');
			return { intent: 'chat' as Intent };
		}

		console.warn('[Synapse AI] AI 分类解析结果:', parsed);
		const validIntents: string[] = ['chat', 'note_qa', 'note_summary', 'note_search', 'note_tagging', 'writing_assist'];
		const raw = parsed.intent;
		const intent = (typeof raw === 'string' && validIntents.includes(raw)) ? raw as Intent : 'chat' as Intent;
		return { intent };
	};
}
