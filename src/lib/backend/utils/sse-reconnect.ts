/**
 * SSE Reconnect Utility with Exponential Backoff
 * 
 * Handles Server-Sent Events reconnection with intelligent backoff strategy
 * Prevents thundering herd problem and reduces server load during outages
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Automatic reconnection on connection loss
 * - Configurable max retry attempts
 * - Connection state tracking
 * - Graceful shutdown
 * 
 * Time Complexity: O(1) per reconnection attempt
 * Space Complexity: O(1) - fixed state storage
 */

import { logger } from '$lib/utils/logger';

export enum SSEConnectionState {
	DISCONNECTED = 'DISCONNECTED',
	CONNECTING = 'CONNECTING',
	CONNECTED = 'CONNECTED',
	RECONNECTING = 'RECONNECTING',
	CLOSED = 'CLOSED'
}

export interface SSEReconnectConfig {
	// Initial backoff delay in milliseconds
	initialDelayMs: number;
	// Maximum backoff delay in milliseconds
	maxDelayMs: number;
	// Multiplier for exponential backoff
	backoffMultiplier: number;
	// Add random jitter to prevent thundering herd
	jitter: boolean;
	// Maximum number of reconnection attempts (-1 for infinite)
	maxRetries: number;
	// Connection timeout in milliseconds
	connectionTimeoutMs: number;
	// Maximum time to wait for keep-alive messages
	keepAliveTimeoutMs: number;
}

export interface SSEConnectionStats {
	state: SSEConnectionState;
	attemptCount: number;
	lastConnectedAt?: Date;
	lastDisconnectedAt?: Date;
	totalReconnects: number;
	currentBackoffMs: number;
}

export interface SSEMessageHandler {
	(data: string, eventId?: string): void | Promise<void>;
}

/**
 * Default SSE reconnection configuration
 */
export const DEFAULT_SSE_RECONNECT_CONFIG: SSEReconnectConfig = {
	initialDelayMs: 1000, // Start with 1 second
	maxDelayMs: 30000, // Max 30 seconds between retries
	backoffMultiplier: 2, // Double the delay each time
	jitter: true, // Add randomness to prevent synchronization
	maxRetries: -1, // Infinite retries
	connectionTimeoutMs: 10000, // 10 seconds to establish connection
	keepAliveTimeoutMs: 45000 // 45 seconds for keep-alive (SSE default is ~45s)
};

/**
 * SSE Reconnect Manager
 */
export class SSEReconnectManager {
	private state: SSEConnectionState = SSEConnectionState.DISCONNECTED;
	private eventSource: EventSource | null = null;
	private attemptCount = 0;
	private lastConnectedAt?: Date;
	private lastDisconnectedAt?: Date;
	private totalReconnects = 0;
	private currentBackoffMs = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
	private messageHandlers: Set<SSEMessageHandler> = new Set();
	private abortController: AbortController | null = null;

	constructor(private config: SSEReconnectConfig = DEFAULT_SSE_RECONNECT_CONFIG) {
		this.currentBackoffMs = config.initialDelayMs;
	}

	/**
	 * Connect to SSE endpoint with reconnection handling
	 */
	async connect(url: string): Promise<void> {
		if (this.state === SSEConnectionState.CONNECTED || 
		    this.state === SSEConnectionState.CONNECTING) {
			logger.warn('SSE connection already exists', { state: this.state });
			return;
		}

		this.abortController = new AbortController();
		await this.connectWithRetry(url);
	}

	/**
	 * Internal connection logic with retry
	 */
	private async connectWithRetry(url: string): Promise<void> {
		while (
			this.state === SSEConnectionState.DISCONNECTED ||
			this.state === SSEConnectionState.RECONNECTING
		) {
			// Check max retries
			if (this.config.maxRetries !== -1 && 
			    this.attemptCount >= this.config.maxRetries) {
				logger.error('SSE max retries exceeded', {
					attempts: this.attemptCount,
					maxRetries: this.config.maxRetries
				});
				this.transitionTo(SSEConnectionState.CLOSED);
				break;
			}

			// Check for abort
			if (this.abortController?.signal.aborted) {
				logger.info('SSE connection aborted');
				this.transitionTo(SSEConnectionState.CLOSED);
				break;
			}

			this.attemptCount++;
			this.transitionTo(SSEConnectionState.CONNECTING);

			try {
				await this.connectOnce(url);
				
				// Connection succeeded
				this.totalReconnects++;
				this.attemptCount = 0;
				this.currentBackoffMs = this.config.initialDelayMs;
				
				logger.info('SSE reconnection successful', {
					reconnectNumber: this.totalReconnects
				});

				// If we get here, connection was closed externally
				// Schedule reconnection
				if (this.state as string !== 'CLOSED') {
					this.scheduleReconnect(url);
				}
			} catch (error) {
				logger.error('SSE connection failed', {
					attempt: this.attemptCount,
					error: error instanceof Error ? error.message : 'Unknown error'
				});

				// Schedule reconnection with backoff
				if (this.state as string !== 'CLOSED') {
					this.scheduleReconnect(url);
				}
			}
		}
	}

