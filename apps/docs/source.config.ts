import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { metaSchema } from "fumadocs-core/source/schema";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import lightTheme from "@/themes/2026-light.json" with { type: "json" };
import darkTheme from "@/themes/2026-dark.json" with { type: "json" };

export const docs: ReturnType<typeof defineDocs> = defineDocs({
    docs: {
        postprocess: {
            includeProcessedMarkdown: true,
        },
    },
    meta: {
        schema: metaSchema,
    },
});

export default defineConfig({
    mdxOptions: {
        rehypeCodeOptions: {
            themes: {
                // @ts-ignore
                light: lightTheme,
                // @ts-ignore
                dark: darkTheme,
            },
        },

        remarkPlugins: [remarkMath],
        rehypePlugins: (v) => [rehypeKatex, ...v],
    },
});
