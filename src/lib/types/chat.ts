export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

export interface ChatRequest {
	model: string;
	messages: Message[];
	stream?: boolean;
	temperature?: number;
	max_tokens?: number;
}

export interface ChatResponse {
	id: string;
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	model: string;
}

export interface ChatState {
	messages: Message[];
	isLoading: boolean;
	error: string | null;
	currentModel: string;
	abortController: AbortController | null;
	canStopGeneration: boolean;
}

export interface ChatConversation {
	id: string;
	title: string;
	messages: Message[];
	model: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ChatHistory {
	conversations: ChatConversation[];
	currentConversationId: string | null;
}
