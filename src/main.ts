import { Plugin } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { App } from './ui/App';
import { useSynapseStore } from './store/useSynapseStore';
import { registerGenerateSummary } from './commands/generateSummary';

const CONTAINER_ID = 'synapse-ai-root';

export default class SynapseAI extends Plugin {
	private root: Root | null = null;

	async onload() {
		// 初始化 store
		const store = useSynapseStore.getState();
		store.initApp(this.app);

		// 监听活动笔记切换，自动刷新上下文
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				void useSynapseStore.getState().refreshCurrentNote();
			})
		);

		// 注册旧命令
		registerGenerateSummary(this);

		// 创建 React 挂载容器
		const container = document.createElement('div');
		container.id = CONTAINER_ID;
		document.body.appendChild(container);

		this.root = createRoot(container);
		this.root.render(React.createElement(App));
	}

	onunload() {
		// 卸载 React 并移除 DOM 节点
		this.root?.unmount();
		this.root = null;
		document.getElementById(CONTAINER_ID)?.remove();
	}
}
