import { create } from 'zustand';
import { getObsidianService, getApp } from '../services/serviceContainer';

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface WorkflowStep {
	label: string;
	detail: string;
	status: 'running' | 'done';
}

interface SynapseState {
	chatHistory: ChatMessage[];
	isAiThinking: boolean;
	streamingContent: string;
	workflowSteps: WorkflowStep[];
	isPanelVisible: boolean;
	currentNoteContent: string | null;
	currentNotePath: string | null;
	abortController: AbortController | null;

	addMessage: (msg: ChatMessage) => void;
	clearHistory: () => void;
	setAiThinking: (val: boolean) => void;
	setStreamingContent: (content: string) => void;
	resetStreaming: () => void;
	addWorkflowStep: (label: string) => void;
	updateLastStep: (detail: string) => void;
	completeLastStep: () => void;
	clearWorkflowSteps: () => void;
	togglePanel: () => void;
	refreshCurrentNote: () => Promise<void>;
	setAbortController: (ctrl: AbortController | null) => void;
	abortChat: () => void;
}

export const useSynapseStore = create<SynapseState>((set, get) => ({
	chatHistory: [],
	isAiThinking: false,
	streamingContent: '',
	workflowSteps: [],
	isPanelVisible: false,
	currentNoteContent: null,
	currentNotePath: null,
	abortController: null,

	addMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
	clearHistory: () => set({ chatHistory: [] }),
	setAiThinking: (val) => set({ isAiThinking: val }),
	setStreamingContent: (content) => set({ streamingContent: content }),
	resetStreaming: () => set({ streamingContent: '' }),
	addWorkflowStep: (label) =>
		set((s) => ({
			workflowSteps: [...s.workflowSteps, { label, detail: '', status: 'running' }],
		})),
	updateLastStep: (detail) =>
		set((s) => {
			const steps = s.workflowSteps.map((step, i) =>
				i === s.workflowSteps.length - 1 ? { ...step, detail } : step
			);
			return { workflowSteps: steps };
		}),
	completeLastStep: () =>
		set((s) => {
			const steps = s.workflowSteps.map((step, i) =>
				i === s.workflowSteps.length - 1 ? { ...step, status: 'done' as const } : step
			);
			return { workflowSteps: steps };
		}),
	clearWorkflowSteps: () => set({ workflowSteps: [] }),
	togglePanel: () => set((s) => ({ isPanelVisible: !s.isPanelVisible })),
	setAbortController: (ctrl) => set({ abortController: ctrl }),
	abortChat: () => {
		const { abortController } = get();
		if (abortController) {
			abortController.abort();
			set({ abortController: null });
		}
	},
	refreshCurrentNote: async () => {
		const obsidian = getObsidianService();
		const app = getApp();
		const file = app.workspace.getActiveFile();
		const newPath = file ? file.path : null;
		if (newPath === get().currentNotePath) return;
		const content = file ? await obsidian.getActiveNoteContent() : null;
		set({ currentNoteContent: content, currentNotePath: newPath });
	},
}));
