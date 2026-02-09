  <script lang="ts">
  	import { browser } from '$app/environment';
  	import ChatInterface from '$lib/components/ChatInterface.svelte';
  	import { chatState, chatActions, tokenUsage } from '$lib/stores/chat';
  	import { errorTracker } from '$lib/utils/error-tracker';
  	import { persistence } from '$lib/stores/persistence.svelte.js';
  	import type { PageData } from './$types';

  	const generateUUID = (): string => {
  		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
  			return crypto.randomUUID();
  		}
  		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
  			const r = Math.random() * 16 | 0;
  			const v = c === 'x' ? r : (r & 0x3 | 0x8);
  			return v.toString(16);
  		});
  	};

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
						chatState.messages = currentConv.messages;
					}
				}
				initialized = true;
			});
		}

		if (browser && data.initialModel && !chatState.currentModel) {
			chatState.currentModel = data.initialModel;
		}
	});

	// Create reactive derived values
	const messages = $derived(chatState.messages);
	const isLoading = $derived(chatState.isLoading);
	const error = $derived(chatState.error);
	const currentModel = $derived(chatState.currentModel);
	const totalTokens = $derived(tokenUsage.totalTokens);
	const totalCost = $derived(tokenUsage.totalCost);
	const requestCount = $derived(tokenUsage.requestCount);

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

	async function handleRegenerate() {
		await chatActions.regenerateLastResponse();
	}

	function handleExport(format: 'markdown' | 'json') {
		const exportMessages = messages;
		let content = '';
		let filename = '';
		let type = '';

		if (format === 'markdown') {
			content = exportMessages
				.map((m) => `## ${m.role.toUpperCase()}\n\n${m.content}\n\n`)
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
	}

	async function handleImport(file: File) {
		try {
			const content = await file.text();
			let importedMessages: any[] = [];

			// Determine format and parse accordingly
			if (file.name.endsWith('.json')) {
				importedMessages = JSON.parse(content);
			} else if (file.name.endsWith('.md')) {
				const sections = content.split('## ');
				for (const section of sections) {
					const lines = section.trim().split('\n');
					if (lines.length < 2) continue;

					const role = (lines[0] || '').toLowerCase().replace(':', '').trim();
					const content_text = lines.slice(1).join('\n').trim();
					
					if (role === 'user' || role === 'assistant') {
						importedMessages.push({
							id: generateUUID(),
							role,
							content: content_text,
							timestamp: new Date(),
							isPartial: false
						});
					}
				}
			} else {
				throw new Error('Unsupported file format. Please use .json or .md files.');
			}

			// Validate messages array
			if (!Array.isArray(importedMessages) || importedMessages.length === 0) {
				throw new Error('Invalid file format: No messages found.');
			}

			// Create a new conversation with imported messages
			await chatActions.startNewChat();
			chatState.messages = importedMessages;
			await chatActions.saveCurrentConversation();
			
			return true;
		} catch (error) {
			console.error('Import failed:', error);
			throw error;
		}
	}

	function handleModelChange(model: string) {
		chatActions.setModel(model);
	}

	function handleThinkingChange(enabled: boolean) {
		thinkingEnabled = enabled;
		chatState.enableThinking = enabled;
		// Save to cookie for persistence
		document.cookie = `thinking-mode=${enabled}; path=/; max-age=31536000`;
	}

	// Keyboard shortcuts
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
				handleRegenerate();
				chatActions.stopGeneration();
			}

			// Ctrl+/ or Cmd+/ - Show keyboard shortcuts help
			if ((e.ctrlKey || e.metaKey) && e.key === '/') {
				e.preventDefault();
				alert('Keyboard Shortcuts:\nCtrl+Enter: Send message\nCtrl+K: Clear input\nEscape: Stop generation');
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

	<ChatInterface
		{messages}
		{isLoading}
		{error}
		{currentModel}
		onSendMessage={handleSendMessage}
		onClear={handleClear}
		onExport={handleExport}
		onImport={handleImport}
		onRegenerate={handleRegenerate}
		onModelChange={handleModelChange}
		{thinkingEnabled}
		onThinkingChange={handleThinkingChange}
		{totalTokens}
		{totalCost}
		{requestCount}
	/>
