<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import Button from '$lib/components/ui/button/button.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import AvatarFallback from '$lib/components/ui/avatar/avatar-fallback.svelte';
	import Avatar from '$lib/components/ui/avatar/avatar.svelte';
	import { Send, Bot, User } from 'lucide-svelte';

	let {
		messages = [],
		isLoading = false,
		error = null,
		onSendMessage
	} = $props();

	let inputMessage = $state('');
	let scrollAreaElement: HTMLElement;
	let inputElement: HTMLTextAreaElement;

	async function handleSubmit() {
		if (!inputMessage.trim() || isLoading) return;

		const message = inputMessage.trim();
		inputMessage = '';
		await onSendMessage(message);

		// Reset auto-resize
		if (inputElement) {
			inputElement.style.height = 'auto';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}

	function autoResize(element: HTMLTextAreaElement) {
		element.style.height = 'auto';
		element.style.height = element.scrollHeight + 'px';
	}

	function scrollToBottom() {
		if (scrollAreaElement) {
			scrollAreaElement.scrollTop = scrollAreaElement.scrollHeight;
		}
	}

	// Scroll to bottom when messages change
	$effect(() => {
		if (messages.length > 0) {
			setTimeout(scrollToBottom, 0);
		}
	});
</script>

<div class="flex flex-col h-screen bg-background">
	<!-- Header -->
	<header class="border-b border-border px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="p-2 bg-primary rounded-md">
				<Bot class="w-6 h-6 text-primary-foreground" />
			</div>
			<div>
				<h1 class="text-xl font-semibold text-foreground">AI Chatbot</h1>
				<p class="text-sm text-muted-foreground">Powered by OpenRouter</p>
			</div>
		</div>
	</header>

	<!-- Chat Messages -->
	<div class="flex-1 overflow-hidden">
		<ScrollArea class="h-full">
			<div bind:this={scrollAreaElement} class="px-6 py-4">
				{#each messages as message (message.content + message.role)}
					<div class="mb-6 flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div class="flex gap-3 max-w-2xl {message.role === 'user' ? 'flex-row-reverse' : ''}">
							<!-- Avatar -->
							<Avatar class="w-8 h-8 flex-shrink-0">
								{#if message.role === 'user'}
									<AvatarFallback class="bg-primary text-primary-foreground rounded-md">
										<User class="w-4 h-4" />
									</AvatarFallback>
								{:else}
									<AvatarFallback class="bg-secondary text-foreground rounded-md">
										<Bot class="w-4 h-4" />
									</AvatarFallback>
								{/if}
							</Avatar>

							<!-- Message Content -->
							<div class="flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'}">
								<div
									class="px-4 py-3 {message.role === 'user'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-foreground'}"
								>
									<p class="whitespace-pre-wrap break-words">{message.content}</p>
								</div>
							</div>
						</div>
					</div>
				{/each}

				{#if isLoading}
					<div class="mb-6 flex justify-start">
						<div class="flex gap-3 max-w-2xl">
							<Avatar class="w-8 h-8 flex-shrink-0">
								<AvatarFallback class="bg-secondary text-foreground rounded-md">
									<Bot class="w-4 h-4" />
								</AvatarFallback>
							</Avatar>
							<div class="px-4 py-3 bg-muted text-foreground">
								<div class="flex items-center gap-2">
									<div class="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"></div>
									<div
										class="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"
										style="animation-delay: 0.1s"
									></div>
									<div
										class="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"
										style="animation-delay: 0.2s"
									></div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="mb-6 bg-destructive/10 border border-destructive rounded-md px-4 py-3">
						<p class="text-destructive">{error}</p>
					</div>
				{/if}
			</div>
		</ScrollArea>
	</div>

	<!-- Input Area -->
	<div class="border-t border-border px-6 py-4">
		<div class="max-w-4xl mx-auto">
			<div class="flex gap-3 items-end">
				<div class="flex-1 relative">
					<Textarea
						bind:this={inputElement}
						bind:value={inputMessage}
						onkeydown={handleKeydown}
						oninput={() => autoResize(inputElement)}
						placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
						rows="1"
						disabled={isLoading}
						class="resize-none bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
						style="min-height: 48px; max-height: 200px; overflow-y: auto;"
					/>
				</div>
				<Button
					onclick={handleSubmit}
					disabled={isLoading || !inputMessage.trim()}
					class="px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
				>
					{#if isLoading}
						<span>Sending...</span>
					{:else}
						<Send class="w-4 h-4" />
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>
