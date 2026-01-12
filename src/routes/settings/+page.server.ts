import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	const preferredModel = cookies.get('preferred-model');

	return {
		preferredModel: preferredModel || 'openai/gpt-oss-20b:free'
	};
};

export const actions: Actions = {
	savePreferences: async ({ request, cookies }) => {
		const data = await request.formData();
		const model = data.get('model');

		if (!model || typeof model !== 'string') {
			return fail(400, { model: true });
		}

		cookies.set('preferred-model', model, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		return { success: true };
	}
};
