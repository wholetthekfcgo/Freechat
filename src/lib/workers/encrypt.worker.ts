/**
 * Web Worker for Encryption Operations
 * 
 * Offloads CPU-intensive encryption/decryption to a separate thread
 * to prevent blocking the main thread and maintain UI responsiveness.
 */

import { encrypt, decrypt } from '$lib/utils/encryption';

// Worker message types
interface EncryptMessage {
	type: 'encrypt';
	data: any;
	id: string;
}

interface DecryptMessage {
	type: 'decrypt';
	encryptedData: string;
	id: string;
}

type WorkerMessage = EncryptMessage | DecryptMessage;

interface WorkerResponse {
	id: string;
	type: 'success' | 'error';
	result?: string;
	error?: string;
}

/**
 * Handle encryption in worker
 */
function handleEncrypt(data: any): string {
	return encrypt(data);
}

/**
 * Handle decryption in worker
 */
function handleDecrypt(encryptedData: string): any {
	return decrypt(encryptedData);
}

/**
 * Worker message handler
 */
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
	const { type, id } = event.data;

	try {
		let result: string;

		switch (type) {
			case 'encrypt':
				result = handleEncrypt(event.data.data);
				break;
			case 'decrypt':
				result = handleDecrypt(event.data.encryptedData);
				break;
			default:
				throw new Error(`Unknown message type: ${type}`);
		}

		// Send success response
		const response: WorkerResponse = {
			id,
			type: 'success',
			result
		};
		self.postMessage(response);
	} catch (error) {
		// Send error response
		const response: WorkerResponse = {
			id,
			type: 'error',
			error: error instanceof Error ? error.message : 'Unknown error'
		};
		self.postMessage(response);
	}
});

export {};
