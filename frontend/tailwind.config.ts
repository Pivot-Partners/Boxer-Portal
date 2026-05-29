import type { Config } from 'tailwindcss';

const config: Config = {
	content: [
		'./app/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./lib/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			colors: {
				primary: {
					50:  '#fff0f0',
					100: '#ffd6d6',
					200: '#ffadad',
					300: '#ff7070',
					400: '#ff3333',
					500: '#e60000',
					600: '#cc0000',
					700: '#a80000',
					800: '#880000',
					900: '#660000',
				},
			},
		},
	},
	plugins: [],
};

export default config;
