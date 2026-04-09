import { ChatOpenAI } from '@langchain/openai';

export interface LLMConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
}

export function createLLM(config: LLMConfig): ChatOpenAI {
	return new ChatOpenAI({
		modelName: config.model,
		apiKey: config.apiKey,
		configuration: {
			baseURL: config.baseUrl,
			apiKey: config.apiKey,
		},
		temperature: 0,
	});
}
