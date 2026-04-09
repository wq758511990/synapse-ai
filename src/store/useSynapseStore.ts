import { create } from 'zustand';
import { App } from 'obsidian';
import { ObsidianService } from '../services/ObsidianService';

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

interface SynapseState {
	app: App | null;
	obsidian: ObsidianService | null;
	activeTab: 'chat' | 'management';
	chatHistory: ChatMessage[];
	isAiThinking: boolean;
	isPanelVisible: boolean;
	currentNoteContent: string | null;
	currentNotePath: string | null;

	initApp: (app: App) => void;
	setActiveTab: (tab: 'chat' | 'management') => void;
	addMessage: (msg: ChatMessage) => void;
	clearHistory: () => void;
	setAiThinking: (val: boolean) => void;
	togglePanel: () => void;
	refreshCurrentNote: () => Promise<void>;
}

export const useSynapseStore = create<SynapseState>((set, get) => ({
	app: null,
	obsidian: null,
	activeTab: 'chat',
	chatHistory: [],
	isAiThinking: false,
	isPanelVisible: false,
	currentNoteContent: null,
	currentNotePath: null,

	initApp: (app) => set({ app, obsidian: new ObsidianService(app) }),
	setActiveTab: (tab) => set({ activeTab: tab }),
	addMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
	clearHistory: () => set({ chatHistory: [] }),
	setAiThinking: (val) => set({ isAiThinking: val }),
	togglePanel: () => set((s) => ({ isPanelVisible: !s.isPanelVisible })),
	refreshCurrentNote: async () => {
		const { obsidian, app } = get();
		if (!obsidian || !app) return;
		const file = app.workspace.getActiveFile();
		const newPath = file ? file.path : null;
		// 笔记没变，跳过
		if (newPath === get().currentNotePath) return;
		const content = file ? await obsidian.getActiveNoteContent() : null;
		set({ currentNoteContent: content, currentNotePath: newPath });
	},
}));
