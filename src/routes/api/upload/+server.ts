import fs from 'fs';
import { json } from '@sveltejs/kit';
import { fitSvgXmlToBox } from '@/server/svg';
import { serverState } from '@/server/state';
import { optimizeSvgForLaserCube } from '@/server/optimize.js';
import { sleep } from '@2enter/web-kit/runtime';

export const POST = async ({ request }) => {
	console.log('receiving request');
	const fd = await request.formData();
	const svg = fd.get('svg') as File;
	const png = fd.get('png') as File;
	const pos = parseInt(fd.get('pos') as string);

	const id = serverState.currentDisplay[pos] + 1;

	const svgPath = `uploads/${pos}/${id}.svg`;
	const pngPath = `uploads/${pos}/${id}.png`;

	const svgBuf = await svg.arrayBuffer();
	const pngBuf = await png.arrayBuffer();

	const svgStr = new TextDecoder().decode(svgBuf);
	const processedSvg = fitSvgXmlToBox(optimizeSvgForLaserCube(svgStr), 500, 1000, 50);

	await fs.promises.writeFile(svgPath, Buffer.from(processedSvg));
	await fs.promises.writeFile(pngPath, Buffer.from(pngBuf));

	await sleep(20);
	await serverState.updateScene(pos, id);

	console.log('upload finished');

	return json({ message: 'File uploaded successfully' });
};
