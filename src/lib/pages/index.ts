// import { default as Paint } from './paint.svelte';
import { default as P5Paint } from './p5Paint.svelte';
import { default as Intro } from './intro.svelte';

export const Pages = [Intro, P5Paint];
export const MAX_PAGE_NUM = Pages.length - 1;
