import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SendHorizontal } from 'lucide-react';
import { marked } from 'marked';
import { useSynapseStore } from '../../store/useSynapseStore';
import { runChatWorkflow } from '../../workflow/chatGraph';
import { LLMConfig } from '../../services/llmService';

const LLM_CONFIG: LLMConfig = {
	apiKey: 'sk-9d7dd864e9b24418a8792818370443b5',
	baseUrl: 'https://api.deepseek.com/v1',
	model: 'deepseek-chat',
};

/**
 * Chat 视图：消息列表 + 输入框
 */
export const ChatView: React.FC = () => {
	const { chatHistory, addMessage, isAiThinking, setAiThinking, currentNoteContent } = useSynapseStore();
	const [input, setInput] = useState('');
	const listRef = useRef<HTMLDivElement>(null);

	// 自动滚动到底部
	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [chatHistory, isAiThinking]);

	const cssVar = (name: string, fallback?: string) => fallback ? `var(--${name}, ${fallback})` : `var(--${name})`;

	const handleSend = async () => {
		const text = input.trim();
		if (!text || isAiThinking) return;

		setInput('');
		addMessage({ role: 'user', content: text });
		setAiThinking(true);

		try {
			const result = await runChatWorkflow(LLM_CONFIG, {
				userInput: text,
				chatHistory,
				currentNoteContent,
			});
			addMessage({ role: 'assistant', content: result.aiResponse || '（无响应）' });
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : '未知错误';
			addMessage({ role: 'assistant', content: `请求失败: ${msg}` });
		} finally {
			setAiThinking(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'text' }}>
			{/* 消息列表 */}
			<div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: 12, userSelect: 'text' }}>
				{chatHistory.length === 0 && (
					<div style={{
						textAlign: 'center',
						color: cssVar('text-muted'),
						marginTop: 40,
					}}>
						开始与你的笔记对话...
					</div>
				)}
				{chatHistory.map((msg, i) => (
					<div key={i} style={{
						display: 'flex',
						justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
						marginBottom: 8,
					}}>
						{msg.role === 'user' ? (
							<div style={{
								maxWidth: '80%',
								padding: '8px 12px',
								borderRadius: 10,
								background: cssVar('interactive-accent'),
								color: cssVar('text-on-accent', '#fff'),
								whiteSpace: 'pre-wrap',
								wordBreak: 'break-word',
								lineHeight: 1.5,
							}}>
								{msg.content}
							</div>
						) : (
							<AssistantMessage content={msg.content} cssVar={cssVar} />
						)}
					</div>
				))}
				{isAiThinking && (
					<div style={{ color: cssVar('text-muted'), padding: '4px 0' }}>
						Synapse AI 正在思考...
					</div>
				)}
			</div>

			{/* 输入区 */}
			<div style={{
				display: 'flex',
				gap: 8,
				padding: 8,
				borderTop: `1px solid ${cssVar('background-modifier-border')}`,
			}}>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="输入消息..."
					style={{
						flex: 1,
						padding: '8px 10px',
						borderRadius: 8,
						border: `1px solid ${cssVar('background-modifier-border')}`,
						background: cssVar('background-primary'),
						color: cssVar('text-normal'),
						outline: 'none',
						fontSize: 13,
					}}
				/>
				<button
					onClick={handleSend}
					disabled={isAiThinking || !input.trim()}
					style={{
						padding: '8px 10px',
						borderRadius: 8,
						border: 'none',
						background: cssVar('interactive-accent'),
						color: cssVar('text-on-accent', '#fff'),
						cursor: isAiThinking ? 'not-allowed' : 'pointer',
						display: 'flex',
						alignItems: 'center',
						opacity: isAiThinking || !input.trim() ? 0.5 : 1,
					}}
				>
					<SendHorizontal size={16} />
				</button>
			</div>
		</div>
	);
};

/**
 * AI 回复气泡：支持 Markdown 渲染
 */
const AssistantMessage: React.FC<{ content: string; cssVar: (name: string, fallback?: string) => string }> = ({ content, cssVar }) => {
	const html = useMemo(() => {
		marked.setOptions({ breaks: true, gfm: true });
		return marked.parse(content) as string;
	}, [content]);

	return (
		<div
			className="synapse-ai-message"
			dangerouslySetInnerHTML={{ __html: html }}
			style={{
				maxWidth: '80%',
				padding: '8px 12px',
				borderRadius: 10,
				background: cssVar('background-secondary'),
				color: cssVar('text-normal'),
				lineHeight: 1.6,
				wordBreak: 'break-word',
			}}
		/>
	);
};
