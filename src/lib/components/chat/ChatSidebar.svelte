<script lang="ts">
 	import type { ChatConversation } from '$lib/types/chat';
 	import { Trash2, Download, Plus, X, TrendingUp, HelpCircle, Clock } from '@lucide/svelte';
 	import Button from '$lib/components/ui/button/button.svelte';
 	import { tokenUsage } from '$lib/stores/chat';

 	let {
  		showSidebar = $bindable(false),
  		onBuyCredits = () => {},
  		conversations = [],
  		currentConversationId = null,
  		onLoadConversation,
  		onNewChat = () => {},
  		onDeleteConversation,
  		onExportConversation = () => {},
  		onClose = () => {},
  		requestCount = 0
  	}: {
  		showSidebar: boolean;
  		onBuyCredits: () => void;
  		conversations: ChatConversation[];
  		currentConversationId: string | null;
  		onLoadConversation: (id: string) => void;
  		onNewChat: () => void;
  		onDeleteConversation: (id: string) => void;
  		onExportConversation: () => void;
  		onClose: () => void;
  		requestCount?: number;
  	} = $props();

 	const capacity = 60;
 	const remainingTokens = $derived(capacity - requestCount);
 	let showCreditsTooltip = $state(false);

	function formatRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - new Date(date).getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return new Date(date).toLocaleDateString();
	}

	function getConversationPreview(conv: ChatConversation): string {
		if (conv.messages.length === 0) return 'No messages';
		const lastMessage = conv.messages[conv.messages.length - 1];
		const preview = lastMessage.content.trim();
		return preview.length > 50 ? preview.substring(0, 50) + '...' : preview;
	}
</script>

 {#if showSidebar}
 	<aside class="sidebar-drawer glass flex flex-col {showSidebar ? 'open' : ''}">
 		<!-- Branding Section (Top) -->
 		<div class="sidebar-branding flex items-center justify-between p-4 border-b border-border">
 			<div class="flex items-center gap-3">
 				<img src="/favicon.png" alt="Freechat Logo" class="w-8 h-8" />
 				<div class="flex flex-col">
 					<h1 class="text-display-sm text-foreground tracking-tight">
 						FREECHAT<span class="text-primary">.</span>CC
 					</h1>
 					<p class="text-body-xs text-muted-foreground uppercase-label">// Free as in Freedom</p>
 				</div>
 			</div>
 			<button
 				onclick={onClose}
 				class="mobile-icon-btn touch-target"
 				aria-label="Close sidebar"
 			>
 				<X class="w-6 h-6" />
 			</button>
 		</div>

 		<!-- New Chat Button -->
 		<div class="p-4 border-b border-border">
 			<Button
 				onclick={onNewChat}
 				class="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 click-shrink shadow-medium touch-target"
 			>
 				<Plus class="w-4 h-4 mr-2" />
 				<span class="text-body-md uppercase-label">NEW CONVERSATION</span>
 			</Button>
 		</div>

 		<!-- History Section (Middle - scrollable) -->
 		<div class="flex-1 overflow-y-auto p-4 space-y-3">
 			<h2 class="text-display-sm text-foreground mb-1 uppercase-label">CONVERSATION HISTORY</h2>
 			<p class="text-body-sm text-muted-foreground font-mono mb-4">{conversations.length} conversations</p>

  			{#if conversations.length === 0}
  				<div class="text-center py-12 px-4">
  					<p class="font-mono text-body-sm text-muted-foreground mb-4">// No history yet</p>
  					<button
  						onclick={onNewChat}
  						class="w-full px-4 py-2 bg-muted/50 hover:bg-muted border border-border rounded-md text-body-sm text-foreground hover:text-primary transition-all"
  						aria-label="Start a new conversation"
  					>
  						Start a new conversation
  					</button>
  				</div>
  			{:else}
  				{#each conversations as conv}
  					<div
  								role="button"
  								tabindex="0"
  								onclick={() => onLoadConversation(conv.id)}
  								onkeydown={(e) => e.key === 'Enter' && onLoadConversation(conv.id)}
  								class="group relative w-full text-left p-4 border transition-all duration-200 hover-lift cursor-pointer {currentConversationId === conv.id ? 'bg-primary/10 border-primary shadow-glow' : 'bg-card border-border hover:border-primary/50'}"
  							>
  						<!-- Decorative corner bracket for active -->
  						{#if currentConversationId === conv.id}
  							<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
  							<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
  							<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
  							<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
  						{/if}

  						<div class="flex items-start justify-between">
  							<div class="flex-1 min-w-0">
  								<h3 class="text-body-md font-medium text-foreground truncate mb-1">{conv.title}</h3>
  								<div class="flex items-center gap-2 text-body-xs text-muted-foreground mb-1">
  									<span class="font-mono">{conv.messages.length} messages</span>
  									<span>•</span>
  									<span class="flex items-center gap-1">
  										<Clock class="w-3 h-3" />
  										{formatRelativeTime(conv.updatedAt)}
  									</span>
  								</div>
  								<p class="text-body-xs text-muted-foreground truncate italic">{getConversationPreview(conv)}</p>
  							</div>
  							<div class="flex items-center gap-1">
  								<button
  									onclick={(e) => {
  										e.stopPropagation();
  										onExportConversation();
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
  										onDeleteConversation(conv.id);
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

  		<!-- Credits Section (Bottom) -->
  		<div class="sidebar-credits p-4 border-t border-border">
  			<div class="flex items-center gap-2 bg-card border border-border rounded-lg shadow-sm px-3 py-2 hover-glow transition-all relative">
  				<TrendingUp class="w-4 h-4 text-primary" />
  				<div class="flex-1 flex flex-col">
  					<span class="text-body-xs text-muted-foreground uppercase-label flex items-center gap-1">
  						CREDITS
  						<button
  							onclick={() => showCreditsTooltip = !showCreditsTooltip}
  							class="hover:text-primary transition-colors"
  							aria-label="What are credits?"
  						>
  							<HelpCircle class="w-3 h-3" />
  						</button>
  					</span>
  					<span class="text-body-sm font-semibold text-foreground font-mono">
  						{remainingTokens}<span class="text-muted-foreground">/{capacity}</span>
  					</span>
  				</div>
  				<button
  					onclick={onBuyCredits}
  					class="h-7 w-7 touch-target flex items-center justify-center bg-primary hover:bg-primary/80 text-primary-foreground rounded click-shrink transition-colors"
  					title="Add more credits"
  					aria-label="Add more credits"
  				>
  					<Plus class="w-3.5 h-3.5" />
  				</button>

  				<!-- Tooltip -->
  				{#if showCreditsTooltip}
  					<div class="absolute bottom-full right-0 mb-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-dramatic text-body-sm z-50 animate-fade-in">
  						<p class="text-foreground mb-2">Credits track your API usage:</p>
  						<ul class="space-y-1 text-muted-foreground text-xs">
  							<li>• Each message uses ~1 credit</li>
  							<li>• Free tier: 60 credits/day</li>
  							<li>• Refills every 24 hours</li>
  						</ul>
  						<button
  							onclick={() => showCreditsTooltip = false}
  							class="mt-2 text-primary hover:underline text-xs"
  							aria-label="Close tooltip"
  						>
  							Got it
  						</button>
  					</div>
  				{/if}
  			</div>
  		</div>
 	</aside>
 {/if}
