<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import FloatingInput from '$lib/components/FloatingInput.svelte';
	import ChatHeader from './chat/ChatHeader.svelte';
	import ChatSidebar from './chat/ChatSidebar.svelte';
	import ChatEmptyState from './chat/ChatEmptyState.svelte';
	import ChatMessageList from './chat/ChatMessageList.svelte';
	import { chatActions, chatHistory, tokenUsage } from '$lib/stores/chat';
	import { browser } from '$app/environment';
	import { announce, initAnnouncer, clearAnnouncements } from '$lib/utils/announcer';
	import { onMount, onDestroy } from 'svelte';
	import { ConfirmDialog, KeyboardShortcutsDialog } from '$lib/components/ui/dialog';
	import BuyCreditsModal from '$lib/components/BuyCreditsModal.svelte';


	let {
		messages = [],
		isLoading = false,
		error = null,
		currentModel = 'glm-4.7-flash',
		thinkingEnabled = false,
		onSendMessage,
		onClear,
		onExport,
		onRegenerate,
		onModelChange,
		onThinkingChange
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
		onModelChange?: (model: string) => void;
		onThinkingChange?: (enabled: boolean) => void;
	} = $props();

	let inputMessage = $state('');
	let scrollAreaElement: HTMLElement = $state();
	let showSidebar = $state(false);
	let showClearDialog = $state(false);
	let showDeleteDialog = $state(false);
	let showBuyCreditsModal = $state(false);
	let showKeyboardShortcuts = $state(false);
	let conversationToDelete: string | null = null;
	let keydownHandler: ((e: KeyboardEvent) => void) | undefined;

	onMount(() => {
		if (browser) {
			initAnnouncer();
			
			keydownHandler = (e: KeyboardEvent) => {
				if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
					e.preventDefault();
					announce('Input focused');
				}
				if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					e.preventDefault();
					if (inputMessage.trim() && !isLoading) {
						handleSubmit();
					}
				}
				if (e.key === 'Escape') {
					e.preventDefault();
					if (isLoading) {
						chatActions.stopGeneration();
						announce('Generation stopped');
					}
				}
				if ((e.ctrlKey || e.metaKey) && e.key === '/') {
					e.preventDefault();
					showKeyboardShortcuts = true;
				}
			};
			
			window.addEventListener('keydown', keydownHandler);
		}
	});
	
	onDestroy(() => {
		if (keydownHandler) {
			window.removeEventListener('keydown', keydownHandler);
		}
	});

	function toggleSidebar() {
		showSidebar = !showSidebar;
		announce(showSidebar ? 'Sidebar opened' : 'Sidebar closed');
	}

	function closeSidebar() {
		showSidebar = false;
	}

	async function handleSubmit() {
		if (!inputMessage.trim() || isLoading) return;

		const message = inputMessage.trim();
		inputMessage = '';
		announce('Sending message');
		try {
			await onSendMessage(message);
		} catch (error) {
			announce('Failed to send message');
			throw error;
		}
		clearAnnouncements();
	}

	function handleStopGeneration() {
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
		if (packageId === 'starter') {
			const currentTime = Date.now();
			const refillTime = localStorage.getItem('freeCreditRefillTime');

			if (refillTime && currentTime < parseInt(refillTime)) {
				const timeLeft = Math.ceil((parseInt(refillTime) - currentTime) / 1000 / 60);
				announce(`Please wait ${timeLeft} minutes before claiming free credits again.`);
				return;
			}

			const nextRefill = Date.now() + (60 * 60 * 1000);
			localStorage.setItem('freeCreditRefillTime', nextRefill.toString());
		}

		tokenUsage.requestCount = 0;
		announce('30 credits redeemed! You can now continue chatting.');
		console.log('Redeemed credits via modal:', packageId);
	}
</script>

<div class="flex flex-col h-screen bg-background overflow-hidden">
	<div class="grid-decoration"></div>

	{#if showSidebar}
		<div 
			class="mobile-sidebar-overlay"
			class:open={showSidebar}
			onclick={closeSidebar}
			aria-hidden="true"
		></div>
	{/if}
	
	<ChatHeader
		bind:showBuyCreditsModal
		onMobileMenuToggle={toggleSidebar}
		onBuyCredits={() => (showBuyCreditsModal = true)}
		showSidebar={showSidebar}
	/>

	<div class="flex-1 flex overflow-hidden relative">
		<ChatSidebar
			bind:showSidebar
			conversations={chatHistory?.conversations ?? []}
			currentConversationId={chatHistory?.currentConversationId ?? null}
			onLoadConversation={chatActions.loadConversation}
			onNewChat={handleNewChat}
			onDeleteConversation={handleDeleteRequest}
			onExportConversation={() => onExport?.('markdown')}
			onClose={closeSidebar}
		/>

		<div class="flex-1 overflow-hidden relative">
			{#if messages.length === 0}
				<ChatEmptyState onShowShortcuts={() => (showKeyboardShortcuts = true)} />
			{:else}
				<ChatMessageList
					bind:scrollAreaElement
					{messages}
					{isLoading}
					{error}
					{onRegenerate}
				/>
			{/if}
		</div>
	</div>

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

	<ConfirmDialog
		open={showClearDialog}
		title="Clear all messages?"
		message="This action cannot be undone. You will lose entire conversation."
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
