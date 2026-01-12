<script lang="ts">
	import { browser } from '$app/environment';
	import ChatInterface from '$lib/components/ChatInterface.svelte';
	import { chatState, chatActions } from '$lib/stores/chat.svelte.ts';
	import type { PageData } from './$types';

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

	async function handleSendMessage(message: string) {
		await chatActions.sendMessage(message, true);
	}

	function handleClear() {
		chatActions.clearMessages();
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
</script>

<ChatInterface
	{messages}
	{isLoading}
	{error}
	{currentModel}
	onSendMessage={handleSendMessage}
	onClear={handleClear}
	onExport={handleExport}
	onModelChange={handleModelChange}
/>
