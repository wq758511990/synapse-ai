import { SendHorizontal, CircleStop } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { LLMConfig } from '../../services/llmService';
import { getObsidianService } from '../../services/serviceContainer';
import { useSynapseStore } from '../../store/useSynapseStore';
import { runChatWorkflow } from '../../workflow/chatGraph';
import { cssVar } from '../cssUtils';
import { AssistantMessage } from './AssistantMessage';
import { EmptyState } from './EmptyState';
import { WorkflowStepItem } from './WorkflowStepItem';

const LLM_CONFIG: LLMConfig = {
	apiKey: 'sk-9d7dd864e9b24418a8792818370443b5',
	baseUrl: 'https://api.deepseek.com/v1',
	model: 'deepseek-reasoner',
};

export const ChatView: React.FC = () => {
	const {
		chatHistory, addMessage, isAiThinking, setAiThinking,
		currentNoteContent, streamingContent, setStreamingContent, resetStreaming,
		workflowSteps, addWorkflowStep, updateLastStep, completeLastStep, clearWorkflowSteps,
	} = useSynapseStore();
	const [input, setInput] = useState('');
	const listRef = useRef<HTMLDivElement>(null);

	// 自动滚动到底部
	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [chatHistory, isAiThinking, streamingContent, workflowSteps]);

	const handleSend = async () => {
		const text = input.trim();
		if (!text || isAiThinking) return;

		setInput('');
		addMessage({ role: 'user', content: text });
		setAiThinking(true);
		resetStreaming();
		clearWorkflowSteps();

		const controller = new AbortController();
		const { setAbortController } = useSynapseStore.getState();
		setAbortController(controller);

		let accumulated = '';
		try {
			const obsidian = getObsidianService();
			const result = await runChatWorkflow(LLM_CONFIG, obsidian, {
				userInput: text,
				chatHistory,
				currentNoteContent,
			}, {
				onToken: (token) => {
					accumulated += token;
					setStreamingContent(accumulated);
				},
				onStepStart: (label) => addWorkflowStep(label),
				onStepDetail: (detail) => updateLastStep(detail),
				onStepDone: () => completeLastStep(),
				signal: controller.signal,
			});

			resetStreaming();
			clearWorkflowSteps();
			addMessage({ role: 'assistant', content: result.aiResponse || '（无响应）' });
		} catch (error: unknown) {
			resetStreaming();
			clearWorkflowSteps();
			// 用户主动停止时不显示错误
			if (controller.signal.aborted) {
				if (accumulated) {
					addMessage({ role: 'assistant', content: accumulated });
				}
			} else {
				const msg = error instanceof Error ? error.message : '未知错误';
				addMessage({ role: 'assistant', content: `请求失败: ${msg}` });
			}
		} finally {
			setAbortController(null);
			setAiThinking(false);
		}
	};

	const handleStop = () => {
		useSynapseStore.getState().abortChat();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void handleSend();
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'text' }}>
			{/* 消息列表 */}
			<div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: 12, userSelect: 'text' }}>
				{chatHistory.length === 0 && !isAiThinking && <EmptyState />}
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
							<AssistantMessage content={msg.content} />
						)}
					</div>
				))}

				{/* AI 思考中：工作流步骤 + 流式回复 */}
				{isAiThinking && (
					<div style={{ marginBottom: 8 }}>
						{/* 工作流步骤在上 */}
						{workflowSteps.length > 0 && (
							<div style={{ marginBottom: 6 }}>
								{workflowSteps.map((step, i) => (
									<WorkflowStepItem key={i} step={step} />
								))}
							</div>
						)}
						{/* 流式回复在下 */}
						{streamingContent && (
							<div style={{ display: 'flex', justifyContent: 'flex-start' }}>
								<AssistantMessage content={streamingContent} />
							</div>
						)}
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
				{isAiThinking ? (
					<button
						onClick={handleStop}
						style={{
							padding: '8px 10px',
							borderRadius: 8,
							border: 'none',
							background: cssVar('text-error', 'var(--text-error)'),
							color: '#fff',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
						}}
					>
						<CircleStop size={16} />
					</button>
				) : (
					<button
						onClick={() => void handleSend()}
						disabled={!input.trim()}
						style={{
							padding: '8px 10px',
							borderRadius: 8,
							border: 'none',
							background: cssVar('interactive-accent'),
							color: cssVar('text-on-accent', '#fff'),
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							opacity: !input.trim() ? 0.5 : 1,
						}}
					>
						<SendHorizontal size={16} />
					</button>
				)}
			</div>
		</div>
	);
};
