import { marked } from 'marked';
import React, { useMemo, useState } from 'react';
import { FileInput, Copy } from 'lucide-react';
import { cssVar } from '../cssUtils';

/**
 * AI 回复气泡：支持 Markdown 渲染 + 操作栏
 */
export const AssistantMessage: React.FC<{
	content: string;
	onInsert?: (content: string) => void;
}> = ({ content, onInsert }) => {
	const [hovered, setHovered] = useState(false);

	const html = useMemo(() => {
		marked.setOptions({ breaks: true, gfm: true });
		return marked.parse(content) as string;
	}, [content]);

	const handleCopy = () => {
		navigator.clipboard.writeText(content).catch(() => {});
	};

	return (
		<div
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{ position: 'relative', maxWidth: '80%' }}
		>
			<div
				className="synapse-ai-message"
				dangerouslySetInnerHTML={{ __html: html }}
				style={{
					padding: '8px 12px',
					borderRadius: 10,
					background: cssVar('background-secondary'),
					color: cssVar('text-normal'),
					lineHeight: 1.6,
					wordBreak: 'break-word',
				}}
			/>
			{hovered && (
				<div style={{
					display: 'flex',
					gap: 4,
					marginTop: 4,
				}}>
					{onInsert && (
						<button
							onClick={() => onInsert(content)}
							title="插入笔记"
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 4,
								padding: '2px 8px',
								borderRadius: 6,
								border: `1px solid ${cssVar('background-modifier-border')}`,
								background: cssVar('background-primary'),
								color: cssVar('text-muted'),
								cursor: 'pointer',
								fontSize: 11,
							}}
						>
							<FileInput size={12} />
							插入笔记
						</button>
					)}
					<button
						onClick={handleCopy}
						title="复制"
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 4,
							padding: '2px 8px',
							borderRadius: 6,
							border: `1px solid ${cssVar('background-modifier-border')}`,
							background: cssVar('background-primary'),
							color: cssVar('text-muted'),
							cursor: 'pointer',
							fontSize: 11,
						}}
					>
						<Copy size={12} />
						复制
					</button>
				</div>
			)}
		</div>
	);
};
