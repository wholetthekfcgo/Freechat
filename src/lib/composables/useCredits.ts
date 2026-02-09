/**
 * Credits Composable
 * 
 * Manages credit package configuration and redemption logic
 */

import { browser } from '$app/environment';
import { CREDIT_PACKAGES, FREE_REFILL_COOLDOWN_MS, STORAGE_KEY } from '$lib/constants/credits';
import { writable, derived, get, type Readable } from 'svelte/store';

export { CREDIT_PACKAGES };

export function useCredits() {
	const nextRefillTime = writable(Date.now() + FREE_REFILL_COOLDOWN_MS);
	
	const canRefillFree = derived(nextRefillTime, ($time) => 
		!browser || $time < Date.now()
	);

	const timeRemaining = derived(nextRefillTime, ($time) => {
		if (!browser) return '00:00:00';
		const now = Date.now();
		const diff = Math.max(0, $time - now);
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	});

	async function canRedeem(packageId: string): Promise<boolean> {
		if (!browser) return false;

		const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
		if (!pkg) return false;

		if (pkg.isFree) {
			const current = get(nextRefillTime);
			if (current >= Date.now()) {
				return false;
			}
		}

		return true;
	}

	async function redeem(packageId: string): Promise<boolean> {
		if (!browser) return false;

		const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
		if (!pkg) return false;

		if (pkg.isFree) {
			const currentTime = Date.now();
			const refillTime = localStorage.getItem(STORAGE_KEY);

			if (refillTime && currentTime < parseInt(refillTime)) {
				return false;
			}

			const nextRefill = Date.now() + FREE_REFILL_COOLDOWN_MS;
			localStorage.setItem(STORAGE_KEY, nextRefill.toString());
			nextRefillTime.set(nextRefill);
		}

		return true;
	}

	return {
		packages: CREDIT_PACKAGES,
		canRefillFree: canRefillFree as Readable<boolean>,
		timeRemaining: timeRemaining as Readable<string>,
		canRedeem,
		redeem
	};
}
