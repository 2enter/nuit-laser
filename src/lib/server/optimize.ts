import { load } from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

type Pt = { x: number; y: number };

// -------- fixed defaults (no options) --------
const MIN_SEG_LEN = 0.25;
const MAX_SEG_LEN = 120;
const SIMPLIFY_TOL = 0.5;
const DEFAULT_SW = 1;
const LCAP: 'round' = 'round';
const LJOIN: 'round' = 'round';
const STRIP_PAINT_SERVERS = true;

// -------- color helpers (always output #rrggbbaa) --------
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const pctTo255 = (s: string) => clamp255((parseFloat(s) / 100) * 255);
const parseChan = (s: string) => (/%$/i.test(s) ? pctTo255(s) : clamp255(parseFloat(s)));
const parseAlpha = (s: string) => {
	if (/%$/i.test(s)) return clamp255((parseFloat(s) / 100) * 255);
	const v = Math.max(0, Math.min(1, parseFloat(s)));
	return clamp255(v * 255);
};
const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const rgbaHex8 = (r: number, g: number, b: number, a = 255) =>
	`#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;

function normalizeColorToHex8(input: string): string {
	const s = input.trim();

	// rgba()
	let m = s.match(
		/^rgba\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*\)$/i
	);
	if (m) {
		const [, R, G, B, A] = m;
		return rgbaHex8(parseChan(R), parseChan(G), parseChan(B), parseAlpha(A));
	}

	// rgb()
	m = s.match(/^rgb\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*\)$/i);
	if (m) {
		const [, R, G, B] = m;
		return rgbaHex8(parseChan(R), parseChan(G), parseChan(B), 255);
	}

	// #rgb, #rgba, #rrggbb, #rrggbbaa
	m = s.match(/^#([0-9a-f]{3,8})$/i);
	if (m) {
		const hex = m[1];
		if (hex.length === 3) {
			const [r, g, b] = hex
				.split('')
				.map((x) => x + x)
				.map((h) => parseInt(h, 16));
			return rgbaHex8(r, g, b, 255);
		}
		if (hex.length === 4) {
			const [r, g, b, a] = hex
				.split('')
				.map((x) => x + x)
				.map((h) => parseInt(h, 16));
			return rgbaHex8(r, g, b, a);
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			return rgbaHex8(r, g, b, 255);
		}
		if (hex.length === 8) return `#${hex.toLowerCase()}`;
	}

	if (/^currentColor$/i.test(s)) return '#ffffffff';
	return s; // leave var(...) etc. untouched
}

// -------- geometry helpers --------
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function simplifyRDP(points: Pt[], tolerance: number): Pt[] {
	if (tolerance <= 0 || points.length <= 2) return points.slice();
	const keep = new Array(points.length).fill(false);
	keep[0] = keep[points.length - 1] = true;

	function perpDistance(p: Pt, a: Pt, b: Pt): number {
		const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
		const den = Math.hypot(b.y - a.y, b.x - a.x) || 1e-12;
		return num / den;
	}

	function recurse(start: number, end: number) {
		let maxD = -1,
			idx = -1;
		for (let i = start + 1; i < end; i++) {
			const d = perpDistance(points[i], points[start], points[end]);
			if (d > maxD) {
				maxD = d;
				idx = i;
			}
		}
		if (maxD > tolerance) {
			keep[idx] = true;
			recurse(start, idx);
			recurse(idx, end);
		}
	}

	recurse(0, points.length - 1);
	return points.filter((_, i) => keep[i]);
}

function splitLongSegments(points: Pt[], maxLen: number): Pt[] {
	if (maxLen <= 0) return points;
	const out: Pt[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i],
			b = points[i + 1];
		out.push(a);
		const L = dist(a, b);
		if (L > maxLen) {
			const n = Math.ceil(L / maxLen);
			for (let k = 1; k < n; k++) {
				const t = k / n;
				out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
			}
		}
	}
	out.push(points[points.length - 1]);
	return out;
}

function pruneTinySegments(points: Pt[], minLen: number): Pt[] {
	if (minLen <= 0 || points.length <= 2) return points;
	const out: Pt[] = [points[0]];
	for (let i = 1; i < points.length; i++) {
		if (dist(out[out.length - 1], points[i]) >= minLen) out.push(points[i]);
	}
	if (out.length < 2) return points.slice(0, 2);
	return out;
}

function centroid(pts: Pt[]): Pt {
	let sx = 0,
		sy = 0;
	for (const p of pts) {
		sx += p.x;
		sy += p.y;
	}
	const n = Math.max(1, pts.length);
	return { x: sx / n, y: sy / n };
}

function centroidFromPathD(d: string): Pt | null {
	const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[+-]?\d+)?/g);
	if (!tokens) return null;
	let i = 0,
		cmd = '',
		x = 0,
		y = 0;
	const pts: Pt[] = [];
	const readNum = () => parseFloat(tokens[i++]);
	while (i < tokens.length) {
		const t = tokens[i++];
		if (/[A-Za-z]/.test(t)) cmd = t;
		else i--;
		switch (cmd) {
			case 'M':
				x = readNum();
				y = readNum();
				pts.push({ x, y });
				cmd = 'L';
				break;
			case 'm':
				x += readNum();
				y += readNum();
				pts.push({ x, y });
				cmd = 'l';
				break;
			case 'L':
				x = readNum();
				y = readNum();
				pts.push({ x, y });
				break;
			case 'l':
				x += readNum();
				y += readNum();
				pts.push({ x, y });
				break;
			case 'H':
				x = readNum();
				pts.push({ x, y });
				break;
			case 'h':
				x += readNum();
				pts.push({ x, y });
				break;
			case 'V':
				y = readNum();
				pts.push({ x, y });
				break;
			case 'v':
				y += readNum();
				pts.push({ x, y });
				break;
			case 'Z':
			case 'z':
				break;
			default:
				return pts.length ? centroid(pts) : null; // bail on curves
		}
	}
	return pts.length ? centroid(pts) : null;
}

