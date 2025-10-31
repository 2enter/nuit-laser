import 'dotenv/config';
import mkcert from 'vite-plugin-mkcert';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// build: {
	// 	rollupOptions: {
	// 		external: ['sharp']
	// 	}
	// },
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
			// strategy: ['url', 'cookie', 'baseLocale']
		}),
		mkcert()
	],
	ssr: {
		external: ['@resvg/resvg-js', 'sharp']
	},
	optimizeDeps: {
		exclude: ['@resvg/resvg-js', 'sharp']
	},
	server: {
		host: '0.0.0.0',
		https: {}
	}
});
