<script lang="ts">
	import { browser } from '$app/environment';
	import ChatInterface from '$lib/components/ChatInterface.svelte';
	import { chatState, chatActions } from '$lib/stores/chat.svelte.js';
	import { errorTracker, withErrorHandling } from '$lib/utils/error-tracker';
	import type { PageData } from './$types';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';

	let { data }: { data: PageData } = $props();

	// Initialize state from server data - only on client side
	$effect(() => {
		if (browser && data.initialModel && !chatState.currentModel) {
			chatState.currentModel = data.initialModel;
		}
	});

	// Create reactive derived values
	const messages = $derived(chatState.messages);
	const isLoading = $derived(chatState.isLoading);
	const error = $derived(chatState.error);
	const currentModel = $derived(chatState.currentModel);

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

	function handleModelChange(model: string) {
		chatActions.setModel(model);
	}

	// Keyboard shortcuts
	$effect(() => {
		if (!browser) return;

		const handleKeydown = (e: KeyboardEvent) => {
			// Ctrl+Enter or Cmd+Enter - Send message (handled by FloatingInput)
			// Ctrl+K or Cmd+K - Clear input
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				const input = document.querySelector('textarea') as HTMLTextAreaElement;
				if (input) {
					input.value = '';
					input.focus();
				}
			}

			// Escape - Stop generation
			if (e.key === 'Escape' && chatState.canStopGeneration) {
				e.preventDefault();
				chatActions.stopGeneration();
			}

			// Ctrl+/ or Cmd+/ - Show keyboard shortcuts help
			if ((e.ctrlKey || e.metaKey) && e.key === '/') {
				e.preventDefault();
				// TODO: Show keyboard shortcuts modal
				alert('Keyboard Shortcuts:\nCtrl+Enter: Send message\nCtrl+K: Clear input\nEscape: Stop generation');
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<ErrorBoundary componentName="PageComponent" onRetry={async () => { await handleSendMessage(''); }}>
	<ChatInterface
		{messages}
		{isLoading}
		{error}
		{currentModel}
		onSendMessage={handleSendMessage}
		onClear={handleClear}
		onExport={handleExport}
		onRegenerate={handleRegenerate}
		onModelChange={handleModelChange}
	/>
</ErrorBoundary>
