import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter(),
        alias: {
            src: "./src"
        },
        csrf: {
            checkOrigin: false,
        }
    }
};

export default config;