<script lang="ts">
	import P5 from 'p5';
	import init, { type p5SVG } from 'p5.js-svg';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Resvg, initWasm } from '@resvg/resvg-wasm';
	import { RotateCcw, CircleQuestionMark, Send } from '@lucide/svelte';
	import { getSysState } from '@/states';
	import { sleep } from '@2enter/web-kit/runtime';

	const sysState = getSysState();
	const WAIT_TIME = 60;

	let svgFile: File;
	let pngFile: File;
	let wasmReady = false;
	let rainbowMode = $state(false);
	let p5: P5 | undefined;
	let pos: string | undefined;

	const initHueIndex = Math.floor(Math.random() * 5);
	const HUES = [0, 80, 160, 240, 320] as const;
	const TOTAL_INK = 5000;
	const WEIGHT = 8;

	let hue = $state<(typeof HUES)[number]>(HUES[initHueIndex]);
	let usedInk = $state(0);
	let countdown = $state(0);

	const inkRatio = $derived(usedInk / TOTAL_INK);
	const timesup = $derived(countdown <= 0);

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
			if (usedInk >= TOTAL_INK && !timesup) {
				sysState.dialog.pop({
					header: '系統提示 System hint',
					message: '沒有墨水了！No ink remaining!'
				});
				return;
			}
			if (sysState.dialog.opened) return;
			const { mouseX, mouseY } = p5;
			p5.stroke(hue, 200, 130);
			if (!!lastPos) {
				if (mouseX > p5.width || mouseX < 0 || mouseY > p5.height || mouseY < 0) {
					lastPos = undefined;
					return;
				}
				const dist = p5.dist(mouseX, mouseY, lastPos[0], lastPos[1]);
				if (dist > 20) {
					// const ink = dist * weight;
					if (rainbowMode) nextHue();
					usedInk += dist;
					p5.line(lastPos[0], lastPos[1], mouseX, mouseY);
					lastPos = [mouseX, mouseY];
				}
			}
			if (!lastPos) {
				lastPos = [mouseX, mouseY];
			}
			return false;
		};

		p5.touchEnded = () => {
			console.log('touched ended, used ink: ', usedInk);
			lastPos = undefined;
			if (sysState.dialog.opened) {
				return;
			}
		};
	};

	function nextHue() {
		let currentHueIndex = HUES.indexOf(hue);
		if (currentHueIndex === -1) {
			currentHueIndex = 0;
		}
		currentHueIndex = (currentHueIndex + 1) % HUES.length;
		hue = HUES[currentHueIndex];
	}

	async function genSubmitData() {
		await wasmSetup();
		const el = document.querySelector('svg') as SVGSVGElement;
		const str = new XMLSerializer().serializeToString(el);
		const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
		svgFile = new File([blob], 'svg.svg', { type: blob.type });

		const png = new Resvg(str).render().asPng();
		//@ts-ignore
		const pngBlob = new Blob([png], { type: 'image/png' });
		pngFile = new File([pngBlob], 'svg.png', { type: 'image/png' });
	}

	async function wasmSetup() {
		if (wasmReady) return;
		await initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm/index_bg.wasm'));
		wasmReady = true;
	}

	async function upload() {
		if (!pos) {
			window.location.href = '/config';
			return;
		}

		if (sysState.processing) return;
		sysState.startProcess();

		sysState.dialog.close();

		await genSubmitData();
		if (!svgFile) return;

		// const pos = page.url.searchParams.get('pos') ?? '0';
		const formdata = new FormData();
		formdata.append('svg', svgFile);
		formdata.append('png', pngFile);
		formdata.append('pos', pos);

		await fetch('/api/upload', { method: 'POST', body: formdata });
		await sleep(3000);

		window.location.reload();
		// sysState.endProcess();
	}

	function popTutor() {
		sysState.dialog.pop({
			message: `
				左側工具欄的按鈕，由上往下分別是：<br />
				The buttons on the left toolbar, from top to bottom, are:<br/>
				使用說明、清空畫布、紅色、黃色、天藍、藍色、粉紅、彩虹模式、剩餘墨水量。<br />
				Usage instructions, Clear canvas, red, yellow, sky blue, blue, pink, rainbow mode, remaining ink level.<br />
				繪畫完成後，點擊右下角傳送鍵以傳送，或是待60秒後由系統自動上傳。<br />
				After the drawing is completed, click the send button in the lower right corner to send it, or wait for 60 seconds for the system to automatically upload it.
				`,
			header: '使用說明 Usage instructions',
			closeBtnText: '開始繪畫 Start painting',
			onclose: () => {
				sysState.startTimer();
				console.log('starting!');
				countdown = WAIT_TIME - Math.floor(sysState.getDuration() / 1000);
				const timerInterval = setInterval(async () => {
					countdown = WAIT_TIME - Math.floor(sysState.getDuration() / 1000);
					if (countdown <= 0) {
						clearInterval(timerInterval);
						await upload();
					}
				}, 1000);
			}
		});
	}

	onMount(() => {
		const posInStorage = localStorage.getItem('pos');
		if (!posInStorage) {
			window.location.href = '/config';
			return;
		}
		pos = posInStorage;

		p5 = new P5(sketch);
		popTutor();
		return () => {
			if (p5) {
				p5.remove();
				p5 = undefined;
			}
		};
	});
