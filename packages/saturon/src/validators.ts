import { cache } from "./config.js";

export type Validator = (str: string, args?: string[]) => boolean; // eslint-disable-line no-unused-vars

/** Registered validators for core CSS grammar tokens such as numbers, percentages, and angles. */
export const validators = (() => {
    const NUMBER_REGEX = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
    const PERCENT_REGEX = /^-?(?:\d+(?:\.\d+)?|\.\d+)%$/;
    const ANGLE_REGEX = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:deg|rad|turn|grad)$/;
    const RANGE_REGEX = /^\[([^,]+),([^\]]+)\]$/;

    const getRange = (args?: string[]) => {
        if (!args) return undefined;
        for (let i = 0; i < args.length; i++) if (RANGE_REGEX.test(args[i])) return args[i];
        return undefined;
    };

    const checkRange = (val: number, rangeStr: string) => {
        let ranges = cache.get("ranges");

        if (!ranges) {
            ranges = new Map<string, { min: number; max: number }>();
            cache.set("ranges", ranges);
        }

        let bounds = ranges.get(rangeStr);

        if (!bounds) {
            const match = rangeStr.match(RANGE_REGEX)!;
            bounds = {
                min: match[1].trim() === "-INF" ? -Infinity : parseFloat(match[1]),
                max: match[2].trim() === "INF" || match[2].trim() === "+INF" ? Infinity : parseFloat(match[2]),
            };
            ranges.set(rangeStr, bounds);
        }

        if (bounds.min !== -Infinity && val < bounds.min) return false;
        if (bounds.max !== Infinity && val > bounds.max) return false;

        return true;
    };

    return {
        "<number>": (str, args) => {
            if (str.startsWith("calc(") && str.endsWith(")")) return true;
            if (!NUMBER_REGEX.test(str)) return false;

            if (args !== undefined) {
                const rangeArg = getRange(args);
                if (rangeArg) return checkRange(parseFloat(str), rangeArg);
            }
            return true;
        },
        "<percentage>": (str, args) => {
            if (str.startsWith("calc(") && str.endsWith(")")) return true;
            if (!PERCENT_REGEX.test(str)) return false;

            if (args !== undefined) {
                const rangeArg = getRange(args);
                if (rangeArg) return checkRange(parseFloat(str), rangeArg);
            }
            return true;
        },
        "<angle>": (str, args) => {
            if (str.startsWith("calc(") && str.endsWith(")")) return true;
            if (!ANGLE_REGEX.test(str)) return false;

            if (args !== undefined) {
                const rangeArg = getRange(args);
                if (rangeArg) return checkRange(parseFloat(str), rangeArg);
            }
            return true;
        },
    } satisfies Record<string, Validator>;
})();
