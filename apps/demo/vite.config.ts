import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
    const entries = {
        full: "./src/full.js",
        utils: "./src/utils.js",
    };

    return {
        build: {
            outDir: `dist/${mode}`,
            lib: {
                entry: { index: entries[mode as keyof typeof entries] },
                formats: ["es"],
            },
            rolldownOptions: {
                plugins: [
                    visualizer({
                        filename: `stats-${mode}.html`,
                        open: true,
                        gzipSize: true,
                        brotliSize: true,
                    }),
                ],
            },
        },
    };
});
