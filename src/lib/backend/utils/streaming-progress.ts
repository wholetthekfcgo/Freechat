/**
 * Streaming Progress Callbacks
 * 
 * Provides progress tracking for long-running operations
 * Supports streaming with real-time progress updates
 * 
 * Features:
 * - Progress percentage tracking
 * - Cancellable operations
 * - ETA calculation
 * - Stage-based progress
 * - Real-time streaming updates
 * 
 * Time Complexity: O(1) for progress updates
 * Space Complexity: O(1) - fixed state
 */

import { logger } from '$lib/utils/logger';

export interface ProgressState {
	current: number;
	total: number;
	percentage: number;
	eta: number | null;
	stage: string;
	startTime: number;
	elapsed: number;
	isComplete: boolean;
	isCancelled: boolean;
	metadata?: Record<string, unknown>;
}

export interface ProgressCallback {
	(progress: ProgressState): void | Promise<void>;
}

export interface ProgressOptions {
	// Total items to process
	total: number;
	// Current stage name
	stage?: string;
	// Enable ETA calculation
	calculateETA?: boolean;
	// Update interval (ms) for throttling callbacks
	updateInterval?: number;
	// Metadata
	metadata?: Record<string, unknown>;
}

/**
 * Progress Tracker
 */
export class ProgressTracker {
	private state: ProgressState;
	private callbacks: Set<ProgressCallback> = new Set();
	private lastCallbackTime = 0;
	private updateInterval: number;
	private calculateETA: boolean;

	constructor(options: ProgressOptions) {
		this.updateInterval = options.updateInterval || 100;
		this.calculateETA = options.calculateETA !== false;

		this.state = {
			current: 0,
			total: options.total,
			percentage: 0,
			eta: null,
			stage: options.stage || 'Processing',
			startTime: Date.now(),
			elapsed: 0,
			isComplete: false,
			isCancelled: false,
			metadata: options.metadata
		};
	}

	/**
	 * Register a progress callback
	 */
	onProgress(callback: ProgressCallback): () => void {
		this.callbacks.add(callback);
		
		// Return unsubscribe function
		return () => {
			this.callbacks.delete(callback);
		};
	}

	/**
	 * Update progress
	 */
	update(current: number, stage?: string): void {
		this.state.current = current;
		this.state.percentage = Math.min((current / this.state.total) * 100, 100);
		this.state.elapsed = Date.now() - this.state.startTime;

		if (stage) {
			this.state.stage = stage;
		}

		// Calculate ETA
		if (this.calculateETA && current > 0 && !this.state.isComplete) {
			const elapsedMs = this.state.elapsed;
			const progressPerMs = current / elapsedMs;
			const remaining = this.state.total - current;
			
			if (progressPerMs > 0) {
				this.state.eta = remaining / progressPerMs;
			} else {
				this.state.eta = null;
			}
		}

		// Check if complete
		if (current >= this.state.total) {
			this.state.isComplete = true;
			this.state.percentage = 100;
		}

		// Throttle callbacks
		const now = Date.now();
		if (now - this.lastCallbackTime >= this.updateInterval || this.state.isComplete) {
			this.lastCallbackTime = now;
			this.notifyCallbacks();
		}
	}

	/**
	 * Increment progress by 1
	 */
	increment(amount: number = 1, stage?: string): void {
		this.update(this.state.current + amount, stage);
	}

	/**
	 * Complete the progress
	 */
	complete(): void {
		this.update(this.state.total, 'Complete');
	}

	/**
	 * Cancel the operation
	 */
	cancel(): void {
		this.state.isCancelled = true;
		this.notifyCallbacks();
	}

	/**
	 * Update metadata
	 */
	setMetadata(key: string, value: unknown): void {
		if (!this.state.metadata) {
			this.state.metadata = {};
		}
		this.state.metadata[key] = value;
	}

	/**
	 * Get current state
	 */
	getState(): ProgressState {
		return { ...this.state };
	}

	/**
	 * Notify all callbacks
	 */
	private async notifyCallbacks(): Promise<void> {
		for (const callback of this.callbacks) {
			try {
				await callback(this.getState());
			} catch (error) {
				logger.error('Progress callback error', error);
			}
		}
	}
}

/**
 * Streaming Progress Manager
 */
export class StreamingProgressManager {
	private trackers = new Map<string, ProgressTracker>();

	/**
	 * Create a new progress tracker
	 */
	create(id: string, options: ProgressOptions): ProgressTracker {
		const tracker = new ProgressTracker(options);
		this.trackers.set(id, tracker);
		return tracker;
	}

	/**
	 * Get an existing tracker
	 */
	get(id: string): ProgressTracker | undefined {
		return this.trackers.get(id);
	}

	/**
	 * Remove a tracker
	 */
	remove(id: string): void {
		this.trackers.delete(id);
	}

	/**
	 * Cancel all operations
	 */
	cancelAll(): void {
		for (const tracker of this.trackers.values()) {
			tracker.cancel();
		}
	}

	/**
	 * Get all active states
	 */
	getAllStates(): Record<string, ProgressState> {
		const states: Record<string, ProgressState> = {};
		
		for (const [id, tracker] of this.trackers) {
			states[id] = tracker.getState();
		}

		return states;
	}
}

/**
 * Singleton instance
 */
export const progressManager = new StreamingProgressManager();

/**
 * Create a progress tracker with streaming support
 */
export function createProgressTracker(
	id: string,
	total: number,
	options?: Partial<ProgressOptions>
): ProgressTracker {
	return progressManager.create(id, {
		total,
		...options
	});
}

/**
 * Wrap an async function with progress tracking
 */
