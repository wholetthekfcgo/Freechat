<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const models = [{ id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)' }];
</script>

<svelte:head>
	<title>Settings - AI Chatbot</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-6">
	<h1 class="text-2xl font-bold mb-6 text-foreground">Settings</h1>

	<form method="POST" use:enhance class="space-y-6">
		<div class="space-y-2">
			<label for="model" class="block text-sm font-medium text-foreground">Preferred Model</label>
			<select
				id="model"
				name="model"
				class="w-full px-3 py-2 border border-border bg-background text-foreground"
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
			class="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
		>
			Save Preferences
		</button>

		{#if form?.success}
			<div class="p-3 bg-primary/20 text-foreground border border-primary">
				Settings saved successfully!
			</div>
		{/if}
	</form>
</div>
