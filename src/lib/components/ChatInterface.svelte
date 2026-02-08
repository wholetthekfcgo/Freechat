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
	import { ConfirmDialog, KeyboardShortcutsDialog } from '$lib/components/ui/dialog';
	import BuyCreditsModal from '$lib/components/BuyCreditsModal.svelte';

	import { formatTokenCount, formatCost } from '$lib/utils/token-tracker';

	let {
		messages = [],
		isLoading = false,
		error = null,
		currentModel = 'glm-4.7-flash',
		thinkingEnabled = false,
		onSendMessage,
		onClear,
		onExport,
		onImport,
		onRegenerate,
		onModelChange,
		onThinkingChange,
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
		thinkingEnabled?: boolean;
		onSendMessage: (message: string) => void;
		onClear?: () => void;
		onRegenerate?: () => Promise<void>;
		onExport?: (format: 'markdown' | 'json') => void;
		onImport?: (file: File) => Promise<boolean>;
		onModelChange?: (model: string) => void;
		onThinkingChange?: (enabled: boolean) => void;
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
	let showKeyboardShortcuts = $state(false);
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
			showKeyboardShortcuts = true;
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
	<!-- Grid Decoration Background -->
	<div class="grid-decoration"></div>
	<!-- Mobile Sidebar Overlay -->
	{#if mobileMenuOpen}
		<div 
			class="mobile-sidebar-overlay"
			class:open={mobileMenuOpen}
			onclick={closeMobileMenu}
			aria-hidden="true"
		></div>
	{/if}
	
	<!-- Header - Clean Single-Row Mobile -->
	<header class="border-b border-border animate-fade-in px-4 py-3 md:px-6 md:py-4">
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
			
			<!-- Logo & Title - Centered on mobile, left on desktop -->
			<div class="flex items-center gap-2 md:gap-4 flex-1 justify-center md:justify-start">
				<img src="/favicon.png" alt="Freechat Logo" class="w-8 h-8 md:w-10 md:h-10" />
				<div class="flex flex-col">
					<h1 class="text-display-sm md:text-display-md text-foreground tracking-tight">
						FREECHAT<span class="text-primary">.</span>CC
					</h1>
					<p class="text-body-xs text-muted-foreground uppercase-label hidden md:block">
						// Free as in Freedom
					</p>
				</div>
			</div>
			
			<!-- Credits Display -->
			<div class="flex items-center gap-2 bg-card border border-border rounded-lg shadow-sm px-3 py-1.5 md:px-4 md:py-2 hover-glow transition-all">
				<TrendingUp class="w-4 h-4 text-primary" />
				<div class="flex flex-col">
					<span class="text-body-xs text-muted-foreground uppercase-label hidden sm:inline">CREDITS</span>
					<span class="text-body-sm font-semibold text-foreground font-mono">
						{remainingTokens}<span class="text-muted-foreground">/{capacity}</span>
					</span>
				</div>
				<button
					onclick={() => (showBuyCreditsModal = true)}
					class="h-7 w-7 md:h-8 md:w-8 touch-target flex items-center justify-center bg-primary hover:bg-primary/80 text-primary-foreground rounded click-shrink transition-colors"
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
					<h2 class="text-display-sm text-foreground mb-1 uppercase-label">CONVERSATION HISTORY</h2>
					<p class="text-body-sm text-muted-foreground font-mono">{chatHistory?.conversations?.length ?? 0} conversations</p>
				</div>
				
				<!-- New Chat Button -->
				<div class="p-4 md:px-4 md:pt-4 md:pb-4 border-b border-border">
					<Button
						onclick={handleNewChat}
						class="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 click-shrink shadow-medium touch-target"
					>
						<Plus class="w-4 h-4 mr-2" />
						<span class="text-body-md uppercase-label">NEW CONVERSATION</span>
					</Button>
				</div>
				<div class="flex-1 overflow-y-auto p-4 md:p-4 space-y-3">
					{#if !chatHistory?.conversations || chatHistory.conversations.length === 0}
						<div class="text-center py-12">
							<p class="font-mono text-body-sm text-muted-foreground">// No history yet</p>
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
								<!-- Decorative corner bracket for active -->
								{#if chatHistory?.currentConversationId === conv.id}
									<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
									<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
									<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
									<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
								{/if}
								
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<h3 class="text-body-md font-medium text-foreground truncate mb-1">{conv.title}</h3>
										<p class="font-mono text-body-xs text-muted-foreground">{conv.messages.length} messages</p>
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
				<div bind:this={scrollAreaElement} class="responsive-max-width py-6 mx-auto relative z-10">
					{#if messages.length === 0}
						<!-- BRUTALIST EDITORIAL EMPTY STATE -->
						<div class="flex items-center justify-center min-h-[600px] px-4">
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 max-w-6xl w-full items-center">
								<!-- Left: Massive Brand Typography -->
								<div class="space-y-6 text-left animate-stagger-entry">
									<div class="overflow-hidden">
										<h1 class="text-display-xl lg:text-[10rem] leading-[0.85] text-foreground tracking-tighter font-bold">
											FREECHAT
										</h1>
									</div>
									<div class="overflow-hidden">
										<p class="text-display-md text-muted-foreground uppercase-label tracking-widest">
											// Free as in Freedom
										</p>
									</div>
								</div>

								<!-- Right: Vertical Value Props as Annotations -->
								<div class="space-y-4 animate-stagger-entry" style="animation-delay: 100ms;">
									<div class="border-l-2 border-primary pl-4 py-2 hover-glow transition-all">
										<div class="flex items-start gap-3">
											<Shield class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
											<div>
												<h3 class="uppercase-label text-foreground mb-1">Privacy First</h3>
												<p class="text-body-sm text-muted-foreground">Local encrypted storage keeps your data yours</p>
											</div>
										</div>
									</div>

									<div class="border-l-2 border-border pl-4 py-2 hover-glow transition-all">
										<div class="flex items-start gap-3">
											<Info class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
											<div>
												<h3 class="uppercase-label text-foreground mb-1">Freedom of Choice</h3>
												<p class="text-body-sm text-muted-foreground">Access any AI model without lock-in</p>
											</div>
										</div>
									</div>

									<div class="border-l-2 border-border pl-4 py-2 hover-glow transition-all">
										<div class="flex items-start gap-3">
											<Zap class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
											<div>
												<h3 class="uppercase-label text-foreground mb-1">Lightning Fast</h3>
												<p class="text-body-sm text-muted-foreground">Optimized token speed with streaming responses</p>
											</div>
										</div>
									</div>

									<div class="border-l-2 border-border pl-4 py-2 hover-glow transition-all">
										<div class="flex items-start gap-3">
											<Layers class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
											<div>
												<h3 class="uppercase-label text-foreground mb-1">Zero Data Retention</h3>
												<p class="text-body-sm text-muted-foreground">Your conversations are never stored on servers</p>
											</div>
										</div>
									</div>

									<!-- Keyboard shortcuts hint -->
									<div class="pt-4 border-l-2 border-muted pl-4">
										<button
											onclick={() => (showKeyboardShortcuts = true)}
											class="flex items-center gap-3 text-body-sm text-muted-foreground hover:text-foreground transition-colors group"
											aria-label="View keyboard shortcuts"
										>
											<div class="flex items-center gap-1">
												<kbd class="px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded group-hover:border-primary/50 transition-colors">Ctrl</kbd>
												<span class="text-xs">+</span>
												<kbd class="px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded group-hover:border-primary/50 transition-colors">/</kbd>
											</div>
											<span>for keyboard shortcuts</span>
										</button>
									</div>

									<!-- Diagnostic-style call to action -->
									<div class="pt-4">
										<p class="font-mono text-body-xs text-primary animate-pulse">
											▶ Start typing to begin your conversation
										</p>
									</div>
								</div>
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
		{thinkingEnabled}
		onThinkingChange={onThinkingChange}
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

	<KeyboardShortcutsDialog
		open={showKeyboardShortcuts}
		onClose={() => (showKeyboardShortcuts = false)}
	/>
</div>
