<script lang="ts">
	import { getAllStates } from '@/states';
	const { sysState } = getAllStates();
</script>

<button
	onclick={sysState.navigate}
	class="size-48 rounded-full p-1 text-4xl font-bold text-black/70 shadow-inner shadow-white/80 backdrop-blur-[4px]"
>
	開始
	<br />
	Start
</button>

<div
	class="fixed bottom-0 left-0 size-3"
	ondblclick={() => (window.location.href = '/config')}
></div>
