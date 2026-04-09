import { ChatState } from '../types';

export type WritingAction = 'continue' | 'rewrite' | 'polish' | 'explain';

/** 将选中文本组装为 writingAssist 节点能识别的用户消息格式 */
export function buildWritingMessage(action: WritingAction, selectedText: string): string {
	return `[${action}]:\n\`\`\`\n${selectedText}\n\`\`\``;
}

const WRITING_SYSTEM_PROMPTS: Record<string, string> = {
	continue: '你是一个专业的写作助手。请根据用户提供的文本，自然地续写下去。保持原文的风格、语气和逻辑，输出续写部分即可，不需要重复原文。',
	rewrite: '你是一个专业的写作助手。请用不同的表达方式改写用户提供的文本，保持原意不变，但让表达更加清晰流畅。直接输出改写后的文本。',
	polish: '你是一个专业的写作助手。请润色用户提供的文本，优化语言表达、用词和句式，同时保持原意和风格。直接输出润色后的文本。',
	explain: '你是一个专业的写作助手。请用通俗易懂的语言解释用户提供的文本内容，帮助读者更好地理解。输出解释文字。',
};

export async function writingAssist(state: ChatState): Promise<Partial<ChatState>> {
	// 从 userInput 中解析操作类型和选中文本
	// 格式：[操作类型]：\n```\n选中文本\n```
	const actionMatch = state.userInput.match(/^\[(.+?)\]/);
	const action = actionMatch?.[1] ?? 'continue';

	const codeBlockMatch = state.userInput.match(/```\n?([\s\S]*?)\n?```/);
	const selectedText = codeBlockMatch?.[1]?.trim() ?? state.userInput;

	const systemPrompt = WRITING_SYSTEM_PROMPTS[action] ?? '你是一个专业的写作助手。请根据用户提供的文本，自然地续写下去。保持原文的风格、语气和逻辑，输出续写部分即可，不需要重复原文。';

	const messages: Array<{ role: string; content: string }> = [
		{ role: 'system', content: systemPrompt },
	];

	// 附带最近 10 条历史作为上下文
	for (const msg of state.chatHistory.slice(-10)) {
		messages.push({ role: msg.role, content: msg.content });
	}

	// 把当前笔记内容作为上下文，帮助 AI 更好地理解续写/改写的上下文
	let userContent = selectedText;
	if (state.currentNoteContent) {
		userContent = `当前笔记内容：\n${state.currentNoteContent}\n\n需要处理的文本：\n${selectedText}`;
	}

	messages.push({ role: 'user', content: userContent });

	return { contextMessages: messages };
}
