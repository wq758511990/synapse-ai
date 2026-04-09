import { Plugin, MarkdownView } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { App } from './ui/App';
import { SynapseSettingTab } from './ui/SynapseSettingTab';
import { useSynapseStore } from './store/useSynapseStore';
import { initServices } from './services/serviceContainer';
import { LLMConfig } from './services/llmService';
import { buildWritingMessage, WritingAction } from './workflow/nodes/writingAssist';

export interface SynapseAISettings {
	llm: LLMConfig;
}

const DEFAULT_SETTINGS: SynapseAISettings = {
	llm: {
		apiKey: 'sk-9d7dd864e9b24418a8792818370443b5',
		baseUrl: 'https://api.deepseek.com/v1',
		model: 'deepseek-chat',
	},
};

const CONTAINER_ID = 'synapse-ai-root';

export default class SynapseAI extends Plugin {
	private root: Root | null = null;
	settings: SynapseAISettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SynapseSettingTab(this.app, this));

		// 初始化服务
		initServices(this.app);

		// 监听活动笔记切换，自动刷新上下文
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				void useSynapseStore.getState().refreshCurrentNote();
			})
		);

		// 注册右键菜单：选中文本后显示 AI 写作辅助选项
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor) => {
				const selection = editor.getSelection();
				if (!selection.trim()) return;

				const items: Array<{ title: string; action: WritingAction }> = [
					{ title: 'AI 续写', action: 'continue' },
					{ title: 'AI 改写', action: 'rewrite' },
					{ title: 'AI 润色', action: 'polish' },
					{ title: 'AI 解释', action: 'explain' },
				];

				for (const item of items) {
					menu.addItem((menuItem) => {
						menuItem
							.setTitle(item.title)
							.onClick(() => {
								const message = buildWritingMessage(item.action, selection);
								const store = useSynapseStore.getState();
								// 先设 pendingMessage，再打开面板
								// 这样 ChatView 挂载时就能立即读到并处理
								useSynapseStore.setState({ pendingMessage: message });
								if (!store.isPanelVisible) {
									store.togglePanel();
								}
							});
					});
				}
			})
		);

		// 注册命令：切换聊天面板
		this.addCommand({
			id: 'toggle-panel',
			name: '切换聊天面板',
			callback: () => useSynapseStore.getState().togglePanel(),
		});

		// 注册写作辅助命令
		const writingCommands: Array<{ id: string; name: string; action: WritingAction }> = [
			{ id: 'writing-continue', name: 'AI 续写', action: 'continue' },
			{ id: 'writing-rewrite', name: 'AI 改写', action: 'rewrite' },
			{ id: 'writing-polish', name: 'AI 润色', action: 'polish' },
			{ id: 'writing-explain', name: 'AI 解释', action: 'explain' },
		];

		for (const cmd of writingCommands) {
			this.addCommand({
				id: cmd.id,
				name: cmd.name,
				callback: () => {
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (!view) return;
					const selection = view.editor.getSelection();
					if (!selection.trim()) {
						return;
					}
					const message = buildWritingMessage(cmd.action, selection);
					const store = useSynapseStore.getState();
					useSynapseStore.setState({ pendingMessage: message });
					if (!store.isPanelVisible) {
						store.togglePanel();
					}
				},
			});
		}

		// 创建 React 挂载容器
		const container = document.createElement('div');
		container.id = CONTAINER_ID;
		document.body.appendChild(container);

		this.root = createRoot(container);
		this.root.render(React.createElement(App, { llmConfig: this.settings.llm }));
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<SynapseAISettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			llm: { ...DEFAULT_SETTINGS.llm, ...(data?.llm ?? {}) },
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		// 卸载 React 并移除 DOM 节点
		this.root?.unmount();
		this.root = null;
		document.getElementById(CONTAINER_ID)?.remove();
	}
}
