import fs from 'fs';
import { json } from '@sveltejs/kit';
import { fitSvgXmlToBox } from '@/server/svg';
import { serverState } from '@/server/state';
import { optimizeSvgForLaserCube } from '@/server/optimize.js';
import { sleep } from '@2enter/web-kit/runtime';
import { FILE_FORMAT } from '@/config.js';

export const POST = async ({ request }) => {
	console.log('receiving request');
	const fd = await request.formData();
	const file = fd.get('file') as File;
	const pos = parseInt(fd.get('pos') as string);

	const id = serverState.currentDisplay[pos] + 1;
	const resultPath = `uploads/${pos}/${id}.${FILE_FORMAT}`;

	const buf = await file.arrayBuffer();

	switch (FILE_FORMAT) {
		case 'svg':
			const svgStr = new TextDecoder().decode(buf);
			const processedSvg = fitSvgXmlToBox(optimizeSvgForLaserCube(svgStr), 500, 1000, 50);
			await fs.promises.writeFile(resultPath, Buffer.from(processedSvg));
			break;
		case 'png':
			await fs.promises.writeFile(resultPath, Buffer.from(buf));
			break;
	}

	await sleep(20);
	await serverState.updateScene(pos, id);

	console.log('upload finished');

	return json({ message: 'File uploaded successfully' });
};
