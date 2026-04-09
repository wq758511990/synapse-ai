import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useSynapseStore } from '../store/useSynapseStore';
import { ChatView } from './views/ChatView';

/**
 * 顶层 Shell：悬浮气泡 + 聊天面板
 * 样式全部使用 CSS 变量，自动适配 Obsidian 当前主题
 */
export const App: React.FC = () => {
	const { isPanelVisible, activeTab, setActiveTab, togglePanel } = useSynapseStore();

	// 读取 CSS 变量的辅助函数
	const cssVar = (name: string, fallback?: string) => fallback ? `var(--${name}, ${fallback})` : `var(--${name})`;

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
					{/* 顶部 Tab 栏 */}
					<div style={{
						display: 'flex',
						borderBottom: `1px solid ${cssVar('background-modifier-border')}`,
					}}>
						{(['chat', 'management'] as const).map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								style={{
									flex: 1,
									padding: '10px 0',
									border: 'none',
									background: 'transparent',
									color: activeTab === tab
										? cssVar('interactive-accent')
										: cssVar('text-muted'),
									borderBottom: activeTab === tab
										? `2px solid ${cssVar('interactive-accent')}`
										: '2px solid transparent',
									cursor: 'pointer',
									fontWeight: activeTab === tab ? 600 : 400,
									fontSize: 13,
								}}
							>
								{tab === 'chat' ? 'Chat' : 'Management'}
							</button>
						))}
					</div>

					{/* 视图渲染区 */}
					<div style={{ flex: 1, overflow: 'auto' }}>
						{activeTab === 'chat' && <ChatView />}
						{activeTab === 'management' && (
							<div style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								height: '100%',
								color: cssVar('text-muted'),
							}}>
								Management — 敬请期待
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
