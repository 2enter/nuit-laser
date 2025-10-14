import { default as Paint } from './paint.svelte';
import { default as Intro } from './intro.svelte';

export const Pages = [Intro, Paint];
export const MAX_PAGE_NUM = Pages.length - 1;
