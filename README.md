# AI Chatbot

A modern AI chatbot built with SvelteKit, powered by OpenRouter API.

## Features

- 🚀 **Real-time Streaming**: Experience instant AI responses with streaming support
- 💬 **Beautiful UI**: Clean, responsive interface built with TailwindCSS
- 🔄 **Conversation History**: Maintains context throughout your conversation
- ⚡ **Fast & Lightweight**: Built on SvelteKit for optimal performance
- 🎨 **Modern Design**: Smooth animations and intuitive user experience

## Prerequisites

- Node.js 18+ or Bun
- OpenRouter API key ([Get one here](https://openrouter.ai/))

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ai-chatbot
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_actual_api_key_here
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
```

## Development

Start the development server:
```bash
npm run dev
# or
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Building for Production

```bash
npm run build
# or
bun run build
```

Preview the production build:
```bash
npm run preview
# or
bun run preview
```

## Project Structure

```
ai-chatbot/
├── src/
│   ├── lib/
│   │   ├── components/        # Reusable Svelte components
│   │   │   └── ChatInterface.svelte
│   │   ├── stores/           # Svelte stores for state management
│   │   │   └── chat.ts
│   │   ├── types/            # TypeScript type definitions
│   │   │   └── chat.ts
│   │   └── utils/            # Utility functions
│   │       └── openrouter.ts
│   ├── routes/               # SvelteKit routes
│   │   ├── api/
│   │   │   └── chat/
│   │   │       ├── +server.ts      # Non-streaming endpoint
│   │   │       └── stream/
│   │   │           └── +server.ts  # Streaming endpoint
│   │   ├── +layout.svelte
│   │   ├── +layout.ts
│   │   └── +page.svelte       # Main chat page
│   ├── app.css
│   └── app.html
├── static/                   # Static assets
├── .env.example             # Environment variables template
├── package.json
├── svelte.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## API Endpoints

### POST /api/chat
Non-streaming chat completion endpoint.

**Request:**
```json
{
  "model": "openai/gpt-3.5-turbo",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

**Response:**
```json
{
  "id": "gen-xxx",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hi there!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### POST /api/chat/stream
Streaming chat completion endpoint using Server-Sent Events (SSE).

**Request:** Same as non-streaming endpoint

**Response:** Stream of SSE events with `content` chunks

## Configuration

### Available Models

You can use any model available on OpenRouter. Some popular options:

- `openai/gpt-3.5-turbo` - Fast and cost-effective
- `openai/gpt-4` - Most capable
- `anthropic/claude-2` - Great for analysis
- `meta-llama/llama-2-70b-chat` - Open source option

Check [OpenRouter models](https://openrouter.ai/models) for the full list.

### Environment Variables

- `OPENROUTER_API_KEY` - Your OpenRouter API key (required)
- `OPENROUTER_API_URL` - OpenRouter API endpoint (optional, defaults to official endpoint)

## Features in Detail

### Streaming Responses
The chatbot uses Server-Sent Events (SSE) to stream responses in real-time, providing a more responsive user experience.

### Conversation History
The chatbot maintains conversation context, allowing for multi-turn conversations with the AI.

### Error Handling
Graceful error handling with user-friendly error messages displayed in the chat interface.

## Technologies Used

- **SvelteKit** - Web framework
- **Svelte 5** - UI library with runes
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **OpenRouter API** - AI model access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions, please open an issue on GitHub.