</script>

<div
	class="full-screen center-content bg-cover bg-center bg-no-repeat *:bg-white/30 *:shadow-inner *:shadow-black/70 *:backdrop-blur-md"
	class:pointer-events-none={countdown <= 0}
	id="main"
></div>

<div
	class="fixed top-24 left-0 center-content flex-col gap-2 rounded-r-xl bg-white/60 px-2 py-2 pt-5 shadow-inner shadow-black/30 backdrop-blur-md"
>
	<button class="mb-2" onclick={popTutor}><CircleQuestionMark size="56px" /></button>
	<button
		onclick={() => {
			p5?.clear();
			usedInk = 0;
		}}
		class="mb-3 transition-opacity"
		disabled={usedInk === 0}
		class:opacity-30={usedInk === 0}
	>
		<RotateCcw size="56px" />
	</button>
	{#each HUES as i}
		<label
			class="size-14 rounded-full shadow-inner transition-all duration-400
			{hue === i && !rainbowMode ? 'shadow-black/70' : 'shadow-white/90'}"
			style="background-color: hsla({i}, {rainbowMode ? 50 : 100}%, 50%, {rainbowMode ? 0.3 : 0.9})"
			onclick={() => (rainbowMode = false)}
		>
			<input type="radio" name="hues" bind:group={hue} value={i} hidden />
		</label>
	{/each}

	<label
		class="size-14 rounded-full shadow-inner shadow-black/70"
		class:grayscale={!rainbowMode}
		style:background-image="url(/rainbow.webp)"
	>
		<input type="checkbox" bind:checked={rainbowMode} hidden />
	</label>

	<div
		class="mt-3 flex h-32 w-20 flex-col justify-between rounded-b-xl bg-black/10 shadow-inner shadow-black/30 *:rounded-b-xl"
	>
		<div class="bg-white/30" style:height="{inkRatio * 100}%"></div>
		<div
			style:background-color="hsla({hue}, 100%, 60%, 0.7)"
			style:height="{(1 - inkRatio) * 100}%"
			class:invisible={usedInk >= TOTAL_INK}
			class="shadow-inner shadow-white/80 transition-all duration-300"
		></div>
	</div>
</div>

<div class="fixed top-0 z-[1000] w-screen bg-black py-1 text-center text-2xl font-bold text-white">
	{#if countdown >= 0 && !sysState.processing}
		剩餘時間：{countdown} seconds remaining
	{:else}
		繪畫上傳中~The image is uploading~
	{/if}
</div>

{#if usedInk > 0 && !sysState.processing && countdown >= 0}
	<button
		class="fixed right-3 bottom-3 center-content size-24 rounded-full bg-white/30 p-3 shadow-inner shadow-black/40 backdrop-blur-md"
		onclick={upload}
	>
		<Send size="50px" />
	</button>
{/if}

{#if sysState.processing}
	<div in:fade class="full-screen bg-white/80"></div>
{:else}
	<div in:fade class="pointer-events-none full-screen center-content">
		<img src="/press-bg.webp" class="w-[70%]" alt="" />
	</div>
{/if}
