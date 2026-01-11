<script lang="ts">
  import type { Message } from '$lib/types/chat';
  
  let {
    messages = [],
    isLoading = false,
    error = null,
    onSendMessage
  } = $props();
  
  let inputMessage = $state('');
  let chatContainer: HTMLElement;
  let inputElement: HTMLTextAreaElement;

  async function handleSubmit() {
    if (!inputMessage.trim() || isLoading) return;
    
    const message = inputMessage.trim();
    inputMessage = '';
    await onSendMessage(message);
    
    // Reset auto-resize
    if (inputElement) {
      inputElement.style.height = 'auto';
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function autoResize(element: HTMLTextAreaElement) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // Scroll to bottom when messages change
  $effect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 0);
    }
  });
</script>

<div class="flex flex-col h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white border-b border-gray-200 px-6 py-4">
    <h1 class="text-2xl font-semibold text-gray-800">AI Chatbot</h1>
    <p class="text-sm text-gray-500">Powered by OpenRouter</p>
  </header>

  <!-- Chat Messages -->
  <div bind:this={chatContainer} class="flex-1 overflow-y-auto px-6 py-4">
    {#each messages as message (message.content + message.role)}
      <div class="mb-4 flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
        <div class="max-w-2xl rounded-lg px-4 py-2 {
          message.role === 'user' 
            ? 'bg-blue-500 text-white' 
            : 'bg-white text-gray-800 border border-gray-200'
        }">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-semibold uppercase opacity-70">
              {message.role === 'user' ? 'You' : 'AI'}
            </span>
          </div>
          <p class="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    {/each}
    
    {#if isLoading}
      <div class="mb-4 flex justify-start">
        <div class="max-w-2xl rounded-lg px-4 py-2 bg-white border border-gray-200">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          </div>
        </div>
      </div>
    {/if}
    
    {#if error}
      <div class="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <p class="text-red-800">{error}</p>
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="bg-white border-t border-gray-200 px-6 py-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex gap-3">
        <textarea
          bind:this={inputElement}
          bind:value={inputMessage}
          onkeydown={handleKeydown}
          oninput={() => autoResize(inputElement)}
          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
          rows="1"
          disabled={isLoading}
          class="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          style="min-height: 48px; max-height: 200px; overflow-y: auto;"
        ></textarea>
        <button
          onclick={handleSubmit}
          disabled={isLoading || !inputMessage.trim()}
          class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  </div>
</div>
