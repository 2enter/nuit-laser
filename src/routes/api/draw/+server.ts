
import { json, type ServerLoad } from '@sveltejs/kit';
import { serverState } from '@/server/state';
import { Line, Scene } from '@laser-dac/draw';

type DrawLineRequest = {
	from: {
		x: number, y: number
	}, to: {
		x: number, y: number
	}
	color: [number, number, number]
}

export const POST = async ({ request }) => {
	console.log('receiving draw request');
	const body = await request.json() as DrawLineRequest;


	body.color = [1,0,0]
	const line = new Line({...body, blankBefore: true, blankAfter: true, waitAmount: 0, blankingAmount: 1});

	serverState.scene = new Scene();
	serverState.scene.add(line);

	// serverState.drawLine(body)
    // serverState.dac.stream(serverState.scene)

    console.log('draw line: ', line)


	return json({ message: 'drawed' });
};
