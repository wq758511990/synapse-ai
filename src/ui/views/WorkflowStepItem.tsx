import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { WorkflowStep } from '../../store/useSynapseStore';
import { cssVar } from '../cssUtils';

/**
 * 工作流步骤项：运行中展开显示完整 thinking，完成后折叠 + 划线
 */
export const WorkflowStepItem: React.FC<{ step: WorkflowStep }> = ({ step }) => {
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
