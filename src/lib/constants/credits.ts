/**
 * Credit Package Configuration
 * 
 * Defines available credit packages and their properties
 */

export interface CreditPackage {
	id: string;
	name: string;
	credits: number;
	price: number;
	popular: boolean;
	description: string;
	isFree: boolean;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
	{
		id: 'starter',
		name: 'Free Refill',
		credits: 30,
		price: 0,
		popular: false,
		description: 'Free 30 credits every hour',
		isFree: true
	},
	{
		id: 'standard',
		name: 'Standard',
		credits: 100,
		price: 5,
		popular: true,
		description: 'Best value for regular users',
		isFree: false
	},
	{
		id: 'premium',
		name: 'Premium',
		credits: 250,
		price: 10,
		popular: false,
		description: 'For power users',
		isFree: false
	}
] as const;

export const FREE_REFILL_COOLDOWN_MS = 60 * 60 * 1000;
export const STORAGE_KEY = 'freeCreditRefillTime';
