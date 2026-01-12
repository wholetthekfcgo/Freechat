import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	// Load user preferences from cookies
	const savedModel = cookies.get('preferred-model');

	return {
		initialModel: savedModel || 'z-ai/glm-4.5-air:free',
		// Add any other server-side initialization data here
	};
};
