/** @type {import('next').NextConfig} */
const nextConfig = {
	async rewrites() {
		return [
			{
				source: '/api/v1/:path*',
				destination: `${process.env.API_PROXY_URL ?? 'http://localhost:3001'}/v1/:path*`,
			},
		];
	},
};
module.exports = nextConfig;
