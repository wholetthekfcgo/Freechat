<script lang="ts">
  	import { browser } from '$app/environment';
  	import ChatInterface from '$lib/components/ChatInterface.svelte';
 	import { chatState, chatActions, tokenUsage } from '$lib/stores/chat';
 	import { errorTracker } from '$lib/utils/error-tracker';
 	import { persistence } from '$lib/stores/persistence.svelte';
 	import { announce } from '$lib/utils/announcer';
 	import type { PageData } from './$types';
 	import type { Message } from '$lib/types/chat';

 	let { data }: { data: PageData } = $props();

 	let initialized = $state(false);
 	let thinkingEnabled = $state(false);

 	$effect(() => {
 		thinkingEnabled = data.initialThinking || false;
 	});

 	$effect(() => {
 		if (browser && !initialized) {
 			persistence.load().then((history) => {
 				if (history.conversations.length > 0) {
 					const currentConv = history.conversations.find(
 						(c) => c.id === history.currentConversationId
 					) || history.conversations[history.conversations.length - 1];

  					if (currentConv) {
  						const messages = [...currentConv.messages];
  						chatState.messages = messages as any;
  					}
 				}
 				initialized = true;
 			});
 		}

 		if (browser && data.initialModel && !chatState.currentModel) {
 			chatState.currentModel = data.initialModel;
 		}
 	});

	// Wrap async handlers with error tracking
 	async function handleSendMessage(message: string) {
 		try {
 			await chatActions.sendMessage(message, true);
 		} catch (error) {
 			errorTracker.captureError(error as Error, 'ChatInterface.sendMessage');
 			throw error;
 		}
 	}

 	function handleClear() {
  		chatActions.clearMessages();
 	}

  function handleExport(format: 'markdown' | 'json') {
 		const exportMessages = chatState.messages;
 		let content = '';
 		let filename = '';
 		let type = '';

 		if (format === 'markdown') {
 			content = exportMessages
 				.map((m: Message) => `## ${m.role.toUpperCase()}\n\n${m.content}\n\n`)
 				.join('---\n\n');
 			filename = `chat-export-${Date.now()}.md`;
 			type = 'text/markdown';
 		} else {
 			content = JSON.stringify(exportMessages, null, 2);
 			filename = `chat-export-${Date.now()}.json`;
 			type = 'application/json';
 		}

 		const blob = new Blob([content], { type });
 		const url = URL.createObjectURL(blob);
 		const a = document.createElement('a');
 		a.href = url;
 		a.download = filename;
 		a.click();
 		URL.revokeObjectURL(url);

 		if (browser) {
 			announce('Conversation exported successfully');
 		}
 	}

  	function handleModelChange(model: string) {
  		chatActions.setModel(model);
  	}

 		$effect(() => {
  		if (browser) {
  			chatState.enableThinking = thinkingEnabled;
  			document.cookie = `thinking-mode=${thinkingEnabled}; path=/; max-age=31536000`;
  		}
  	});

 		$effect(() => {
 		if (!browser) return;

 		const handleKeydown = (e: KeyboardEvent) => {
			// Ctrl+Enter or Cmd+Enter - Send message (handled by FloatingInput)
			// Ctrl+K or Cmd+K - Clear input
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				// Focus input using FloatingInput's ref
				// The input component handles this internally
			}

			// Escape - Stop generation
			if (e.key === 'Escape' && chatState.canStopGeneration) {
				e.preventDefault();
				chatActions.stopGeneration();
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

 <ChatInterface
 		messages={chatState.messages}
 		isLoading={chatState.isLoading}
 		error={chatState.error}
 		currentModel={chatState.currentModel}
 		onSendMessage={handleSendMessage}
 		onClear={handleClear}
 		onExport={handleExport}
 		onModelChange={handleModelChange}
 		thinkingEnabled={thinkingEnabled}
 		requestCount={tokenUsage.requestCount}
 	/>
