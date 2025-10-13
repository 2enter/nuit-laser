import { DAC } from '@laser-dac/core';
import { loadSvgFile, Scene, Svg } from '@laser-dac/draw';
import { LasercubeWifi } from '@laser-dac/lasercube-wifi';
import fs from 'fs-extra';

const PPS = 30000;
const FPS = 10;
const SIZE = 0.39;
const WAIT_AMOUNT = 20;
const BLANK_AMOUNT = 2.5;

class ServerState {
	dac: DAC;
	scene: Scene;
	currentDisplay: [number, number, number, number];
	started = false;

	constructor() {
		this.dac = new DAC();
		this.scene = new Scene();
		this.currentDisplay = [0, 0, 0, 0];
	}

	addSVG(pos: number, id: number) {
		const file = loadSvgFile(`./uploads/${pos}/${id}.svg`);
		const margin = (1 - SIZE * 2) / 2;
		const svg = new Svg({
			file,
			x: pos % 2 !== 1 ? margin : SIZE + margin,
			y: 0,
			size: SIZE,
			waitAmount: WAIT_AMOUNT,
			blankingAmount: BLANK_AMOUNT
			// color: [Math.random(), Math.random(), Math.random()]
		});

		this.scene.add(svg);
	}

	updateScene(pos: number, id: number) {
		const { pos: anotherPos, id: anotherId } = this.getAnotherPosAndId(pos);

		this.scene.reset();
		this.addSVG(pos, id);
		this.addSVG(anotherPos, anotherId);

		console.log(this.scene.points.length);

		this.currentDisplay[pos] = id;
	}

	async initCurrentDisplayIds() {
		for (let pos = 0; pos < 4; pos++) {
			const entries = await fs.readdir(`./uploads/${pos}`, { withFileTypes: true });
			let max = -Infinity;
			for (const e of entries) {
				if (!e.isFile()) continue;
				const m = e.name.match(/^(\d+)\.svg$/i);
				if (!m) continue;
				const n = Number(m[1]);
				if (Number.isSafeInteger(n) && n > max) max = n;
			}

			this.currentDisplay[pos] = max === -Infinity ? 0 : max;
		}
		console.log(this.currentDisplay);
		for (let i = 0; i < 1; i++) {
			this.updateScene(i, this.currentDisplay[i]);
		}
	}

	dacConnect() {
		if (this.started) return;
		this.dac.use(new LasercubeWifi());
	}

	async dacStart() {
		if (this.started) return;
		this.started = await this.dac.start();
		console.log('started:', this.started);
		this.dac.stream(this.scene, PPS, FPS);
	}

	getAnotherPosAndId(pos: number): { pos: number; id: number } {
		switch (pos) {
			case 0:
				return { pos: 1, id: this.currentDisplay[1] };
			case 1:
				return { pos: 0, id: this.currentDisplay[0] };
			case 2:
				return { pos: 3, id: this.currentDisplay[3] };
			case 3:
				return { pos: 2, id: this.currentDisplay[2] };
			default:
				throw new Error('Invalid id');
		}
	}
}

export const serverState = new ServerState();
