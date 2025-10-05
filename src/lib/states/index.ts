import { getSysState } from './sys.svelte';
import { getInputState } from './input.svelte';

export * from './sys.svelte';
export * from './input.svelte';

export function getAllStates() {
	return {
		sysState: getSysState(),
		inputState: getInputState()
	};
}
