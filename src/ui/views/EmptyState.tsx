import React from 'react';
import { cssVar } from '../cssUtils';

/**
 * 空状态引导：展示插件功能简介
 */
export const EmptyState: React.FC = () => (
	<div style={{
		color: cssVar('text-muted'),
		marginTop: 32,
		padding: '0 4px',
		fontSize: 13,
		lineHeight: 1.8,
	}}>
		<div style={{ textAlign: 'center', marginBottom: 16, fontSize: 14, color: cssVar('text-normal') }}>
			开始与你的笔记对话
		</div>
		<div style={{ marginBottom: 8, opacity: 0.85 }}>我可以帮你：</div>
		{[
			['闲聊问答', '随便聊聊天，问我任何问题'],
			['笔记问答', '「这篇讲了什么」「帮我分析这段内容」'],
			['笔记摘要', '「帮我总结一下当前笔记」'],
			['笔记搜索', '「帮我找关于 XX 的笔记」'],
		].map(([title, desc]) => (
			<div key={title} style={{
				padding: '6px 10px',
				marginBottom: 4,
				borderRadius: 6,
				background: cssVar('background-secondary'),
				fontSize: 12,
			}}>
				<span style={{ color: cssVar('text-normal'), fontWeight: 500 }}>{title}</span>
				<span style={{ marginLeft: 6, opacity: 0.7 }}>{desc}</span>
			</div>
		))}
	</div>
);
