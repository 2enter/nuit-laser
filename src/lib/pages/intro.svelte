<script lang="ts">
	import { getAllStates } from '@/states';
	const { sysState } = getAllStates();
</script>

<button
	onclick={sysState.navigate}
	class="size-48 rounded-full p-1 text-4xl font-bold text-black/70 shadow-inner shadow-white/80 backdrop-blur-xl"
>
	開始
	<br />
	Start
</button>
