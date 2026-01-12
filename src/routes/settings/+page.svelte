<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const models = [
		{ id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)' },
		{ id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
		{ id: 'openai/gpt-4', name: 'GPT-4' },
		{ id: 'anthropic/claude-2', name: 'Claude 2' },
		{ id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B' }
	];
</script>

<svelte:head>
	<title>Settings - AI Chatbot</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-6">
	<h1 class="text-2xl font-bold mb-6">Settings</h1>

	<form method="POST" use:enhance class="space-y-6">
		<div class="space-y-2">
			<label for="model" class="block text-sm font-medium">Preferred Model</label>
			<select
				id="model"
				name="model"
				class="w-full px-3 py-2 border border-border rounded-md bg-background"
			>
				{#each models as model}
					<option value={model.id} selected={data.preferredModel === model.id}>
						{model.name}
					</option>
				{/each}
			</select>
			<p class="text-sm text-muted-foreground">
				Select your preferred AI model for conversations.
			</p>
		</div>

		<button
			type="submit"
			class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
		>
			Save Preferences
		</button>

		{#if form?.success}
			<div class="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-md">
				Settings saved successfully!
			</div>
		{/if}
	</form>
</div>
