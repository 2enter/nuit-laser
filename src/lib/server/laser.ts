import { DAC } from '@laser-dac/core';
import { LasercubeWifi } from '@laser-dac/lasercube-wifi';
import { Scene, Svg, loadSvgFile } from '@laser-dac/draw';
import { patchLasercube } from './improveLaser';

declare global {
	var __laserDac__: DAC | undefined;
}

const scene = new Scene();

export async function getDac() {
	if (!globalThis.__laserDac__) {
		const dac = new DAC();
		const lasercube = new LasercubeWifi();
		patchLasercube(lasercube, 'main');
		dac.use(lasercube);
		console.log('trying to use lasercube');

		globalThis.__laserDac__ = dac;
		if (import.meta && import.meta.hot) {
			import.meta.hot.dispose(() => {
				dac.stop().catch(() => {});
				globalThis.__laserDac__ = undefined;
			});
		}
		const started = await globalThis.__laserDac__.start();
		console.log(started);
		dac.stream(scene, 30000, 0.5);
	}

	scene.reset();
	addSvg('./uploads/0/2025-10-13-0-29.svg', scene, 'left', [1, 0, 0]);
	// addSvg('./uploads/0/combine-test.svg', scene, 'left', [1, 0, 0]);
	addSvg('./uploads/0/2025-10-13-0-47.svg', scene, 'right', [0, 1, 0]);
}

function addSvg(
	path: string,
	scene: Scene,
	pos: 'left' | 'right',
	color: [number, number, number]
) {
	const file = loadSvgFile(path);
	// scene.reset();
	console.log(pos);
	const svg = new Svg({
		file,
		x: pos === 'left' ? 0 : 0.5,
		y: 0,
		size: 0.48,
		color
		// waitAmount: 80
		// blankingAmount: 10
	});
	scene.add(svg);
}
