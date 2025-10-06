<script lang="ts">
	import type { Locale } from '@/paraglide/runtime';
	import 'js-draw/bundledStyles';
	import { getLocale, locales, setLocale } from '@/paraglide/runtime';
	import { sleep } from '@2enter/web-kit/runtime';
	import { m } from '@/paraglide/messages';
	import { Editor, Color4, PenTool, EraserTool, Vec2, EraserMode } from 'js-draw';
	import { onMount } from 'svelte';
	import { localizations } from '@/localization';
	import { page } from '$app/state';

	const locale = getLocale();
	const anotherLocale = locales.find((l) => l !== locale) as Locale;
	const localization = localizations[locale];

	let editor = $state<Editor>();
	let countdown = $state(getCountDown());

	let dom = $state<HTMLDivElement>();

	let svgFile = $state<File>();
	let pngFile = $state<File>();
	let resultImgUrl = $state<string>();
	let timesup = $state(false);

	function getCountDown() {
		const now = new Date().getSeconds();
		return 60 - now;
	}

	async function upload() {
		if (!editor) return;
		await genSubmitData();
		if (!svgFile || !pngFile) return;

		timesup = true;

		const pos = page.url.searchParams.get('pos') ?? '0';
		const formdata = new FormData();
		formdata.append('svg', svgFile);
		formdata.append('png', pngFile);
		formdata.append('pos', pos);
		await fetch('/api/upload', { method: 'POST', body: formdata });
		await sleep(2000);
		window.location.reload();
	}

	async function genSubmitData() {
		if (!editor || !dom) return;
		if (editor.history.undoStackSize === 0) return;
		{
			const svg = editor.toSVG();
			svg.setAttribute('width', '500');
			svg.setAttribute('height', '1000');
			const svgStr = svg.outerHTML;
			const blob = new Blob([svgStr], { type: 'image/svg+xml' });
			const file = new File([blob], 'image.svg', { type: 'image/svg+xml' });
			svgFile = file;
		}
		{
			resultImgUrl = editor.toDataURL('image/png', Vec2.of(dom.clientHeight / 2, dom.clientHeight));
			const blob = await fetch(resultImgUrl).then((res) => res.blob());
			const file = new File([blob], 'image.png', { type: 'image/png' });
			pngFile = file;
		}
	}

	function init() {
		if (!dom) return;
		editor = new Editor(dom, {
			localization,
			wheelEventsEnabled: false,
			minZoom: 1,
			maxZoom: 1
		});

		const height = dom.clientHeight;
		const width = height / 2;
		const rootEl = editor.getRootElement();
		rootEl.style.height = `${height}px`;
		rootEl.style.width = `${width}px`;
		rootEl.addEventListener('touchstart', (ev) => {
			if (ev.touches.length > 1) {
				ev.preventDefault();
				ev.stopPropagation();
				return false;
			}
			return true;
		});

		// dom.addEventListener('touchend', () => updateResultUrl());

		editor.dispatch(
			editor.setBackgroundStyle({
				color: Color4.transparent,
				autoresize: true,
				type: 0
			}),
			false
		);
		editor.getCurrentSettings();
		editor.addToolbar();

		const penTools = editor.toolController.getMatchingTools(PenTool);
		penTools.forEach((pen) => {
			pen.setColor(
				Color4.fromHSV(Math.random() * 360, Math.random() * 0.3 + 0.7, Math.random() * 0.2 + 0.8)
			);
			pen.setThickness(Math.random() * 53 + 2);
		});

		const eraserTools = editor.toolController.getMatchingTools(EraserTool);
		eraserTools.forEach((eraser) => eraser.getModeValue().set(EraserMode.PartialStroke));
	}

	onMount(() => {
		init();
		const interval = setInterval(() => {
			countdown = getCountDown();
			if (countdown === 60) {
				upload();
			}
		}, 1000);

		return () => clearInterval(interval);
	});
</script>

<div bind:this={dom} class="full-screen center-content bg-white"></div>

<button
	class="fixed top-3 left-3 size-20 rounded-full bg-cyan-500 p-3 text-4xl text-black shadow-inner shadow-black/30"
	onclick={() => {
		if (confirm(m.switchLocaleConfirm())) setLocale(anotherLocale);
	}}
>
	{#if anotherLocale === 'en'}
		EN
	{:else if anotherLocale === 'zh-tw'}
		中
	{/if}
</button>

<div
	class:text-rose-600={countdown < 15}
	class:animate-bounce={countdown < 8}
	class="fixed top-0 right-0 p-4 text-5xl font-bold text-black"
>
	{countdown}
</div>

<!-- <div class="fixed top-0 center-content w-screen">
	<button class="btn" onclick={upload}>click</button>
</div> -->

{#if timesup}
	<div class="full-screen center-content text-5xl text-white backdrop-blur-sm">
		{m.timesup()}
	</div>
{/if}
