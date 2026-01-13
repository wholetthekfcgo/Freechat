/**
 * Command Pattern Implementation
 * Provides undo/redo functionality for chat operations
 */

import type { Message } from '$lib/types/chat';

/**
 * Command interface for undoable operations
 */
export interface Command {
	/**
	 * Execute the command
	 */
	execute(): Promise<void>;

	/**
	 * Undo the command
	 */
	undo(): Promise<void>;

	/**
	 * Check if command can be executed
	 */
	canExecute(): boolean;

	/**
	 * Human-readable description
	 */
	description: string;
}

/**
 * Command stack for managing undo/redo history
 */
export class CommandStack {
	private history: Command[] = $state([]);
	private currentIndex: number = $state(-1);

	/**
	 * Execute a command and add to history
	 */
	async execute(command: Command): Promise<void> {
		if (!command.canExecute()) {
			return;
		}

		try {
			await command.execute();

			// Remove any redo history when new command is executed
			this.history = this.history.slice(0, this.currentIndex + 1);
			this.history.push(command);
			this.currentIndex++;
		} catch (error) {
			console.error('Command execution failed:', error);
			throw error;
		}
	}

	/**
	 * Undo the last command
	 */
	async undo(): Promise<void> {
		if (this.currentIndex < 0) {
			return;
		}

		const command = this.history[this.currentIndex];
		try {
			await command.undo();
			this.currentIndex--;
		} catch (error) {
			console.error('Command undo failed:', error);
			throw error;
		}
	}

	/**
	 * Redo the next command
	 */
	async redo(): Promise<void> {
		if (this.currentIndex >= this.history.length - 1) {
			return;
		}

		this.currentIndex++;
		const command = this.history[this.currentIndex];
		try {
			await command.execute();
		} catch (error) {
			console.error('Command redo failed:', error);
			this.currentIndex--; // Revert on failure
			throw error;
		}
	}

	/**
	 * Check if undo is available
	 */
	canUndo(): boolean {
		return this.currentIndex >= 0;
	}

	/**
	 * Check if redo is available
	 */
	canRedo(): boolean {
		return this.currentIndex < this.history.length - 1;
	}

	/**
	 * Get the current command (for UI display)
	 */
	getCurrentCommand(): Command | null {
		if (this.currentIndex < 0) return null;
		return this.history[this.currentIndex];
	}

	/**
	 * Clear all history
	 */
	clear(): void {
		this.history = [];
		this.currentIndex = -1;
	}

	/**
	 * Get history size
	 */
	get size(): number {
		return this.history.length;
	}
}

/**
 * Global command stack instance
 */
export const commandStack = new CommandStack();
