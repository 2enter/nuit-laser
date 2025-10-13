import * as cheerio from 'cheerio';
import pathBounds from 'svg-path-bounds';

type Mat = [number, number, number, number, number, number]; // a,b,c,d,e,f (SVG matrix)
const I: Mat = [1, 0, 0, 1, 0, 0];

const mul = (m1: Mat, m2: Mat): Mat => {
	const [a1, b1, c1, d1, e1, f1] = m1,
		[a2, b2, c2, d2, e2, f2] = m2;
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1
	];
};
const translateM = (tx: number, ty: number): Mat => [1, 0, 0, 1, tx, ty];
const scaleM = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0];
const rotateM = (deg: number, cx = 0, cy = 0): Mat => {
	const t = (deg * Math.PI) / 180,
		cos = Math.cos(t),
		sin = Math.sin(t);
	return mul(mul(translateM(cx, cy), [cos, sin, -sin, cos, 0, 0]), translateM(-cx, -cy));
};
const skewXM = (deg: number): Mat => {
	const t = (deg * Math.PI) / 180;
	return [1, 0, Math.tan(t), 1, 0, 0];
};
const skewYM = (deg: number): Mat => {
	const t = (deg * Math.PI) / 180;
	return [1, Math.tan(t), 0, 1, 0, 0];
};

const parseTransform = (s?: string | null): Mat => {
	if (!s) return I;
	let m: Mat = I;
	const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(s)) !== null) {
		const kind = match[1];
		const nums = match[2]
			.split(/[\s,]+/)
			.map((n) => Number(n))
			.filter((n) => Number.isFinite(n));
		if (kind === 'matrix' && nums.length >= 6) {
			m = mul(m, [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]]);
		} else if (kind === 'translate') {
			const [tx, ty = 0] = nums;
			m = mul(m, translateM(tx, ty));
		} else if (kind === 'scale') {
			const [sx, sy = sx] = nums;
			m = mul(m, scaleM(sx, sy));
		} else if (kind === 'rotate') {
			const [a, cx = 0, cy = 0] = nums;
			m = mul(m, rotateM(a, cx, cy));
		} else if (kind === 'skewX') {
			m = mul(m, skewXM(nums[0] || 0));
		} else if (kind === 'skewY') {
			m = mul(m, skewYM(nums[0] || 0));
		}
	}
	return m;
};

// apply matrix to a point
const T = (m: Mat, x: number, y: number) => {
	const [a, b, c, d, e, f] = m;
	return { x: a * x + c * y + e, y: b * x + d * y + f };
};

// axis-aligned bbox helper
const bboxOfPoints = (pts: Array<{ x: number; y: number }>) => {
	let minX = +Infinity,
		minY = +Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const p of pts) {
		if (p.x < minX) minX = p.x;
		if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.y > maxY) maxY = p.y;
	}
	return { minX, minY, maxX, maxY };
};

function expandForStroke(
	b: { minX: number; minY: number; maxX: number; maxY: number },
	sw: number,
	m: Mat
) {
	if (!(sw > 0)) return b;
	// approx stroke expansion by average xy scale (good enough to fit)
	const sx = Math.hypot(m[0], m[1]); // column 1 length
	const sy = Math.hypot(m[2], m[3]); // column 2 length
	const grow = (sw / 2) * Math.max(sx, sy);
	return { minX: b.minX - grow, minY: b.minY - grow, maxX: b.maxX + grow, maxY: b.maxY + grow };
}

