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

interface ChatViewProps {
	llmConfig: LLMConfig;
}

export const ChatView: React.FC<ChatViewProps> = ({ llmConfig }) => {
	const {
		chatHistory, addMessage, isAiThinking, setAiThinking,
		currentNoteContent, streamingContent, setStreamingContent, resetStreaming,
		workflowSteps, addWorkflowStep, updateLastStep, completeLastStep, clearWorkflowSteps,
		insertToNote,
	} = useSynapseStore();
	const [input, setInput] = useState('');
	const listRef = useRef<HTMLDivElement>(null);

	// 执行工作流的通用函数 — 同时供 handleSend 和 pendingMessage 使用
	const sendMessage = (text: string, historyOverride?: typeof chatHistory) => {
		if (!text || isAiThinking) return;

		addMessage({ role: 'user', content: text });
		setAiThinking(true);
		resetStreaming();
		clearWorkflowSteps();

		const controller = new AbortController();
		useSynapseStore.getState().setAbortController(controller);

		let accumulated = '';
		const run = async () => {
			try {
				const obsidian = getObsidianService();
				const history = historyOverride ?? chatHistory;
				const result = await runChatWorkflow(llmConfig, obsidian, {
					userInput: text,
					chatHistory: history,
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
				if (controller.signal.aborted) {
					if (accumulated) {
						addMessage({ role: 'assistant', content: accumulated });
					}
				} else {
					const msg = error instanceof Error ? error.message : '未知错误';
					addMessage({ role: 'assistant', content: `请求失败: ${msg}` });
				}
			} finally {
				useSynapseStore.getState().setAbortController(null);
				setAiThinking(false);
			}
		};
		void run();
	};

	// 检测外部触发的 pendingMessage（右键菜单 / 命令面板）
	// 组件挂载时检查一次 store，处理"先设 pendingMessage 再打开面板"的场景
	const hasProcessedPending = useRef(false);
	useEffect(() => {
		if (hasProcessedPending.current) return;
		const pending = useSynapseStore.getState().pendingMessage;
		if (pending && !isAiThinking) {
			hasProcessedPending.current = true;
			useSynapseStore.setState({ pendingMessage: null });
			// pendingMessage 触发时，chatHistory 还没包含当前消息，用 slice(0, -1) 不合适
			// 直接用当前 chatHistory 快照作为上下文
			sendMessage(pending);
		}
	});

	// 重置标记，允许下次 pendingMessage 被处理
	useEffect(() => {
		if (!useSynapseStore.getState().pendingMessage) {
			hasProcessedPending.current = false;
		}
	});

	// 自动滚动到底部
	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [chatHistory, isAiThinking, streamingContent, workflowSteps]);

	const handleSend = () => {
		const text = input.trim();
		if (!text || isAiThinking) return;
		setInput('');
		sendMessage(text);
	};

	const handleStop = () => {
		useSynapseStore.getState().abortChat();
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
							<AssistantMessage content={msg.content} onInsert={insertToNote} />
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
						onClick={handleSend}
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
