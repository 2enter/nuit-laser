<script lang="ts">
	function setPosition(pos: number) {
		localStorage.setItem('pos', pos.toString());
		window.location.href = '/';
	}
</script>

<div class="full-screen center-content gap-3">
	{#each { length: 4 } as _, i}
		<button class="btn" onclick={() => setPosition(i)}>
			{i}
		</button>
	{/each}
</div>
