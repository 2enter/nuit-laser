import type { Interaction, InteractionInput } from './types/shared';
import axios from 'axios';
import { Api } from '@2enter/web-kit/runtime';
import { objToFD } from '@2enter/web-kit/calc';

const api = new Api(axios.create());

export async function getServerHealth() {
	return api.fetch<boolean>({ url: '/api/health', method: 'GET' });
}

export async function postInteraction(input: InteractionInput) {
	const data = objToFD({ ...input });
	return api.fetch<Interaction>({ url: '/api/interaction', method: 'POST', data });
}
