import { marked } from 'marked';
import React, { useMemo } from 'react';
import { cssVar } from '../cssUtils';

/**
 * AI 回复气泡：支持 Markdown 渲染
 */
export const AssistantMessage: React.FC<{ content: string }> = ({ content }) => {
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
