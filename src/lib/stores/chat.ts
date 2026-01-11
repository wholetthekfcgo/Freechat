import { writable } from 'svelte/store';
import type { Message, ChatState } from '$lib/types/chat';

function createChatStore() {
  const { subscribe, update } = writable<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    currentModel: 'z-ai/glm-4.5-air:free'
  });

  return {
    subscribe,
    
    sendMessage: async (content: string, stream = true) => {
      // Add user message
      let model = '';
      update(state => {
        model = state.currentModel;
        return {
          ...state,
          messages: [...state.messages, { role: 'user', content }],
          isLoading: true,
          error: null
        };
      });

      try {
        // Get current messages
        let currentMessages: Message[] = [];
        subscribe(state => { currentMessages = state.messages; })();

        if (stream) {
          // Handle streaming
          const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: currentMessages
            })
          });

          if (!response.ok) {
            throw new Error('Failed to get response');
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let assistantContent = '';

          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    assistantContent += parsed.content;
                    update(state => {
                      const newMessages = [...state.messages];
                      const lastMessage = newMessages[newMessages.length - 1];
                      
                      if (lastMessage?.role === 'assistant') {
                        lastMessage.content = assistantContent;
                      } else {
                        newMessages.push({ role: 'assistant', content: assistantContent });
                      }
                      
                      return { ...state, messages: newMessages };
                    });
                  } else if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                } catch (e) {
                  console.error('Error parsing SSE:', e);
                }
              }
            }
          }

          update(state => ({ ...state, isLoading: false }));
        } else {
          // Handle non-streaming
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: currentMessages
            })
          });

          if (!response.ok) {
            throw new Error('Failed to get response');
          }

          const data = await response.json();
          const assistantMessage = data.choices?.[0]?.message?.content || 'No response';

          update(state => ({
            ...state,
            messages: [...state.messages, { role: 'assistant', content: assistantMessage }],
            isLoading: false
          }));
        }
      } catch (error) {
        update(state => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }));
      }
    },

    clearMessages: () => {
      update(state => ({ ...state, messages: [], error: null }));
    },

    setModel: (model: string) => {
      update(state => ({ ...state, currentModel: model }));
    }
  };
}

export const chatStore = createChatStore();
