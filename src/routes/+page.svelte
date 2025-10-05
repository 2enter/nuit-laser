<script lang="ts">
	import type { Eruda } from 'eruda';
	import { dev } from '$app/environment';
	import { fade } from 'svelte/transition';
	import { Pages } from '@/pages';

	import { getAllStates } from '@/states';
	import { onMount } from 'svelte';

	const { sysState } = getAllStates();

	const Page = $derived(Pages[sysState.pageNum]);

	onMount(() => {
		let eruda: Eruda;
		if (dev) {
			setTimeout(async () => {
				eruda = (await import('eruda')).default;
				eruda.init();
			});
		}

		return () => {
			eruda?.destroy();
		};
	});
</script>

<div in:fade={{ duration: 700 }} class="center-content overflow-hidden bg-contain bg-center">
	<Page />
</div>
