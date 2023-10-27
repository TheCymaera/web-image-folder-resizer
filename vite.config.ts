import * as vite from "vite";
import { svelte } from '@sveltejs/vite-plugin-svelte'


export default vite.defineConfig({
	base: "./",
	plugins: [
		svelte(),
	],
});