function bboxOfElement($el: cheerio.Cheerio, mAccum: Mat) {
	const name = $el[0].tagName;
	const tr = parseTransform($el.attr('transform'));
	const m = mul(mAccum, tr);
	const sw = Number(($el.attr('stroke-width') || '').toString().replace(/[^0-9.eE+-]/g, '')) || 0;

	const rect = () => {
		const x = Number($el.attr('x') || 0),
			y = Number($el.attr('y') || 0);
		const w = Number($el.attr('width') || 0),
			h = Number($el.attr('height') || 0);
		const pts = [T(m, x, y), T(m, x + w, y), T(m, x, y + h), T(m, x + w, y + h)];
		return expandForStroke(bboxOfPoints(pts), sw, m);
	};
	const circle = () => {
		const cx = Number($el.attr('cx') || 0),
			cy = Number($el.attr('cy') || 0),
			r = Number($el.attr('r') || 0);
		const pts = [T(m, cx - r, cy), T(m, cx + r, cy), T(m, cx, cy - r), T(m, cx, cy + r)];
		return expandForStroke(bboxOfPoints(pts), sw, m);
	};
	const ellipse = () => {
		const cx = Number($el.attr('cx') || 0),
			cy = Number($el.attr('cy') || 0);
		const rx = Number($el.attr('rx') || 0),
			ry = Number($el.attr('ry') || 0);
		const pts = [T(m, cx - rx, cy), T(m, cx + rx, cy), T(m, cx, cy - ry), T(m, cx, cy + ry)];
		return expandForStroke(bboxOfPoints(pts), sw, m);
	};
	const line = () => {
		const x1 = Number($el.attr('x1') || 0),
			y1 = Number($el.attr('y1') || 0);
		const x2 = Number($el.attr('x2') || 0),
			y2 = Number($el.attr('y2') || 0);
		const pts = [T(m, x1, y1), T(m, x2, y2)];
		return expandForStroke(bboxOfPoints(pts), sw, m);
	};
	const poly = () => {
		const nums = String($el.attr('points') || '')
			.trim()
			.split(/[\s,]+/)
			.map(Number)
			.filter(Number.isFinite);
		const pts = [];
		for (let i = 0; i + 1 < nums.length; i += 2) pts.push(T(m, nums[i], nums[i + 1]));
		return expandForStroke(bboxOfPoints(pts), sw, m);
	};
	const path = () => {
		const d = String($el.attr('d') || '');
		try {
			const [minX, minY, maxX, maxY] = pathBounds(d); // local bbox
			// transform the four corners of that local bbox (conservative over-approx under rotation)
			const pts = [T(m, minX, minY), T(m, maxX, minY), T(m, minX, maxY), T(m, maxX, maxY)];
			return expandForStroke(bboxOfPoints(pts), sw, m);
		} catch {
			return { minX: +Infinity, minY: +Infinity, maxX: -Infinity, maxY: -Infinity };
		}
	};

	if (name === 'rect') return rect();
	if (name === 'circle') return circle();
	if (name === 'ellipse') return ellipse();
	if (name === 'line') return line();
	if (name === 'polyline' || name === 'polygon') return poly();
	if (name === 'path') return path();

	// groups: union of children with composed transform
	if (name === 'g' || name === 'svg' || name === 'symbol') {
		let box = { minX: +Infinity, minY: +Infinity, maxX: -Infinity, maxY: -Infinity };
		$el.children().each((_i, child) => {
			const b = bboxOfElement($el.clone().children().eq(_i), m); // pass composed transform
			if (Number.isFinite(b.minX)) {
				box.minX = Math.min(box.minX, b.minX);
				box.minY = Math.min(box.minY, b.minY);
				box.maxX = Math.max(box.maxX, b.maxX);
				box.maxY = Math.max(box.maxY, b.maxY);
			}
		});
		return box;
	}

	return { minX: +Infinity, minY: +Infinity, maxX: -Infinity, maxY: -Infinity };
}

/**
 * Uniformly fits ALL geometry into (targetW x targetH) and returns a Buffer.
 * Any content sticking out gets pulled back inside the new viewBox.
 */
