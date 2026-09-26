// See https://prettier.io/docs/configuration for more about configuration files.

import type { Config } from "prettier";
import baseConfig from "../../prettier.config.mts";

const config: Config = {
    ...baseConfig,
    plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
