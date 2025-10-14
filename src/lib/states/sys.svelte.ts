import { getContext, setContext } from 'svelte';
import { MAX_PAGE_NUM } from '@/pages';

class Dialog {}

class SysState {
	processing = $state(false);
	pageNum = $state<number>(0);
	startTime = $state<number>();
	dialog = $state<HTMLDialogElement>();
	dialogMessage = $state<string | null>(null);
	dialogHeader = $state<string | null>(null);
	onDialogClose = () => {};

	popDialog = (header: string, message: string, onclose?: () => void) => {
		this.dialogMessage = message;
		this.dialogHeader = header;
		if (onclose) {
			this.onDialogClose = onclose;
		}
		if (!this.dialog) return;
		this.dialog.showModal();
	};

	closeDialog = () => {
		if (!this.dialog) return;
		this.dialog.close();
		this.onDialogClose();
		this.dialogMessage = null;
		this.dialogHeader = null;
		this.onDialogClose = () => {};
	};

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
