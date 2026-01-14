<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import VirtualChatList from '$lib/components/VirtualChatList.svelte';
	import FloatingInput from '$lib/components/FloatingInput.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { Trash2, Download, Plus, Square, RotateCcw, History, Undo, Redo } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { tick } from 'svelte';
	import { chatState, chatActions, chatHistory } from '$lib/stores/chat.svelte';
	import { browser } from '$app/environment';
	import { announce, announceError, initAnnouncer } from '$lib/utils/announcer';
	import { onMount } from 'svelte';
	import { ConfirmDialog } from '$lib/components/ui/dialog';
	import { commandStack } from '$lib/stores/commands';
	import { createCommands } from '$lib/stores/commands';

	let {
		messages = [],
		isLoading = false,
		error = null,
		currentModel = 'openai/gpt-oss-20b:free',
		onSendMessage,
		onClear,
		onExport,
		onModelChange
	}: {
		messages: Message[];
		isLoading: boolean;
		error: string | null;
		currentModel?: string;
		onSendMessage: (message: string) => void;
		onClear?: () => void;
		onExport?: (format: 'markdown' | 'json') => void;
		onModelChange?: (model: string) => void;
	} = $props();

	let inputMessage = $state('');
	let scrollAreaElement: HTMLElement;
	let showSidebar = $state(false);
	let showClearDialog = $state(false);
	let showDeleteDialog = $state(false);
	let conversationToDelete: string | null = null;

	// Initialize screen reader announcer on mount
	onMount(() => {
		if (browser) {
			initAnnouncer();
		}
	});

	// Announce to screen readers
	function announceToScreenReader(message: string, isError: boolean = false) {
		if (isError) {
			announceError(message);
		} else {
			announce(message);
		}
	}

	async function handleSubmit() {
		if (!inputMessage.trim() || isLoading) return;

		const message = inputMessage.trim();
		inputMessage = '';
		announce('Sending message');
		await onSendMessage(message);
	}

	async function handleStopGeneration() {
		chatActions.stopGeneration();
		announce('Generation stopped');
	}

	async function handleRegenerate() {
		await chatActions.regenerateLastResponse();
		announce('Regenerating response');
	}

	function handleNewChat() {
		chatActions.startNewChat();
		announce('Started new chat');
	}

	function handleClearRequest() {
		showClearDialog = true;
	}

	function handleClearConfirm() {
		if (onClear) {
			onClear();
			announce('Cleared all messages');
		}
		showClearDialog = false;
	}

	function handleDeleteRequest(conversationId: string) {
		conversationToDelete = conversationId;
		showDeleteDialog = true;
	}

	function handleDeleteConfirm() {
		if (conversationToDelete) {
			chatActions.deleteConversation(conversationToDelete);
			announce('Deleted conversation');
		}
		showDeleteDialog = false;
		conversationToDelete = null;
	}

	function handleUndo() {
		commandStack.undo();
		announce('Undid last action');
	}

	function handleRedo() {
		commandStack.redo();
		announce('Redid action');
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Ctrl/Cmd + K: Focus input
		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			const input = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
			if (input) {
				input.focus();
				announce('Input focused');
			}
		}

		// Ctrl/Cmd + Enter: Submit
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			if (inputMessage.trim() && !isLoading) {
				handleSubmit();
			}
		}

		// Escape: Stop generation
		if (event.key === 'Escape' && isLoading) {
			handleStopGeneration();
		}

		// Ctrl/Cmd + /: Show keyboard shortcuts
		if ((event.ctrlKey || event.metaKey) && event.key === '/') {
			event.preventDefault();
			announce('Keyboard shortcuts: Ctrl+K focus input, Ctrl+Enter send, Escape stop generation');
		}
	}

	// Track previous loading state for announcements
	let wasLoading = $state(false);

	// Announce loading state changes
	$effect(() => {
		if (isLoading !== wasLoading) {
			wasLoading = isLoading;
			
			if (isLoading) {
				announce('Generating response');
			} else if (error) {
				announce(`Error: ${error}`);
			} else {
				announce('Response complete');
			}
		}
	});

	// Track previous messages length for announcements
	let prevLength = $state(0);

	// Announce new messages
	$effect(() => {
		if (messages.length > prevLength) {
			prevLength = messages.length;
			
			const newMessage = messages[messages.length - 1];
			const role = newMessage.role === 'user' ? 'You' : 'Assistant';
			announce(`New ${role} message`);
		}
	});

	// Set up keyboard shortcuts
	let keyboardHandlerAttached = $state(false);

	$effect(() => {
		if (browser && !keyboardHandlerAttached) {
			window.addEventListener('keydown', handleKeyDown);
			keyboardHandlerAttached = true;

			return () => {
				window.removeEventListener('keydown', handleKeyDown);
			};
		}
	});

	// Optimize scrolling with $effect.pre
	$effect.pre(() => {
		// Only track messages length, not entire messages array
		messages.length;

		if (scrollAreaElement) {
			const shouldScroll =
				scrollAreaElement.offsetHeight + scrollAreaElement.scrollTop >
				scrollAreaElement.scrollHeight - 50;

			if (shouldScroll) {
				tick().then(() => {
					scrollAreaElement.scrollTo(0, scrollAreaElement.scrollHeight);
				});
			}
		}
	});
