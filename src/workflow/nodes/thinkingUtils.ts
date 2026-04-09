import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM } from '../../services/llmService';
import { DetailCallbacks } from '../chatGraph';

const THINK_CLOSE = '</think>';

export function extractThinking(responseContent: unknown): { thinking: string; text: string } {
	const raw = typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent);
	const thinkEnd = raw.lastIndexOf(THINK_CLOSE);
	if (thinkEnd >= 0) {
		const thinking = raw.slice(0, thinkEnd).trim();
		const text = raw.slice(thinkEnd + THINK_CLOSE.length).trim();
		return { thinking, text };
	}
	return { thinking: '', text: raw };
}

/** 调用 LLM，提取 thinking 并通过回调推送 */
export async function invokeWithThinking(
	llm: ReturnType<typeof createLLM>,
	messages: Array<SystemMessage | HumanMessage>,
	callbacks: DetailCallbacks,
	detailPrefix: string,
): Promise<{ thinking: string; text: string }> {
	const response = await llm.invoke(messages, { signal: callbacks.signal });
	const { thinking, text } = extractThinking(response.content);
	if (thinking) {
		callbacks.onStepDetail?.(`${detailPrefix}${thinking}`);
	}
	return { thinking, text };
}
