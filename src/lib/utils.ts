import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { marked } from 'marked';
import hljs from 'highlight.js';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

// Configure marked for markdown rendering with syntax highlighting
marked.setOptions({
	breaks: true,
	gfm: true
});

// Custom renderer for syntax highlighting
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }: { text: string; lang?: string }) {
	const language = lang || '';
	let highlighted: string;
	
	if (language && hljs.getLanguage(language)) {
		try {
			highlighted = hljs.highlight(text, { language }).value;
		} catch (err) {
			console.error('Highlight.js error:', err);
			highlighted = hljs.highlightAuto(text).value;
		}
	} else {
		highlighted = hljs.highlightAuto(text).value;
	}
	
	return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
} as any;

marked.use({ renderer });

export function renderMarkdown(content: string): string {
	return marked.parse(content) as string;
}

export function extractCodeBlocks(content: string): Array<{language: string, code: string}> {
	const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
	const blocks: Array<{language: string, code: string}> = [];
	let match;
	
	while ((match = codeBlockRegex.exec(content)) !== null) {
		blocks.push({
			language: match[1] || 'text',
			code: match[2].trim()
		});
	}
	
	return blocks;
}
