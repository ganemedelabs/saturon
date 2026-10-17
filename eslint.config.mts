// See https://eslint.org/docs/latest/use/configure/configuration-files for more about configuration files.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { Linter } from "eslint";
import globals from "globals";

export const baseConfig: Linter.Config[] = [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            quotes: "off",
            indent: "off",
            "no-unused-vars": "warn",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/ban-ts-comment": "off",
        },
    },
];

export default baseConfig;
