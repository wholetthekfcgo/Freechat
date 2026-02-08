<script lang="ts">
	import type { ChatConversation } from '$lib/types/chat';
	import { Trash2, Download, Plus, X } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	let {
		showSidebar = $bindable(false),
		conversations = [],
		currentConversationId = null,
		onLoadConversation,
		onNewChat = () => {},
		onDeleteConversation,
		onExportConversation = () => {},
		onClose = () => {}
	}: {
		showSidebar: boolean;
		conversations: ChatConversation[];
		currentConversationId: string | null;
		onLoadConversation: (id: string) => void;
		onNewChat: () => void;
		onDeleteConversation: (id: string) => void;
		onExportConversation: () => void;
		onClose: () => void;
	} = $props();
</script>

{#if showSidebar}
	<aside class="mobile-sidebar glass flex flex-col {showSidebar ? 'open' : ''}">
		<!-- Mobile Sidebar Header -->
		<div class="flex items-center justify-between p-4 border-b border-border md:hidden">
			<h2 class="text-display-sm text-foreground">History</h2>
			<button
				onclick={onClose}
				class="mobile-icon-btn touch-target"
				aria-label="Close sidebar"
			>
				<X class="w-6 h-6" />
			</button>
		</div>
		
		<!-- Desktop Sidebar Header -->
		<div class="hidden md:block p-6 border-b border-border">
			<h2 class="text-display-sm text-foreground mb-1 uppercase-label">CONVERSATION HISTORY</h2>
			<p class="text-body-sm text-muted-foreground font-mono">{conversations.length} conversations</p>
		</div>
		
		<!-- New Chat Button -->
		<div class="p-4 md:px-4 md:pt-4 md:pb-4 border-b border-border">
			<Button
				onclick={onNewChat}
				class="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 click-shrink shadow-medium touch-target"
			>
				<Plus class="w-4 h-4 mr-2" />
				<span class="text-body-md uppercase-label">NEW CONVERSATION</span>
			</Button>
		</div>
		<div class="flex-1 overflow-y-auto p-4 md:p-4 space-y-3">
			{#if conversations.length === 0}
				<div class="text-center py-12">
					<p class="font-mono text-body-sm text-muted-foreground">// No history yet</p>
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
								<p class="font-mono text-body-xs text-muted-foreground">{conv.messages.length} messages</p>
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
	</aside>
{/if}
