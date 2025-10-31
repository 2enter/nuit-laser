import fs from 'fs-extra';
import { DAC } from '@laser-dac/core';
import { loadSvgFile, Scene, Svg } from '@laser-dac/draw';
import { LasercubeWifi } from '@laser-dac/lasercube-wifi';
import { MODE } from '@/config';

const PPS = 30000;
const FPS = 5;
const SIZE = 0.35;
const WAIT_AMOUNT = 20;
const BLANK_AMOUNT = 2;
const MAX_POINT = 1650;

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
		const margin = (1 - SIZE * 2) / 3;
		const svg = new Svg({
			file,
			x: pos % 2 !== 1 ? margin : SIZE + margin,
			y: margin,
			size: SIZE,
			waitAmount: WAIT_AMOUNT,
			blankingAmount: BLANK_AMOUNT
		});

		this.scene.add(svg);
	}

	async updateScene(pos: number, id: number) {
		const { pos: anotherPos, id: anotherId } = this.getAnotherPosAndId(pos);

		if (MODE === 'cube') {
			this.scene.reset();
			this.addSVG(pos, id);
			this.addSVG(anotherPos, anotherId);

			// make the total point number under 2000
			const pointAmount = this.scene.points.length;
			if (pointAmount > MAX_POINT) {
				const toRemove = pointAmount - MAX_POINT;
				const removeRatio = toRemove / pointAmount;
				this.scene.points = this.scene.points.filter(() => Math.random() > removeRatio);
			}

			console.log(pointAmount, '-->', this.scene.points.length);
			this.dac.stream(this.scene);
		} else {
			const sharp = (await import('sharp')).default;
			const left = await sharp(`./uploads/${pos}/${id}.png`, {}).resize(500, 1000).toBuffer();
			const right = await sharp(`./uploads/${anotherPos}/${anotherId}.png`)
				.resize(500, 1000)
				.toBuffer();

			await sharp({
				create: {
					width: 1000,
					height: 1000,
					channels: 4,
					// transparent background; change if you want a color fill
					background: { r: 0, g: 0, b: 0, alpha: 0 }
				}
			})
				.composite([
					{ input: left, left: pos < anotherPos ? 0 : 500, top: 0 },
					{ input: right, left: pos < anotherPos ? 500 : 0, top: 0 }
				])
				.png() // change to .jpeg() if you want JPG
				.toFile(`./uploads/${pos < 2 ? 'left' : 'right'}.png`);
		}

		this.currentDisplay[pos] = id;
	}

	async initCurrentDisplayIds() {
		for (let pos = 0; pos < 4; pos++) {
			const entries = await fs.readdir(`./uploads/${pos}`, { withFileTypes: true });
			let max = -Infinity;
			for (const e of entries) {
				if (!e.isFile()) continue;
				const m = e.name.match(/^(\d+)\.png/i);
				if (!m) continue;
				const n = Number(m[1]);
				if (Number.isSafeInteger(n) && n > max) max = n;
			}

			this.currentDisplay[pos] = max === -Infinity ? 0 : max;
		}
		console.log(this.currentDisplay);
		// for (let i = 0; i < 1; i++) {
		// 	const toDisplay = this.currentDisplay[i];
		// 	if (toDisplay > 0) {
		// 		this.updateScene(i, toDisplay);
		// 	}
		// }
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
