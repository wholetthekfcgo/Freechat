<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import VirtualChatList from '$lib/components/VirtualChatList.svelte';
	import FloatingInput from '$lib/components/FloatingInput.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { Trash2, Download, Plus, Square, RotateCcw, TrendingUp, Menu, X, Shield, Info, Zap, Layers } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { tick } from 'svelte';
	import { chatState, chatActions, chatHistory } from '$lib/stores/chat';
	import { browser } from '$app/environment';
	import { announce, announceError, initAnnouncer } from '$lib/utils/announcer';
	import { onMount } from 'svelte';
	import { ConfirmDialog } from '$lib/components/ui/dialog';
	import BuyCreditsModal from '$lib/components/BuyCreditsModal.svelte';

	import { formatTokenCount, formatCost } from '$lib/utils/token-tracker';

	let {
		messages = [],
		isLoading = false,
		error = null,
		currentModel = 'openai/gpt-oss-20b:free',
		onSendMessage,
		onClear,
		onExport,
		onImport,
		onRegenerate,
		onModelChange,
		totalTokens = 0,
		totalCost = 0,
		requestCount = 0,
		remainingTokens = 60,
		capacity = 60
	}: {
		messages: Message[];
		isLoading: boolean;
		error: string | null;
		currentModel?: string;
		onSendMessage: (message: string) => void;
		onClear?: () => void;
		onRegenerate?: () => Promise<void>;
		onExport?: (format: 'markdown' | 'json') => void;
		onImport?: (file: File) => Promise<boolean>;
		onModelChange?: (model: string) => void;
		totalTokens?: number;
		totalCost?: number;
		requestCount?: number;
		remainingTokens?: number;
		capacity?: number;
	} = $props();

	let inputMessage = $state('');
	let scrollAreaElement: HTMLElement;
	let showSidebar = $state(false);
	let mobileMenuOpen = $state(false);
	let showClearDialog = $state(false);
	let showDeleteDialog = $state(false);
	let showBuyCreditsModal = $state(false);
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

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
		announce(mobileMenuOpen ? 'Menu opened' : 'Menu closed');
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
		showSidebar = false;
	}

	function toggleMobileSidebar() {
		showSidebar = !showSidebar;
		mobileMenuOpen = showSidebar;
		announce(showSidebar ? 'Sidebar opened' : 'Sidebar closed');
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

	async function handlePurchaseCredits(packageId: string) {
		// Check if this is the free tier
		if (packageId === 'starter') {
			// Check if timer has expired
			const currentTime = Date.now();
			const refillTime = localStorage.getItem('freeCreditRefillTime');
			
			if (refillTime && currentTime < parseInt(refillTime)) {
				const timeLeft = Math.ceil((parseInt(refillTime) - currentTime) / 1000 / 60);
				announce(`Please wait ${timeLeft} minutes before claiming free credits again.`);
				return;
			}
			
			// Set next refill time (1 hour from now)
			const nextRefill = Date.now() + (60 * 60 * 1000);
			localStorage.setItem('freeCreditRefillTime', nextRefillTime.toString());
		}
		
		// Reset credits to 30 and clear request count
		tokenUsage.requestCount = 0;
		
		// Show success message
		announce('30 credits redeemed! You can now continue chatting.');
		
		// Log for now - TODO: Integrate with payment/backend system
		console.log('Redeemed credits via modal:', packageId);
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Ctrl/Cmd + K: Focus input
		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			// Input focusing is handled by FloatingInput component
			announce('Input focused');
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

	// Track loading state for announcements using derived pattern
	let wasLoading = $state(false);

	const loadingAnnouncement = $derived.by(() => {
		if (isLoading && !wasLoading) {
			return 'Generating response';
		}
		if (!isLoading && wasLoading) {
			return error ? `Error: ${error}` : 'Response complete';
		}
		return null;
	});

	$effect(() => {
		const announcement = loadingAnnouncement;
		if (announcement) {
			announce(announcement);
			// Update wasLoading after effect runs
			wasLoading = isLoading;
		}
	});

	// Track messages length changes for announcements
	let prevLength = $state(0);

	const messageAnnouncement = $derived.by(() => {
		if (messages.length > prevLength) {
			const newMessage = messages[messages.length - 1];
			return `New ${newMessage.role === 'user' ? 'You' : 'Assistant'} message`;
		}
		return null;
	});

	$effect(() => {
		const announcement = messageAnnouncement;
		if (announcement) {
			announce(announcement);
			prevLength = messages.length;
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

<div class="flex flex-col h-screen bg-background overflow-hidden">
	<!-- Mobile Sidebar Overlay -->
	{#if mobileMenuOpen}
		<div 
			class="mobile-sidebar-overlay"
			class:open={mobileMenuOpen}
			onclick={closeMobileMenu}
			aria-hidden="true"
		></div>
	{/if}
	
	<!-- Header - Mobile-Responsive -->
	<header class="mobile-header border-b border-border animate-fade-in">
		<div class="flex items-center justify-between w-full">
			<!-- Mobile Menu Button -->
			<button
				onclick={toggleMobileSidebar}
				class="mobile-icon-btn md:hidden touch-target"
				title="Toggle menu"
				aria-label="Toggle menu"
				aria-pressed={mobileMenuOpen}
			>
				{#if mobileMenuOpen}
					<X class="w-6 h-6" />
				{:else}
					<Menu class="w-6 h-6" />
				{/if}
			</button>
			
			<!-- Logo & Title -->
			<div class="flex items-center gap-2 md:gap-4 flex-1">
				<img src="/favicon.png" alt="Freechat Logo" class="w-8 h-8 md:w-12 md:h-12" />
				<div class="flex flex-col">
					<h1 class="mobile-title text-display-sm md:text-display-lg text-foreground tracking-tight">
						FREECHAT<span class="text-primary">.</span>CC
					</h1>
					<p class="text-body-xs md:text-body-sm text-muted-foreground font-accent">
						// Free as in Freedom
					</p>
				</div>
			</div>
		</div>
		
		<!-- Second Row: Credits & Actions -->
		<div class="flex items-center justify-between w-full md:hidden">
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
			
			<!-- Credits Left Display with Plus Button -->
			<div class="flex items-center gap-2 mobile-credits bg-card border border-border rounded-lg shadow-sm">
				<TrendingUp class="w-4 h-4 text-primary" />
				<div class="flex flex-col">
					<span class="text-body-xs text-muted-foreground font-accent hidden sm:inline">CREDITS LEFT</span>
					<span class="text-body-sm font-semibold text-foreground">
						{remainingTokens} / {capacity}
					</span>
				</div>
				<button
					onclick={() => (showBuyCreditsModal = true)}
					class="h-8 w-8 touch-target flex items-center justify-center bg-primary hover:bg-primary/80 text-primary-foreground rounded click-shrink transition-colors"
					title="Add more credits"
					aria-label="Add more credits"
				>
					<Plus class="w-3.5 h-3.5" />
				</button>
			</div>
		</div>

		<!-- Desktop Actions -->
		<div class="hidden md:flex items-center justify-end gap-4 w-full">
			<!-- Credits Left Display with Plus Button -->
			<div class="flex items-center gap-3 bg-card border border-border rounded-lg shadow-sm px-4 py-2">
				<TrendingUp class="w-4 h-4 text-primary" />
				<div class="flex flex-col">
					<span class="text-body-xs text-muted-foreground font-accent">CREDITS LEFT</span>
					<span class="text-body-sm font-semibold text-foreground">
						{remainingTokens} / {capacity}
					</span>
				</div>
				<button
					onclick={() => (showBuyCreditsModal = true)}
					class="h-8 w-8 flex items-center justify-center bg-primary hover:bg-primary/80 text-primary-foreground rounded click-shrink transition-colors"
					title="Add more credits"
					aria-label="Add more credits"
				>
					<Plus class="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	</header>

	<div class="flex-1 flex overflow-hidden relative">
		{#if showSidebar}
			<aside class="mobile-sidebar glass flex flex-col {mobileMenuOpen ? 'open' : ''}">
				<!-- Mobile Sidebar Header -->
				<div class="flex items-center justify-between p-4 border-b border-border md:hidden">
					<h2 class="text-display-sm text-foreground">History</h2>
					<button
						onclick={closeMobileMenu}
						class="mobile-icon-btn touch-target"
						aria-label="Close sidebar"
					>
						<X class="w-6 h-6" />
					</button>
				</div>
				
				<!-- Desktop Sidebar Header -->
				<div class="hidden md:block p-6 border-b border-border">
					<h2 class="text-display-sm text-foreground mb-1">History</h2>
	<p class="text-body-sm text-muted-foreground font-accent">{chatHistory?.conversations?.length ?? 0} conversations</p>
				</div>
				
				<!-- New Chat Button -->
				<div class="p-4 md:px-4 md:pt-4 md:pb-4 border-b border-border">
					<Button
						onclick={handleNewChat}
						class="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 click-shrink shadow-medium touch-target"
					>
						<Plus class="w-4 h-4 mr-2" />
						<span class="text-body-md">New Conversation</span>
					</Button>
				</div>
				<div class="flex-1 overflow-y-auto p-4 md:p-4 space-y-2">
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
										{#if onExport}
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
										{/if}
										<button
											onclick={(e) => {
												e.stopPropagation();
												handleDeleteRequest(conv.id);
											}}
											class="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:text-white text-muted-foreground click-shrink"
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
			</aside>
		{/if}

		<!-- Chat Messages -->
		<div class="flex-1 overflow-hidden relative">
			<ScrollArea class="h-full">
				<div bind:this={scrollAreaElement} class="responsive-max-width py-6 mx-auto">
					{#if messages.length === 0}
						<div class="flex items-center justify-center h-full min-h-[400px]">
							<div class="text-center space-y-6 max-w-lg">
								<!-- Brand Mark -->
								<div class="text-display-sm md:text-display-md text-muted-foreground/20">FREECHAT.CC</div>
								
								<!-- Value Propositions -->
								<div class="responsive-grid pt-6">
									<div class="border border-border bg-card mobile-value-prop text-left hover-lift">
										<div class="text-primary mb-2">
											<Shield class="w-5 h-5" />
										</div>
										<h3 class="text-body-sm font-medium text-foreground mb-1">Privacy First</h3>
										<p class="text-body-sm text-muted-foreground">Local encrypted storage keeps your data yours</p>
									</div>
									
									<div class="border border-border bg-card mobile-value-prop text-left hover-lift">
										<div class="text-primary mb-2">
											<Info class="w-5 h-5" />
										</div>
										<h3 class="text-body-sm font-medium text-foreground mb-1">Freedom of Choice</h3>
										<p class="text-body-sm text-muted-foreground">Access any AI model without lock-in</p>
									</div>
									
									<div class="border border-border bg-card mobile-value-prop text-left hover-lift">
										<div class="text-primary mb-2">
											<Zap class="w-5 h-5" />
										</div>
										<h3 class="text-body-sm font-medium text-foreground mb-1">Lightning Fast</h3>
										<p class="text-body-sm text-muted-foreground">Optimized token speed with streaming responses</p>
									</div>
									
									<div class="border border-border bg-card mobile-value-prop text-left hover-lift">
										<div class="text-primary mb-2">
											<Layers class="w-5 h-5" />
										</div>
										<h3 class="text-body-sm font-medium text-foreground mb-1">Zero Data Retention</h3>
										<p class="text-body-sm text-muted-foreground">Your conversations are never stored on servers</p>
									</div>
								</div>
								
								<!-- Call to Action -->
								<p class="text-body-sm text-muted-foreground pt-4">
									Start typing to begin your conversation
								</p>
							</div>
						</div>
					{:else if messages.length > 100}
						<!-- Use virtual scrolling for large conversations -->
						{#if onRegenerate}
							<VirtualChatList {messages} {onRegenerate} />
						{:else}
							<VirtualChatList {messages} onRegenerate={handleRegenerate} />
						{/if}
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
		onStopGeneration={handleStopGeneration}
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

	<BuyCreditsModal
		open={showBuyCreditsModal}
		onClose={() => (showBuyCreditsModal = false)}
		onPurchase={handlePurchaseCredits}
	/>
</div>