function parsePointsAttr(str: string): Pt[] {
	const nums = (str.trim().match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) || []).map(parseFloat);
	const out: Pt[] = [];
	for (let i = 0; i < nums.length - 1; i += 2) out.push({ x: nums[i], y: nums[i + 1] });
	return out;
}
const pointsToAttr = (pts: Pt[]) =>
	pts.map((p) => `${+p.x.toFixed(3)},${+p.y.toFixed(3)}`).join(' ');

// -------- main (Cheerio) --------
export function optimizeSvgForLaserCube(svg: string): string {
	const $ = load(svg, { xmlMode: true, decodeEntities: false });

	const toRemove = ['filter', 'mask', 'clipPath', 'image', 'foreignObject', 'text'];
	if (STRIP_PAINT_SERVERS) toRemove.push('linearGradient', 'radialGradient', 'pattern');
	$(toRemove.join(',')).remove();

	const drawSel = 'path, polyline, polygon, line';
	$(drawSel).each((_, el) => {
		const $el = $(el);

		$el.removeAttr('fill');

		const inlineStroke = $el.attr('stroke') ?? extractStyleProp($el, 'stroke');
		if (!inlineStroke || /^none$/i.test(inlineStroke)) {
			$el.attr('stroke', '#ffffffff');
		} else {
			$el.attr('stroke', normalizeColorToHex8(inlineStroke));
		}

		const swAttr = $el.attr('stroke-width');
		const sw = swAttr ? parseFloat(swAttr) : NaN;
		$el.attr('stroke-width', Number.isFinite(sw) && sw > 0 ? String(sw) : String(DEFAULT_SW));
		$el.attr('stroke-linecap', LCAP);
		$el.attr('stroke-linejoin', LJOIN);

		$el.removeAttr('stroke-dasharray');
		$el.removeAttr('stroke-dashoffset');

		const styleAttr = $el.attr('style');
		if (styleAttr) {
			const s1 = styleAttr
				.replace(/stroke\s*:\s*rgba?\([^)]*\)/gi, (m) => {
					const color = m.split(':')[1].trim();
					return `stroke: ${normalizeColorToHex8(color)}`;
				})
				.replace(/fill\s*:\s*[^;]+/gi, 'fill: none');
			$el.attr('style', s1);
		}
	});

	$('polyline, polygon').each((_, el) => {
		const $el = $(el);
		let pts = parsePointsAttr($el.attr('points') || '');
		if (pts.length < 2) return;

		if (SIMPLIFY_TOL > 0) pts = simplifyRDP(pts, SIMPLIFY_TOL);
		if (MIN_SEG_LEN > 0) pts = pruneTinySegments(pts, MIN_SEG_LEN);
		if (MAX_SEG_LEN > 0) pts = splitLongSegments(pts, MAX_SEG_LEN);
		if (pts.length < 2) return;

		if (el.tagName?.toLowerCase() === 'polygon') {
			const [f, l] = [pts[0], pts[pts.length - 1]];
			if (f.x !== l.x || f.y !== l.y) pts.push({ ...f });
			$el.attr('fill', 'none');
		}

		$el.attr('points', pointsToAttr(pts));
	});

	type Item = { $el: Cheerio<Element>; c: Pt };
	const items: Item[] = [];
	$(drawSel).each((_, el) => {
		const $el = $(el);
		const tag = el.tagName?.toLowerCase();
		let c: Pt | null = null;

		if (tag === 'polyline' || tag === 'polygon') {
			const pts = parsePointsAttr($el.attr('points') || '');
			c = pts.length ? centroid(pts) : null;
		} else if (tag === 'line') {
			const x1 = parseFloat($el.attr('x1') || '0');
			const y1 = parseFloat($el.attr('y1') || '0');
			const x2 = parseFloat($el.attr('x2') || '0');
			const y2 = parseFloat($el.attr('y2') || '0');
			c = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
		} else if (tag === 'path') {
			c = centroidFromPathD($el.attr('d') || '');
		}

		if (c) items.push({ $el, c });
	});

	if (items.length > 1) {
		const used = new Set<Element>();
		const ordered: Cheerio<Element>[] = [];
		let current = items[0];
		used.add(current.$el[0]);
		ordered.push(current.$el);

		while (ordered.length < items.length) {
			let best = -1,
				bestD = Infinity;
			for (let i = 0; i < items.length; i++) {
				if (used.has(items[i].$el[0])) continue;
				const d = dist(current.c, items[i].c);
				if (d < bestD) {
					bestD = d;
					best = i;
				}
			}
			current = items[best];
			used.add(current.$el[0]);
			ordered.push(current.$el);
		}

		const parent = ordered[0].parent();
		if (parent && parent.length) {
			for (const $el of ordered) parent.append($el);
		}
	}

	$('metadata, title, desc').remove();
	const $root = $('svg').first();
	if ($root.length) $root.attr('fill', 'none');

	return $.xml();
}

function extractStyleProp($el: Cheerio<Element>, prop: string): string | undefined {
	const style = $el.attr('style');
	if (!style) return undefined;
	const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
	const m = style.match(re);
	return m ? m[1].trim() : undefined;
}

export default optimizeSvgForLaserCube;
