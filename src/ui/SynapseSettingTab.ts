import { App, PluginSettingTab, Setting } from 'obsidian';
import type SynapseAI from '../main';

export class SynapseSettingTab extends PluginSettingTab {
	plugin: SynapseAI;

	constructor(app: App, plugin: SynapseAI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('DeepSeek API 密钥')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.llm.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.llm.apiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Base URL')
			.setDesc('API 请求地址')
			.addText((text) => {
				text
					.setPlaceholder('https://api.deepseek.com/v1')
					.setValue(this.plugin.settings.llm.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.llm.baseUrl = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('使用的模型名称（deepseek-chat 为免费额度可用的普通模型）')
			.addText((text) => {
				text
					.setPlaceholder('deepseek-chat')
					.setValue(this.plugin.settings.llm.model)
					.onChange(async (value) => {
						this.plugin.settings.llm.model = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
