import type { Message, ChatState } from '$lib/types/chat';

export const chatState = $state<ChatState>({
	messages: [],
	isLoading: false,
	error: null,
	currentModel: 'z-ai/glm-4.5-air:free'
});

export const chatActions = {
	sendMessage: async (content: string, stream = true) => {
		const model = chatState.currentModel;

		// Add user message with timestamp
		chatState.messages = [
			...chatState.messages,
			{ role: 'user', content, timestamp: new Date() }
		];
		chatState.isLoading = true;
		chatState.error = null;

		try {
			if (stream) {
				const response = await fetch('/api/chat/stream', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model,
						messages: chatState.messages
					})
				});

				if (!response.ok) {
					throw new Error('Failed to get response');
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();
				let assistantContent = '';

				while (true) {
					const { done, value } = await reader!.read();
					if (done) break;

					const chunk = decoder.decode(value);
					const lines = chunk.split('\n');

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const data = line.slice(6);
							if (data === '[DONE]') continue;

							try {
								const parsed = JSON.parse(data);
								if (parsed.content) {
									assistantContent += parsed.content;

									// Update messages reactively
									const messages = [...chatState.messages];
									const lastMessage = messages[messages.length - 1];

									if (lastMessage?.role === 'assistant') {
										lastMessage.content = assistantContent;
									} else {
										messages.push({
											role: 'assistant',
											content: assistantContent,
											timestamp: new Date()
										});
									}

									chatState.messages = messages;
								} else if (parsed.error) {
									throw new Error(parsed.error);
								}
							} catch (e) {
								console.error('Error parsing SSE:', e);
							}
						}
					}
				}
			} else {
				// Handle non-streaming
				const response = await fetch('/api/chat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model,
						messages: chatState.messages
					})
				});

				if (!response.ok) {
					throw new Error('Failed to get response');
				}

				const data = await response.json();
				const assistantMessage = data.choices?.[0]?.message?.content || 'No response';

				chatState.messages = [
					...chatState.messages,
					{ role: 'assistant', content: assistantMessage, timestamp: new Date() }
				];
			}

			chatState.isLoading = false;
		} catch (error) {
			chatState.isLoading = false;
			chatState.error = error instanceof Error ? error.message : 'Unknown error occurred';
		}
	},

	clearMessages: () => {
		chatState.messages = [];
		chatState.error = null;
	},

	setModel: (model: string) => {
		chatState.currentModel = model;
	}
};
