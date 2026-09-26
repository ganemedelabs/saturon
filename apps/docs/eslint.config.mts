// See https://eslint.org/docs/latest/use/configure/configuration-files for more about configuration files.

import { fileURLToPath } from "node:url";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import { Linter } from "eslint";
import { baseConfig } from "../../eslint.config.mjs";

const eslintConfig: Linter.Config[] = [
    ...baseConfig,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
                projectService: {
                    allowDefaultProject: ["eslint.config.mts", "postcss.config.mjs", "prettier.config.mts"],
                },
            },
        },
    },

    {
        plugins: { "@next/next": nextPlugin },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs["core-web-vitals"].rules,
        },
    },

    reactPlugin.configs.flat.recommended,
    reactPlugin.configs.flat["jsx-runtime"],
    {
        settings: {
            react: { version: "detect" },
        },
    },

    jsxA11yPlugin.flatConfigs.recommended,

    {
        rules: {
            indent: ["warn", 4],
            quotes: ["warn", "double"],
            "@typescript-eslint/ban-ts-comment": "off",
        },
    },
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "out/**",
            "build/**",
            ".source/**",
            "next-env.d.ts",
            "eslint.config.mts",
            "postcss.config.mjs",
            "prettier.config.mts",
        ],
    },
];

export default eslintConfig;