	/**
	 * Single connection attempt
	 */
	private async connectOnce(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Close existing connection
				this.closeEventSource();

				// Create new EventSource
				this.eventSource = new EventSource(url);

				// Connection timeout
				const timeoutTimer = setTimeout(() => {
					this.closeEventSource();
					reject(new Error('SSE connection timeout'));
				}, this.config.connectionTimeoutMs);

				// Connection opened
				this.eventSource.onopen = () => {
					clearTimeout(timeoutTimer);
					this.resetKeepAliveTimer();
					this.transitionTo(SSEConnectionState.CONNECTED);
					this.lastConnectedAt = new Date();
				};

				// Handle incoming messages
				this.eventSource.onmessage = (event) => {
					this.resetKeepAliveTimer();
					this.dispatchMessage(event.data, event.lastEventId);
				};

				// Handle errors
				this.eventSource.onerror = (error) => {
					clearTimeout(timeoutTimer);
					
					// EventSource automatically closes on error
					this.eventSource?.close();
					this.eventSource = null;
					
					this.transitionTo(SSEConnectionState.RECONNECTING);
					this.lastDisconnectedAt = new Date();
					this.clearKeepAliveTimer();
					
					reject(new Error('SSE connection error'));
				};

			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Schedule reconnection with exponential backoff
	 */
	private scheduleReconnect(url: string): void {
		if (this.state === SSEConnectionState.CLOSED) {
			return;
		}

		this.transitionTo(SSEConnectionState.RECONNECTING);

		// Calculate backoff with jitter
		const baseDelay = Math.min(
			this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, this.attemptCount - 1),
			this.config.maxDelayMs
		);

		const jitter = this.config.jitter 
			? Math.random() * 0.3 * baseDelay // Add up to 30% randomness
			: 0;

		const delay = baseDelay + jitter;
		this.currentBackoffMs = delay;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connectWithRetry(url);
		}, delay);
	}

	/**
	 * Reset keep-alive timer
	 */
	private resetKeepAliveTimer(): void {
		this.clearKeepAliveTimer();

		this.keepAliveTimer = setTimeout(() => {
			logger.warn('SSE keep-alive timeout, closing connection');
			this.closeEventSource();
			this.transitionTo(SSEConnectionState.RECONNECTING);
		}, this.config.keepAliveTimeoutMs);
	}

	/**
	 * Clear keep-alive timer
	 */
	private clearKeepAliveTimer(): void {
		if (this.keepAliveTimer) {
			clearTimeout(this.keepAliveTimer);
			this.keepAliveTimer = null;
		}
	}

	/**
	 * Dispatch message to all registered handlers
	 */
	private async dispatchMessage(data: string, eventId?: string): Promise<void> {
		for (const handler of this.messageHandlers) {
			try {
				await handler(data, eventId);
			} catch (error) {
				logger.error('Error in SSE message handler', { error });
			}
		}
	}

	/**
	 * Transition to new state
	 */
	private transitionTo(newState: SSEConnectionState): void {
		if (this.state !== newState) {
			this.state = newState;
		}
	}

	/**
	 * Close EventSource connection
	 */
	private closeEventSource(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
	}

	/**
	 * Register message handler
	 */
	onMessage(handler: SSEMessageHandler): () => void {
		this.messageHandlers.add(handler);
		
		// Return unsubscribe function
		return () => {
			this.messageHandlers.delete(handler);
		};
	}

	/**
	 * Get connection statistics
	 */
	getStats(): SSEConnectionStats {
		return {
			state: this.state,
			attemptCount: this.attemptCount,
			lastConnectedAt: this.lastConnectedAt,
			lastDisconnectedAt: this.lastDisconnectedAt,
			totalReconnects: this.totalReconnects,
			currentBackoffMs: this.currentBackoffMs
		};
	}

	/**
	 * Close connection permanently
	 */
	close(): void {
		this.transitionTo(SSEConnectionState.CLOSED);
		
		// Abort any pending operations
		this.abortController?.abort();
		this.abortController = null;

		// Clear timers
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.clearKeepAliveTimer();

		// Close connection
		this.closeEventSource();

		logger.info('SSE connection closed');
	}

	/**
	 * Force reconnection
	 */
	async reconnect(): Promise<void> {
		logger.info('Forcing SSE reconnection');
		
		this.closeEventSource();
		this.attemptCount = 0;
		
		// Reconnect will be triggered by onerror
	}
}

/**
 * Utility to create SSE connection with automatic reconnection
 */
export function createSSEConnection(
	url: string,
	handler: SSEMessageHandler,
	config?: SSEReconnectConfig
): SSEReconnectManager {
	const manager = new SSEReconnectManager(config);
	manager.onMessage(handler);
	manager.connect(url);

	return manager;
}

/**
 * Calculate exponential backoff with jitter
 * Standalone utility for use in other contexts
 */
export function calculateBackoffWithJitter(
	attempt: number,
	initialDelayMs: number,
	maxDelayMs: number,
	multiplier: number = 2,
	jitter: boolean = true
): number {
	const baseDelay = Math.min(
		initialDelayMs * Math.pow(multiplier, attempt),
		maxDelayMs
	);

	if (!jitter) {
		return baseDelay;
	}

	// Add up to 30% randomness
	const randomJitter = Math.random() * 0.3 * baseDelay;
	return baseDelay + randomJitter;
}
