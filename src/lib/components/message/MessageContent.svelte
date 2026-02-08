<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { renderMarkdown } from '$lib/utils';
	import { sanitizeHTML, isSafePlainText } from '$lib/utils/sanitize';
	import { X, Save } from '@lucide/svelte';
	import './message-bubble.css';

	let {
		message,
		isEditing = false,
		editedContent = $bindable(),
		onSaveEdit = () => {},
		onCancelEdit = () => {},
		textareaFocus = undefined
	}: {
		message: Message;
		isEditing: boolean;
		editedContent: string;
		onSaveEdit: () => void;
		onCancelEdit: () => void;
		textareaFocus?: ((node: HTMLTextAreaElement) => void) | undefined;
	} = $props();

	function handleTextareaFocus(node: HTMLTextAreaElement) {
		textareaFocus?.(node);
	}
</script>

<div
	class="relative p-3 sm:p-5 border {message.role === 'user'
		? 'bg-primary text-primary-foreground border-primary shadow-medium'
		: 'bg-card text-foreground border-border shadow-subtle hover:border-primary/30'} transition-all duration-200 {message.role === 'user' ? 'inline-block text-left max-w-[90%] sm:max-w-[93%]' : 'inline-block max-w-[90%] sm:max-w-[93%]'} {isEditing ? 'ring-2 ring-primary' : ''}"
>
	{#if isEditing && message.role === 'user'}
		<!-- Edit Mode -->
		<textarea
			bind:value={editedContent}
			class="w-full bg-transparent text-primary-foreground placeholder:text-primary-foreground/50 resize-none outline-none font-body leading-relaxed"
			rows={Math.min(8, Math.max(2, editedContent.split('\n').length))}
			placeholder="Edit your message..."
			use:handleTextareaFocus
		></textarea>
		<div class="flex gap-2 mt-3 justify-end">
			<button
				onclick={onCancelEdit}
				class="flex items-center gap-1 px-2 py-1 text-xs bg-card text-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-all duration-200 click-shrink"
				title="Cancel editing"
			>
				<X class="w-3 h-3" />
				Cancel
			</button>
			<button
				onclick={onSaveEdit}
				class="flex items-center gap-1 px-2 py-1 text-xs bg-card text-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-all duration-200 click-shrink"
				title="Save changes"
			>
				<Save class="w-3 h-3" />
				Save
			</button>
		</div>
	{:else}
		<!-- Display Mode -->
		{#if isSafePlainText(message.content)}
			<p class="whitespace-pre-wrap break-words text-body-md leading-relaxed font-body">
				{message.content}
			</p>
		{:else}
			<div class="prose prose-invert max-w-none">
				{@html sanitizeHTML(renderMarkdown(message.content))}
			</div>
		{/if}
	{/if}
</div>
