// See https://jestjs.io/docs/configuration for more about configuration files.

import { Config } from "jest";

const config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/*.test.ts"],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "./tsconfig.json",
            },
        ],
    },
} satisfies Config;

export default config;
