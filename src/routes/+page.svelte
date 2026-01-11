<script lang="ts">
	import ChatInterface from '$lib/components/ChatInterface.svelte';
	import { chatStore } from '$lib/stores/chat';

	async function handleSendMessage(message: string) {
		await chatStore.sendMessage(message, true);
	}

	function handleClear() {
		chatStore.clearMessages();
	}

	function handleExport(format: 'markdown' | 'json') {
		const messages = $chatStore.messages;
		let content = '';
		let filename = '';
		let type = '';

		if (format === 'markdown') {
			content = messages.map((m) => `## ${m.role.toUpperCase()}\n\n${m.content}\n\n`).join('---\n\n');
			filename = `chat-export-${Date.now()}.md`;
			type = 'text/markdown';
		} else {
			content = JSON.stringify(messages, null, 2);
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
		chatStore.setModel(model);
	}
</script>

<ChatInterface 
  messages={$chatStore.messages}
  isLoading={$chatStore.isLoading}
  error={$chatStore.error}
  currentModel={$chatStore.currentModel}
  onSendMessage={handleSendMessage}
  onClear={handleClear}
  onExport={handleExport}
  onModelChange={handleModelChange}
/>