export async function withProgressTracking<T>(
	fn: (progress: ProgressTracker) => Promise<T>,
	total: number,
	options?: Partial<ProgressOptions>
): Promise<T> {
	const tracker = new ProgressTracker({
		total,
		...options
	});

	try {
		const result = await fn(tracker);
		tracker.complete();
		return result;
	} catch (error) {
		tracker.cancel();
		throw error;
	}
}

/**
 * Convert progress to SSE stream
 */
export function progressToSSE(
	tracker: ProgressTracker,
	id: string = crypto.randomUUID()
): ReadableStream {
	let controller: ReadableStreamDefaultController<Uint8Array>;

	const sendEvent = (data: unknown) => {
		if (controller) {
			controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
		}
	};

	// Register callback
	tracker.onProgress((state) => {
		sendEvent({
			type: 'progress',
			id,
			...state
		});

		// Send done event if complete
		if (state.isComplete || state.isCancelled) {
			sendEvent({
				type: state.isComplete ? 'complete' : 'cancelled',
				id,
				...state
			});
			controller.close();
		}
	});

	return new ReadableStream({
		start(c) {
			controller = c;

			// Send initial state
			sendEvent({
				type: 'init',
				id,
				...tracker.getState()
			});
		},
		cancel() {
			tracker.cancel();
		}
	});
}

/**
 * Stage-based progress tracking
 */
export class StageProgressTracker {
	private currentStage = 0;
	private stages: Array<{ name: string; weight: number }>;
	private tracker: ProgressTracker;

	constructor(stages: Array<{ name: string; weight: number }>) {
		// Normalize weights
		const totalWeight = stages.reduce((sum, s) => sum + s.weight, 0);
		this.stages = stages.map(s => ({ ...s, weight: s.weight / totalWeight }));

		// Create parent tracker with total weight as 100%
		this.tracker = new ProgressTracker({
			total: 100,
			calculateETA: true
		});
	}

	/**
	 * Move to next stage
	 */
	nextStage(): void {
		if (this.currentStage < this.stages.length) {
			this.currentStage++;
		}
	}

	/**
	 * Update progress within current stage
	 */
	update(current: number, total: number): void {
		// Calculate overall progress including all stages
		let overallProgress = 0;

		// Add completed stages
		for (let i = 0; i < this.currentStage; i++) {
			overallProgress += this.stages[i].weight * 100;
		}

		// Add current stage progress
		const currentStage = this.stages[this.currentStage];
		if (currentStage) {
			const stageProgress = (current / total) * currentStage.weight * 100;
			overallProgress += stageProgress;
		}

		this.tracker.update(Math.round(overallProgress), this.stages[this.currentStage]?.name);
	}

	/**
	 * Get the progress tracker
	 */
	getTracker(): ProgressTracker {
		return this.tracker;
	}

	/**
	 * Register callback
	 */
	onProgress(callback: ProgressCallback): () => void {
		return this.tracker.onProgress(callback);
	}
}

/**
 * Batch progress tracker
 */
export class BatchProgressTracker {
	private trackers: Map<string, ProgressTracker> = new Map();
	private completed = 0;
	private total: number;

	constructor(batchSize: number) {
		this.total = batchSize;
	}

	/**
	 * Add an item to the batch
 */
	addItem(id: string, itemTotal: number): ProgressTracker {
		const tracker = new ProgressTracker({
			total: itemTotal,
			stage: `Processing ${id}`
		});

		this.trackers.set(id, tracker);

		// Track individual item completion
		tracker.onProgress((state) => {
			if (state.isComplete) {
				this.completed++;
				this.updateOverall();
			}
		});

		return tracker;
	}

	/**
	 * Update overall batch progress
	 */
	private updateOverall(): void {
		// Overall progress is average of all items
		let totalProgress = 0;

		for (const tracker of this.trackers.values()) {
			totalProgress += tracker.getState().percentage;
		}

		const overallPercentage = totalProgress / this.trackers.size;
		this.overallProgress = overallPercentage;
	}

	private overallProgress = 0;

	/**
	 * Get overall batch progress
	 */
	getOverallProgress(): number {
		return this.overallProgress;
	}

	/**
	 * Check if batch is complete
	 */
	isComplete(): boolean {
		return this.completed === this.total;
	}
}

/**
 * Progress formatter for display
 */
export function formatProgress(state: ProgressState): {
	percentage: string;
	eta: string;
	elapsed: string;
	stage: string;
} {
	return {
		percentage: `${state.percentage.toFixed(1)}%`,
		eta: state.eta ? `${(state.eta / 1000).toFixed(1)}s` : 'N/A',
		elapsed: `${(state.elapsed / 1000).toFixed(1)}s`,
		stage: state.stage
	};
}

/**
 * Progress bar formatter
 */
export function formatProgressBar(state: ProgressState, width: number = 30): string {
	const filled = Math.round((state.percentage / 100) * width);
	const empty = width - filled;

	const bar = '█'.repeat(filled) + '░'.repeat(empty);
	return `[${bar}] ${state.percentage.toFixed(1)}%`;
}

/**
 * Utility to track async operation progress
 */
export async function trackProgress<T>(
	operation: (progress: (current: number, total: number) => void) => Promise<T>,
	total: number,
	onProgress?: (state: ProgressState) => void
): Promise<T> {
	const tracker = new ProgressTracker({
		total,
		calculateETA: true
	});

	if (onProgress) {
		tracker.onProgress(onProgress);
	}

	try {
		// Run operation with progress callback
		const result = await operation((current) => {
			tracker.update(current);
		});

		tracker.complete();
		return result;
	} catch (error) {
		tracker.cancel();
		throw error;
	}
}
