import { FitMethod } from "./fitMethods.js";
import { systemColors } from "./systemColors.js";

/** Represents the config object. */
export type Config = {
    /** The theme of the application, either "light" or "dark". */
    theme: "light" | "dark";

    /** System colors for light and dark themes. */
    systemColors: {
        [key: string]: number[][];
    };

    /** Default options for the engine. */
    defaults: {
        /** Default method for fitting colors into the target gamut. */
        fit: FitMethod;

        /** A small epsilon value used for floating-point comparisons to account for precision errors. */
        epsilon: number;
    };
};

/**
 * Global runtime configuration for the color engine.
 *
 * @type {Config}
 */
export const config: Config = {
    theme: "light",
    systemColors,
    defaults: {
        fit: "clip",
        epsilon: 1e-5,
    },
};

/** Global cache for internal Color operations. */
export const cache = new Map();

/**
 * Merges a partial runtime configuration into the global configuration object.
 *
 * @param options - The partial configuration values to apply.
 */
export function configure(options: Partial<Config>) {
    const merge = <T extends object>(target: T, source: Partial<T>) => {
        for (const key in source) {
            const k = key as keyof T;
            const sourceValue = source[k];

            if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
                if (!target[k] || typeof target[k] !== "object") target[k] = {} as T[keyof T];
                merge(target[k] as object, sourceValue as object);
            } else if (sourceValue !== undefined) {
                target[k] = sourceValue as T[keyof T];
            }
        }
    };

    merge(config, options);
}