</script>

<div class="flex flex-col h-screen bg-background">
	<!-- Header - Typographic & Asymmetric -->
	<header class="border-b border-border px-8 py-6 animate-fade-in">
		<div class="flex items-end justify-between mb-8" style="--stagger-delay: 0">
			<!-- Title - Massive Typography -->
			<div class="flex items-center gap-4">
				<!-- Logo -->
				<img src="/favicon.png" alt="Freechat Logo" class="w-12 h-12" />
				<div class="flex flex-col">
					<h1 class="text-display-lg text-foreground tracking-tight">
						FREECHAT<span class="text-primary">.</span>CC
					</h1>
					<p class="text-body-sm text-muted-foreground mt-1 font-accent">
						// Free as in Freedom
					</p>
				</div>
			</div>
		</div>

		<!-- Model Selector + Actions Strip -->
		<div class="flex items-center justify-end gap-8" style="--stagger-delay: 1">
			<!-- Icon-only Action Strip -->
			<div class="flex items-center gap-1">
				{#if chatState.canStopGeneration}
					<Button
						variant="ghost"
						onclick={handleStopGeneration}
						class="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground click-shrink"
						title="Stop generation"
						aria-label="Stop generating response"
					>
						<Square class="w-3.5 h-3.5" />
					</Button>
				{/if}

				<Button
					variant="ghost"
					onclick={() => (showSidebar = !showSidebar)}
					class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted click-shrink"
					title="Toggle chat history"
					aria-label="Toggle chat history sidebar"
					aria-pressed={showSidebar}
				>
					<History class="w-3.5 h-3.5" />
				</Button>
			</div>
		</div>
	</header>

	<div class="flex-1 flex overflow-hidden">
		<!-- Sidebar - Glassmorphism Chat History -->
		{#if showSidebar}
			<aside class="w-80 border-r border-border glass flex flex-col animate-slide-in">
				<div class="p-6 border-b border-border">
					<h2 class="text-display-sm text-foreground mb-1">History</h2>
					<p class="text-body-sm text-muted-foreground font-accent">{chatHistory?.conversations?.length ?? 0} conversations</p>
				</div>
				<div class="flex-1 overflow-y-auto p-4 space-y-2">
					{#if !chatHistory?.conversations || chatHistory.conversations.length === 0}
						<div class="text-center py-12">
							<p class="text-body-sm text-muted-foreground">// No history</p>
						</div>
					{:else}
						{#each chatHistory.conversations as conv}
							<div 
								role="button"
								tabindex="0"
								onclick={() => chatActions.loadConversation(conv.id)}
								onkeydown={(e) => e.key === 'Enter' && chatActions.loadConversation(conv.id)}
								class="group relative w-full text-left p-4 border transition-all duration-200 hover-lift cursor-pointer {chatHistory?.currentConversationId === conv.id ? 'bg-primary/10 border-primary shadow-glow' : 'bg-card border-border hover:border-primary/50'}"
							>
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<h3 class="text-body-md font-medium text-foreground truncate mb-1">{conv.title}</h3>
										<p class="text-body-sm text-muted-foreground">{conv.messages.length} messages</p>
									</div>
									<div class="flex items-center gap-1">
										<button
											onclick={(e) => {
												e.stopPropagation();
												onExport('markdown');
											}}
											class="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 text-muted-foreground hover:text-primary click-shrink"
											title="Export"
											aria-label="Export conversation"
										>
											<Download class="w-3.5 h-3.5" />
										</button>
										<button
											onclick={(e) => {
												e.stopPropagation();
												handleDeleteRequest(conv.id);
											}}
											class="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 text-muted-foreground hover:text-destructive click-shrink"
											title="Delete"
											aria-label="Delete conversation"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
				<!-- New Chat Button -->
				<div class="p-4 border-t border-border">
					<Button
						onclick={handleNewChat}
						class="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 click-shrink shadow-medium"
					>
						<Plus class="w-4 h-4 mr-2" />
						<span class="text-body-md">New Conversation</span>
					</Button>
				</div>
			</aside>
		{/if}

		<!-- Chat Messages -->
		<div class="flex-1 overflow-hidden relative">
			<ScrollArea class="h-full">
				<div bind:this={scrollAreaElement} class="px-8 py-6 max-w-4xl mx-auto">
					{#if messages.length === 0}
						<div class="flex items-center justify-center h-full min-h-[400px]">
							<div class="text-center space-y-4">
								<div class="text-display-md text-muted-foreground/20">FREECHAT.CC</div>
								<p class="text-body-md text-muted-foreground font-accent">// Free as in Freedom</p>
							</div>
						</div>
					{:else if messages.length > 100}
						<!-- Use virtual scrolling for large conversations -->
						<VirtualChatList {messages} {onRegenerate} />
					{:else}
						<!-- Regular rendering for small conversations -->
						{#each messages as message (message.id)}
							<MessageBubble 
								{message} 
								onRegenerate={message.role === 'assistant' ? handleRegenerate : undefined}
							/>
						{/each}
					{/if}

					{#if isLoading}
						<div class="mb-8 flex gap-4 animate-fade-in">
							<div
								class="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-border bg-card text-foreground shadow-subtle overflow-hidden"
							>
								<img src="/favicon.png" alt="Loading" class="w-full h-full object-cover" />
							</div>
							<div class="px-5 py-4 bg-card text-foreground border border-border shadow-subtle">
								<div class="flex items-center gap-3">
									<div class="w-12 h-[2px] bg-primary animate-pulse"></div>
									<div
										class="w-12 h-[2px] bg-primary animate-pulse"
										style="animation-delay: 0.1s"
									></div>
									<div
										class="w-12 h-[2px] bg-primary animate-pulse"
										style="animation-delay: 0.2s"
									></div>
								</div>
							</div>
						</div>
					{/if}

					{#if error}
						<div class="mb-8 border border-destructive bg-destructive/5 px-5 py-4 shadow-medium animate-fade-in">
							<p class="text-destructive text-body-md font-mono">// ERROR: {error}</p>
						</div>
					{/if}
				</div>
			</ScrollArea>
		</div>
	</div>

	<!-- Input Area -->
	<FloatingInput 
		bind:value={inputMessage} 
		onSubmit={handleSubmit} 
		{isLoading} 
		{currentModel}
		onModelChange={onModelChange}
	/>

	<!-- NEW: Confirmation Dialogs -->
	<ConfirmDialog
		open={showClearDialog}
		title="Clear all messages?"
		message="This action cannot be undone. You will lose the entire conversation."
		confirmLabel="Clear"
		cancelLabel="Cancel"
		variant="danger"
		onConfirm={handleClearConfirm}
		onCancel={() => (showClearDialog = false)}
	/>

	<ConfirmDialog
		open={showDeleteDialog}
		title="Delete conversation?"
		message="This action cannot be undone. The conversation will be permanently removed from your history."
		confirmLabel="Delete"
		cancelLabel="Cancel"
		variant="danger"
		onConfirm={handleDeleteConfirm}
		onCancel={() => (showDeleteDialog = false)}
	/>
</div>
