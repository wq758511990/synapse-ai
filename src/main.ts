import { Plugin } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { App } from './ui/App';
import { SynapseSettingTab } from './ui/SynapseSettingTab';
import { useSynapseStore } from './store/useSynapseStore';
import { initServices } from './services/serviceContainer';
import { LLMConfig } from './services/llmService';

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
