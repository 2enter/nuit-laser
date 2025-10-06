<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { m } from '@/paraglide/messages';
	import { locales, localizeHref } from '@/paraglide/runtime';
	import { setInputState, setSysState } from '@/states';
	import { page } from '$app/state';

	let { children } = $props();

	const sysState = setSysState();
	setInputState();
</script>

{@render children?.()}

<dialog bind:this={sysState.dialog} class="modal modal-middle">
	<div class="modal-box">
		<h1>{m.error()}</h1>
		<p>{sysState.errorMessage}</p>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-secondary" onclick={sysState.closeError}> Close</button>
			</form>
		</div>
	</div>
</dialog>

<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
