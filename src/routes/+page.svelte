<script lang="ts">
  import ChatInterface from '$lib/components/ChatInterface.svelte';
  import { chatStore } from '$lib/stores/chat';

  async function handleSendMessage(message: string) {
    await chatStore.sendMessage(message, true);
  }
</script>

<ChatInterface 
  messages={$chatStore.messages}
  isLoading={$chatStore.isLoading}
  error={$chatStore.error}
  onSendMessage={handleSendMessage}
/>
