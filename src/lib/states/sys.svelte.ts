import { getContext, setContext } from 'svelte';
import { MAX_PAGE_NUM } from '@/pages';

class Dialog {
	dom?: HTMLDialogElement;
	message = $state<string>();
	header = $state<string>();
	closeBtnText = $state<string>();
	opened = $state(false);
	onclose = () => {};

	pop = (args: {
		message: string;
		header: string;
		closeBtnText?: string;
		onclose?: () => void;
	}) => {
		this.message = args.message;
		this.header = args.header;
		this.closeBtnText = args.closeBtnText ?? '關閉 Close';

		if (args.onclose) this.onclose = args.onclose;

		this.dom?.showModal();
		this.opened = true;
	};

	close = () => {
		if (!this.dom) return;
		this.dom.close();
		this.onclose();

		this.message = undefined;
		this.header = undefined;
		this.closeBtnText = undefined;
		this.onclose = () => {};

		this.opened = false;
	};
}

class SysState {
	processing = $state(false);
	pageNum = $state<number>(0);
	startTime = $state<number>();
	dialog = $state(new Dialog());

	startTimer = () => {
		this.startTime = Date.now();
	};

	getDuration = () => {
		if (!this.startTime) return 0;
		return Date.now() - this.startTime;
	};

	startProcess = () => {
		this.processing = true;
	};

	endProcess = () => {
		this.processing = false;
	};

	navigate = (step?: any) => {
		if (typeof step !== 'number') {
			step = 1;
		}

		let result = this.pageNum + step;

		if (result < 0 || result > MAX_PAGE_NUM) {
			console.error('invalid page navigation');
			return;
		}

		this.routeTo(result);
	};

	routeTo = (num: number) => {
		if (num === this.pageNum) return;
		setTimeout(() => (this.pageNum = num));
	};
}

const SYS_STATE_CTX = 'SYS_STATE';

function setSysState() {
	return setContext(SYS_STATE_CTX, new SysState());
}

function getSysState() {
	return getContext<ReturnType<typeof setSysState>>(SYS_STATE_CTX);
}

export { setSysState, getSysState };
