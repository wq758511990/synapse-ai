import { SendHorizontal, ChevronDown, ChevronRight, CircleStop } from 'lucide-react';
import { marked } from 'marked';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LLMConfig } from '../../services/llmService';
import { useSynapseStore, WorkflowStep } from '../../store/useSynapseStore';
import { runChatWorkflow } from '../../workflow/chatGraph';

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

	const cssVar = (name: string, fallback?: string) => fallback ? `var(--${name}, ${fallback})` : `var(--${name})`;

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
			const { obsidian } = useSynapseStore.getState();
			if (!obsidian) throw new Error('ObsidianService 未初始化');
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
				{chatHistory.length === 0 && !isAiThinking && (
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

				{/* AI 思考中：工作流步骤 + 流式回复 */}
				{isAiThinking && (
					<div style={{ marginBottom: 8 }}>
						{/* 工作流步骤在上 */}
						{workflowSteps.length > 0 && (
							<div style={{ marginBottom: 6 }}>
								{workflowSteps.map((step, i) => (
									<WorkflowStepItem key={i} step={step} cssVar={cssVar} />
								))}
							</div>
						)}
						{/* 流式回复在下 */}
						{streamingContent && (
							<div style={{ display: 'flex', justifyContent: 'flex-start' }}>
								<AssistantMessage content={streamingContent} cssVar={cssVar} />
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

/**
 * 工作流步骤项：运行中展开显示完整 thinking，完成后折叠 + 划线
 */
const WorkflowStepItem: React.FC<{ step: WorkflowStep; cssVar: (n: string, f?: string) => string }> = ({ step, cssVar }) => {
	const isRunning = step.status === 'running';
	const hasDetail = step.detail.length > 0;

	// 运行中默认展开，完成后折叠
	const [expanded, setExpanded] = useState(true);

	useEffect(() => {
		if (step.status === 'done') {
			setExpanded(false);
		}
	}, [step.status]);

	return (
		<div style={{
			fontSize: 12,
			color: cssVar('text-muted'),
			marginBottom: 2,
			lineHeight: 1.4,
		}}>
			<div
				onClick={() => hasDetail ? setExpanded(!expanded) : undefined}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 4,
					padding: '2px 0',
					cursor: hasDetail ? 'pointer' : 'default',
				}}
			>
				{hasDetail ? (
					expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
				) : (
					<span style={{ width: 12 }} />
				)}
				{isRunning ? (
					<span style={{
						display: 'inline-block',
						width: 8,
						height: 8,
						border: `1.5px solid ${cssVar('text-muted')}`,
						borderRightColor: 'transparent',
						borderRadius: '50%',
						animation: 'synapse-spin 0.8s linear infinite',
						flexShrink: 0,
					}} />
				) : (
					<span style={{ fontSize: 10 }}>✓</span>
				)}
				<span style={{
					textDecoration: isRunning ? 'none' : 'line-through',
					opacity: isRunning ? 1 : 0.6,
				}}>{step.label}</span>
			</div>
			{expanded && hasDetail && (
				<div style={{
					marginLeft: 16,
					padding: '4px 8px',
					background: cssVar('background-secondary'),
					borderRadius: 6,
					fontSize: 11,
					lineHeight: 1.5,
					whiteSpace: 'pre-wrap',
					wordBreak: 'break-word',
					maxHeight: 150,
					overflow: 'auto',
				}}>
					{step.detail}
				</div>
			)}
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
