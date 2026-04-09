import { Notice, Plugin } from 'obsidian';
import { runChatWorkflow } from '../workflow/chatGraph';

const LLM_CONFIG = {
	apiKey: 'sk-9d7dd864e9b24418a8792818370443b5',
	baseUrl: 'https://api.deepseek.com/v1',
	model: 'deepseek-chat',
};

/**
 * 注册"生成笔记摘要"命令
 */
export function registerGenerateSummary(plugin: Plugin): void {
	plugin.addCommand({
		id: 'generate-summary',
		name: '生成笔记摘要',
		callback: async () => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) {
				new Notice('请先打开一个 Markdown 笔记');
				return;
			}

			const content = await plugin.app.vault.read(file);

			if (content.length < 10) {
				new Notice('笔记内容太短，无法生成摘要');
				return;
			}

			new Notice('Synapse AI 正在思考...');
			try {
				const result = await runChatWorkflow(LLM_CONFIG, {
					userInput: '请为这篇笔记生成摘要',
					chatHistory: [],
					currentNoteContent: content,
					intent: 'note_summary',
				});

				await plugin.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
					frontmatter['summary'] = result.aiResponse;
				});

				new Notice('Synapse AI 摘要已写入笔记');
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : '未知错误';
				new Notice('Synapse AI 生成摘要失败: ' + message);
				console.error('Synapse AI 错误:', error);
			}
		}
	});
}
