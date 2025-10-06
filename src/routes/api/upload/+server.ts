import { json } from '@sveltejs/kit';
import fs from 'fs';

export const POST = async ({ request }) => {
	const fd = await request.formData();
	const svg = fd.get('svg') as File;
	const png = fd.get('png') as File;
	const pos = +(fd.get('pos') ?? ('0' as string));

	const filename = getCurrentDateTimeString();

	const svgPath = `uploads/${pos}-${filename}.svg`;
	const pngPath = `uploads/${pos}-${filename}.png`;

	console.log(svg, png);
	await fs.promises.writeFile(svgPath, Buffer.from(await svg.arrayBuffer()));
	await fs.promises.writeFile(pngPath, Buffer.from(await png.arrayBuffer()));

	return json({ message: 'File uploaded successfully' });
};

function getCurrentDateTimeString() {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const day = now.getDate();
	const hour = now.getHours();
	const minute = now.getMinutes();
	const filename = `${year}-${month}-${day}-${hour}-${minute}`;
	return filename;
}
