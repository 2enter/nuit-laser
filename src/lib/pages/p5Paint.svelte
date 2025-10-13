<script lang="ts">
	import P5 from 'p5';
	import init, { type p5SVG } from 'p5.js-svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Resvg, initWasm } from '@resvg/resvg-wasm';
	import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
	// import { sleep } from '@2enter/web-kit/runtime';

	let svgFile: File;
	let pngFile: File;

	const HUES = [0, 80, 160, 240, 320] as const;
	const TOTAL_INK = 2300;
	const WEIGHT = 7;

	let hue = $state<(typeof HUES)[number]>(HUES[0]);
	let usedInk = $state(0);
	let p5: P5 | undefined;

	const inkRatio = $derived(usedInk / TOTAL_INK);

	init(P5);

	const sketch = (p5: p5SVG) => {
		let lastPos: [number, number] | undefined = undefined;

		p5.setup = () => {
			const height = p5.windowHeight;
			//@ts-ignore
			p5.createCanvas(height / 2, height, p5.SVG).parent('main');
			p5.colorMode(p5.HSB);
			p5.strokeWeight(WEIGHT);
			p5.noFill();
		};

		p5.touchMoved = () => {
			if (usedInk >= TOTAL_INK) return;
			p5.stroke(hue, 255, 255);
			if (!!lastPos) {
				const { mouseX, mouseY } = p5;
				const dist = p5.dist(mouseX, mouseY, lastPos[0], lastPos[1]);
				if (dist > 30) {
					// const ink = dist * weight;
					usedInk += dist;
					p5.line(p5.mouseX, p5.mouseY, lastPos[0], lastPos[1]);
					lastPos = [p5.mouseX, p5.mouseY];
				}
			}
			if (!lastPos) {
				lastPos = [p5.mouseX, p5.mouseY];
			}
		};

		p5.touchEnded = () => {
			console.log('touched ended, used ink: ', usedInk);
			lastPos = undefined;
			let currentHueIndex = HUES.indexOf(hue);
			if (currentHueIndex === -1) {
				currentHueIndex = 0;
			}
			currentHueIndex = (currentHueIndex + 1) % HUES.length;
			hue = HUES[currentHueIndex];
		};
	};

	async function genSubmitData() {
		const el = document.querySelector('svg') as SVGSVGElement;
		const str = new XMLSerializer().serializeToString(el);
		const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
		svgFile = new File([blob], 'svg.svg', { type: blob.type });

		await initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm/index_bg.wasm'));
		const png = new Resvg(str).render().asPng();
		const pngBlob = new Blob([png], { type: 'image/png' });
		pngFile = new File([pngBlob], 'svg.png', { type: 'image/png' });
	}

	async function upload() {
		await genSubmitData();
		if (!svgFile) return;

		// timesup = true;

		const pos = page.url.searchParams.get('pos') ?? '0';
		const formdata = new FormData();
		formdata.append('svg', svgFile);
		formdata.append('png', pngFile);
		formdata.append('pos', pos);
		await fetch('/api/upload', { method: 'POST', body: formdata });
		window.location.reload();
	}

	onMount(() => {
		p5 = new P5(sketch);
		return () => {
			if (p5) {
				p5.remove();
				p5 = undefined;
			}
		};
	});
</script>

<div
	class="full-screen center-content bg-cover bg-center bg-no-repeat *:bg-white/40 *:shadow-inner *:shadow-black/70 *:backdrop-blur-sm"
	id="main"
	style:background-image="url(/bg.png)"
></div>

<div class="fixed top-20 left-3 center-content flex-col gap-2">
	<!-- {#each { length: MAX_WEIGHT } as _, i}
		{@const size = 4 + i}
		{@const displaySize = size * 10}
		<label
			class="center-content rounded-full bg-white shadow-inner shadow-black/60"
			style="width: {displaySize}px; height: {displaySize}px;"
		>
			{#if size === weight}
				<div class="rounded-full bg-black" style="width: {size}px; height: {size}px;"></div>
			{/if}
			<input type="radio" name="weights" bind:group={weight} value={size} hidden />
		</label>
	{/each} -->
	<button
		onclick={() => {
			p5?.clear();
			usedInk = 0;
		}}
	>
		reset
	</button>
	{#each HUES as i}
		<label
			class="size-16 rounded-full border-3 border-transparent shadow-inner shadow-white/40"
			style="background-color: hsl({i}, 100%, 60%)"
			class:border-white={hue === i}
		>
			<input type="radio" name="hues" bind:group={hue} value={i} hidden />
		</label>
	{/each}

	<div class="flex h-32 w-20 flex-col justify-between rounded-b-xl">
		<div class="bg-white/30" style:height="{inkRatio * 100}%"></div>
		<div
			style:background-color="hsla({hue}, 100%, 60%, 0.6)"
			style:height="{(1 - inkRatio) * 100}%"
			class="rounded-b-xl shadow-inner shadow-white/80 backdrop-blur-[3px] transition-all duration-500"
		></div>
	</div>
</div>

<button class="btn fixed bottom-0 left-50" onclick={upload}>submit</button>
