import { ChatState } from '../types';

const NOTE_QA_SYSTEM = '你是一个专业的笔记助理。请根据用户提供的笔记内容，准确回答用户的问题。';
const NOTE_SUMMARY_SYSTEM = '你是一个专业的笔记助理。请根据用户提供的笔记内容，生成一段简洁的摘要（50字以内）。只需返回摘要文字本身，不要包含任何其他修饰语。';

export async function contextBuilder(state: ChatState): Promise<Partial<ChatState>> {
	const messages: Array<{ role: string; content: string }> = [];

	// 根据 intent 选择 system prompt
	const systemPrompt = state.intent === 'note_summary' ? NOTE_SUMMARY_SYSTEM : NOTE_QA_SYSTEM;
	messages.push({ role: 'system', content: systemPrompt });

	// 附带最近 10 条历史
	for (const msg of state.chatHistory.slice(-10)) {
		messages.push({ role: msg.role, content: msg.content });
	}

	// 组装用户消息，附带笔记内容
	if (state.currentNoteContent) {
		const userContent = `当前笔记内容：\n${state.currentNoteContent}\n\n用户问题：${state.userInput}`;
		messages.push({ role: 'user', content: userContent });
	} else {
		messages.push({ role: 'user', content: state.userInput });
	}

	return { contextMessages: messages };
}
