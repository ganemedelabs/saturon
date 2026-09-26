// See https://eslint.org/docs/latest/use/configure/configuration-files for more about configuration files.

import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { baseConfig } from "../../eslint.config.mjs";

const config: Linter.Config[] = [
    ...baseConfig,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
                projectService: {
                    allowDefaultProject: ["eslint.config.mts"],
                },
            },
        },
    },
    {
        ignores: ["dist/", "node_modules/", "eslint.config.mts", "jest.config.ts", "prettier.config.mts"],
    },
];

export default config;