export function fitSvgXmlToBox(
	svgXml: string,
	targetW: number,
	targetH: number,
	paddingPx = 1
): Buffer {
	const $ = cheerio.load(convertStrokeToHex(svgXml), { xmlMode: true });
	const $svg = $('svg').first();
	if ($svg.length === 0) throw new Error('No <svg> root');

	// Compute geometry bbox (ignore original viewBox for fitting)
	let geom = { minX: +Infinity, minY: +Infinity, maxX: -Infinity, maxY: -Infinity };
	const rootM = parseTransform($svg.attr('transform'));
	// Walk direct children from the actual $svg
	$svg.children().each((_i, el) => {
		const $el = $(el);
		const b = bboxOfElement($el, rootM);
		if (Number.isFinite(b.minX)) {
			geom.minX = Math.min(geom.minX, b.minX);
			geom.minY = Math.min(geom.minY, b.minY);
			geom.maxX = Math.max(geom.maxX, b.maxX);
			geom.maxY = Math.max(geom.maxY, b.maxY);
		}
	});

	// Fallback: if no geometry found, derive from declared viewBox/width/height
	if (!Number.isFinite(geom.minX)) {
		const vb = ($svg.attr('viewBox') || '')
			.trim()
			.split(/[\s,]+/)
			.map(Number);
		if (vb.length === 4) {
			geom = { minX: vb[0], minY: vb[1], maxX: vb[0] + vb[2], maxY: vb[1] + vb[3] };
		} else {
			const w = Number($svg.attr('width') || 1000);
			const h = Number($svg.attr('height') || 1000);
			geom = { minX: 0, minY: 0, maxX: w, maxY: h };
		}
	}

	const srcW = Math.max(1e-9, geom.maxX - geom.minX);
	const srcH = Math.max(1e-9, geom.maxY - geom.minY);

	// inner box with padding
	const innerW = Math.max(1e-6, targetW - 2 * paddingPx);
	const innerH = Math.max(1e-6, targetH - 2 * paddingPx);

	const s = Math.min(innerW / srcW, innerH / srcH); // UNIFORM scale
	const offX = paddingPx + (innerW - srcW * s) / 2 - geom.minX * s;
	const offY = paddingPx + (innerH - srcH * s) / 2 - geom.minY * s;

	// round slightly to avoid -0.00000 epsi
	const r3 = (n: number) => Math.round(n * 1e3) / 1e3;
	const transform = `translate(${r3(offX)},${r3(offY)}) scale(${r3(s)})`;

	const inner = $svg.html() || '';
	$svg.empty().append(`<g transform="${transform}">${inner}</g>`);

	// Normalize root box
	$svg.attr('viewBox', `0 0 ${targetW} ${targetH}`);
	$svg.attr('width', String(targetW));
	$svg.attr('height', String(targetH));
	$svg.attr('preserveAspectRatio', 'xMidYMid meet');
	if (!$svg.attr('xmlns')) $svg.attr('xmlns', 'http://www.w3.org/2000/svg');

	return Buffer.from($.xml(), 'utf8');
}

export function convertStrokeToHex(svgString: string): string {
	const clamp255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

	const pctTo255 = (s: string): number => clamp255((parseFloat(s) / 100) * 255);

	const parseChan = (s: string): number => (/%$/i.test(s) ? pctTo255(s) : clamp255(parseFloat(s)));

	const parseAlpha = (s: string): number => {
		// alpha may be 0-1 or percentage
		if (/%$/i.test(s)) {
			const pct = Math.max(0, Math.min(100, parseFloat(s)));
			return Math.round((pct / 100) * 255);
		}
		const v = Math.max(0, Math.min(1, parseFloat(s)));
		return Math.round(v * 255);
	};

	const toHex2 = (n: number): string => n.toString(16).padStart(2, '0');
	const toHex8 = (r: number, g: number, b: number, a: number): string =>
		`#${toHex2(r)}${toHex2(g)}${toHex2(b)}${toHex2(a)}`;

	// CSS/inline style form: stroke: rgb(...);
	const cssRgb = /(stroke\s*:\s*)rgb\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*\)/gi;
	const cssRgba =
		/(stroke\s*:\s*)rgba\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*\)/gi;

	// Attribute form: stroke="rgb(...)" or stroke='rgba(...)'
	const attrRgb =
		/(stroke\s*=\s*["'])\s*rgb\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*\)\s*(["'])/gi;
	const attrRgba =
		/(stroke\s*=\s*["'])\s*rgba\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*\)\s*(["'])/gi;

	let out = svgString.replace(cssRgb, (_m, prefix: string, r: string, g: string, b: string) => {
		const R = parseChan(r),
			G = parseChan(g),
			B = parseChan(b);
		return prefix + toHex8(R, G, B, 255);
	});
	out = out.replace(
		attrRgb,
		(_m, prefix: string, r: string, g: string, b: string, endQ: string) => {
			const R = parseChan(r),
				G = parseChan(g),
				B = parseChan(b);
			return prefix + toHex8(R, G, B, 255) + endQ;
		}
	);

	out = out.replace(cssRgba, (_m, prefix: string, r: string, g: string, b: string, a: string) => {
		const R = parseChan(r),
			G = parseChan(g),
			B = parseChan(b),
			A = parseAlpha(a);
		return prefix + toHex8(R, G, B, A);
	});

	out = out.replace(
		attrRgba,
		(_m, prefix: string, r: string, g: string, b: string, a: string, endQ: string) => {
			const R = parseChan(r),
				G = parseChan(g),
				B = parseChan(b),
				A = parseAlpha(a);
			return prefix + toHex8(R, G, B, A) + endQ;
		}
	);

	return out;
}
