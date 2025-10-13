// clamp-lasercube.ts
import type { LasercubeWifi } from '@laser-dac/lasercube-wifi';

type Pt = {
	x: number;
	y: number;
	r?: number;
	g?: number;
	b?: number;
	i?: number;
	[k: string]: any;
};
type Frame = { points: Pt[] };

const finite = (v: any) => (Number.isFinite(v) ? (v as number) : 0);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function repairFrame(frame: Frame, tag = ''): Frame {
	const pts = frame.points;
	if (!pts?.length) return frame;

	let minX = +Infinity,
		maxX = -Infinity,
		minY = +Infinity,
		maxY = -Infinity;
	let foundNaN = false;

	for (const p of pts) {
		const x = finite(p.x),
			y = finite(p.y);
		if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) foundNaN = true;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	const eps = 1e-6;
	const needFit = foundNaN || minX < -1e-9 || maxX > 1 + 1e-9 || minY < -1e-9 || maxY > 1 + 1e-9;

	if (needFit) {
		const w = Math.max(1e-9, maxX - minX);
		const h = Math.max(1e-9, maxY - minY);
		const s = Math.min((1 - 2 * eps) / w, (1 - 2 * eps) / h);
		const offX = eps - minX * s + (1 - 2 * eps - w * s) / 2;
		const offY = eps - minY * s + (1 - 2 * eps - h * s) / 2;
		console.warn(`[laser-guard] auto-fit (${tag})`, { minX, maxX, minY, maxY, s, offX, offY });

		return {
			points: pts.map((p) => ({
				...p,
				x: clamp01(finite(p.x) * s + offX),
				y: clamp01(finite(p.y) * s + offY),
				r: clamp01(finite(p.r ?? 1)),
				g: clamp01(finite(p.g ?? 1)),
				b: clamp01(finite(p.b ?? 1)),
				i: clamp01(finite(p.i ?? 1))
			}))
		};
	}

	// No fit needed; still clamp EVERYTHING
	return {
		points: pts.map((p) => ({
			...p,
			x: clamp01(finite(p.x)),
			y: clamp01(finite(p.y)),
			r: clamp01(finite(p.r ?? 1)),
			g: clamp01(finite(p.g ?? 1)),
			b: clamp01(finite(p.b ?? 1)),
			i: clamp01(finite(p.i ?? 1))
		}))
	};
}

/**
 * Monkey-patch the given LasercubeWifi so ALL outgoing frames are repaired.
 * Works even if the lib uses bound/private methods.
 */
export function patchLasercube(dev: LasercubeWifi, tag = 'lc'): void {
	// @ts-ignore
	const original = dev.streamCallback?.bind(dev);
	if (!original) {
		console.error('[laser-guard] streamCallback missing on device – version mismatch?');
		return;
	}
	// @ts-ignore
	dev.streamCallback = (frame: Frame) => {
		// Validate BEFORE
		const bad = frame.points.find(
			(p) =>
				!Number.isFinite(p.x) ||
				!Number.isFinite(p.y) ||
				p.x < 0 ||
				p.x > 1 ||
				p.y < 0 ||
				p.y > 1 ||
				(p.r ?? 1) < 0 ||
				(p.r ?? 1) > 1 ||
				(p.g ?? 1) < 0 ||
				(p.g ?? 1) > 1 ||
				(p.b ?? 1) < 0 ||
				(p.b ?? 1) > 1
		);
		if (bad) {
			console.warn('[laser-guard] detected out-of-range BEFORE pack', bad);
		}

		const repaired = repairFrame(frame, tag);

		// Sanity check AFTER repair (will log up to 3 offenders if any)
		let count = 0;
		for (const p of repaired.points) {
			if (
				!Number.isFinite(p.x) ||
				!Number.isFinite(p.y) ||
				p.x < 0 ||
				p.x > 1 ||
				p.y < 0 ||
				p.y > 1 ||
				(p.r as number) < 0 ||
				(p.r as number) > 1 ||
				(p.g as number) < 0 ||
				(p.g as number) > 1 ||
				(p.b as number) < 0 ||
				(p.b as number) > 1 ||
				(p.i as number) < 0 ||
				(p.i as number) > 1
			) {
				console.error('[laser-guard] STILL out-of-range AFTER repair', p);
				if (++count >= 3) break;
			}
		}

		// @ts-ignore
		return original(repaired);
	};
}
