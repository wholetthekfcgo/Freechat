export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	isPartial?: boolean;
	encodedTokens?: number[];
}

export interface ChatRequest {
	model: string;
	messages: Message[];
	stream?: boolean;
	temperature?: number;
	max_tokens?: number;
	enableThinking?: boolean;
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
	enableThinking: boolean;
	abortController: AbortController | null;
	canStopGeneration: boolean;
	tokenBucket: {
		remainingTokens: number;
		capacity: number;
		maxCreditsPerPeriod: number;
		lastRefillTime: number;
	};
}

export interface ChatConversation {
	id: string;
	title: string;
	messages: Message[];
	model: string;
	enableThinking?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ChatHistory {
	conversations: ChatConversation[];
	currentConversationId: string | null;
}
