import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import path from "path";

const withMDX = createMDX();

const monorepoRoot = path.resolve(__dirname, "../../");

const config = {
    reactStrictMode: true,
    outputFileTracingRoot: monorepoRoot,
    transpilePackages: ["saturon"],
    turbopack: {
        root: monorepoRoot,
    },
} satisfies NextConfig;

export default withMDX(config);
