import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { LLMConfig } from '../services/llmService';
import { useSynapseStore } from '../store/useSynapseStore';
import { ChatView } from './views/ChatView';
import { cssVar } from './cssUtils';

interface AppProps {
	llmConfig: LLMConfig;
}

/**
 * 顶层 Shell：悬浮气泡 + 聊天面板
 * 样式全部使用 CSS 变量，自动适配 Obsidian 当前主题
 */
export const App: React.FC<AppProps> = ({ llmConfig }) => {
	const { isPanelVisible, togglePanel } = useSynapseStore();

	return (
		<div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
			{/* 悬浮气泡按钮 */}
			<button
				onClick={togglePanel}
				style={{
					width: 48,
					height: 48,
					borderRadius: '50%',
					border: 'none',
					background: cssVar('interactive-accent'),
					color: cssVar('text-on-accent', '#fff'),
					cursor: 'pointer',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
					transition: 'transform 0.2s',
					marginLeft: 'auto',
				}}
			>
				{isPanelVisible ? <X size={22} /> : <MessageCircle size={22} />}
			</button>

			{/* 聊天面板 */}
			{isPanelVisible && (
				<div style={{
					width: 380,
					height: 520,
					marginBottom: 12,
					borderRadius: 12,
					border: `1px solid ${cssVar('background-modifier-border')}`,
					background: cssVar('background-primary'),
					color: cssVar('text-normal'),
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
					fontFamily: cssVar('font-interface'),
					fontSize: 14,
				}}>
					<ChatView llmConfig={llmConfig} />
				</div>
			)}
		</div>
	);
};
