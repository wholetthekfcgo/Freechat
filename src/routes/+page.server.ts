import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	// Load user preferences from cookies
	const savedModel = cookies.get('preferred-model');
	const savedThinking = cookies.get('thinking-mode') === 'true';

	return {
		initialModel: savedModel || 'glm-4.7-flash',
		initialThinking: savedThinking
	};
};
