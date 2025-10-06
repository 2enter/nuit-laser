<script lang="ts">
	import 'js-draw/bundledStyles';
	import { getLocale, locales, setLocale } from '@/paraglide/runtime';
	import type { Locale } from '@/paraglide/runtime';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { Editor, Color4, PenTool, EraserTool, Vec2, EraserMode } from 'js-draw';
	import { onMount } from 'svelte';
	import { localizations } from '@/localization';

	const locale = getLocale();
	const anotherLocale = locales.find((l) => l !== locale) as Locale;

	const localization = localizations[locale];

	let editor = $state<Editor>();
	let countdown = $state(getCountDown());

	let dom: HTMLDivElement;

	let resultUrl = $state<string | null>(null);
	let svgFile = $state<File>();
	let pngFile = $state<File>();

	function getCountDown() {
		const now = new Date().getSeconds();
		return 60 - now;
	}

	async function upload() {
		if (!editor || !svgFile || !pngFile) return;
		const formdata = new FormData();
		formdata.append('svg', svgFile);
		formdata.append('png', pngFile);
		const res = await fetch('/api/upload', { method: 'POST', body: formdata });
		console.log(res);
		window.location.reload();
	}

	async function updateResultUrl() {
		if (!editor) return;
		if (editor.history.undoStackSize === 0) return;
		{
			const svg = editor.toSVG();
			const svgStr = svg.outerHTML;
			const blob = new Blob([svgStr], { type: 'image/svg+xml' });
			const file = new File([blob], 'image.svg', { type: 'image/svg+xml' });
			svgFile = file;
		}
		{
			const png = editor.toDataURL('image/png', Vec2.of(500, 1000));
			const blob = await fetch(png).then((res) => res.blob());
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

		editor.getRootElement().style.height = `${innerHeight.current}px`;
		editor.getRootElement().style.width = `${innerWidth.current}px`;

		dom.addEventListener('touchend', () => updateResultUrl());

		editor.dispatch(
			editor.setBackgroundStyle({
				color: Color4.white,
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
				Color4.fromString(
					'#' +
						Math.floor((Math.random() * 0xffffff) << 0)
							.toString(16)
							.padStart(6, '0')
				)
			);
			pen.setThickness(Math.random() * 53 + 2);
		});

		const eraserTools = editor.toolController.getMatchingTools(EraserTool);
		eraserTools.forEach((eraser) => eraser.getModeValue().set(EraserMode.PartialStroke));
	}

	onMount(() => {
		init();
		setInterval(() => {
			countdown = getCountDown();
			if (countdown === 1) {
				upload();
			}
		}, 1000);
	});
</script>

<div bind:this={dom} class="full-screen bg-base-100">
	<div class="pointer-events-none full-screen flex flex-col justify-between px-3 pb-6 text-8xl">
		<div class="mt-3 flex w-full items-center justify-between *:pointer-events-auto">
			<button class="text-4xl text-black" onclick={() => setLocale(anotherLocale)}>
				{#if anotherLocale === 'en'}
					En
				{:else if anotherLocale === 'zh-tw'}
					中
				{/if}
			</button>
		</div>
	</div>
</div>

<div class="fixed top-0 right-0 p-3 text-5xl font-bold text-black">
	{countdown}
</div>

{#if resultUrl}
	<img src={resultUrl} alt="" />
{/if}
