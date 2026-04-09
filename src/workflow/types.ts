import { ChatMessage } from '../store/useSynapseStore';

export type Intent = 'chat' | 'note_qa' | 'note_summary' | 'note_search' | 'note_tagging';

export interface ChatState {
	userInput: string;
	chatHistory: ChatMessage[];
	currentNoteContent: string | null;
	intent: Intent;
	contextMessages: Array<{ role: string; content: string }>;
	aiResponse: string;
}
