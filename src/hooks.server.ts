import type { Handle, ServerInit } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { serverState } from '@/server/state';
import { MODE } from '@/config';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

export const init: ServerInit = async () => {
	await serverState.initCurrentDisplayIds();
	if (MODE === 'cube') {
		serverState.dacConnect();
		serverState.dacStart();
	}
};

export const handle: Handle = handleParaglide;
