import { config } from "./config.js";
import { NamedColor, namedColors } from "./namedColors.js";
import { ColorData } from "./syntax.js";
import { systemColors } from "./systemColors.js";

export type Shortcut = (str: string) => ColorData | null; // eslint-disable-line no-unused-vars

export const shortcuts = {
    "<named-color>": (str) => {
        const rgb = namedColors[str as NamedColor];
        if (!rgb) return null;
        return { model: "rgb", coords: [...rgb, 1] };
    },
    "<hex-color>": (str) => {
        if (!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(str)) return null;

        let hex = str.slice(1);
        if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");

        const num = parseInt(hex, 16);
        const is8 = hex.length === 8;

        return {
            model: "rgb",
            coords: is8
                ? [(num >>> 24) & 255, (num >> 16) & 255, (num >> 8) & 255, (num & 255) / 255]
                : [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1],
        };
    },
    "<system-color>": (str) => {
        const key = Object.keys(systemColors).find((k) => k.toLowerCase() === str);
        if (!key) return null;
        const pair = systemColors[key as keyof typeof systemColors];
        const rgb = pair[config.theme === "light" ? 0 : 1];
        return { model: "rgb", coords: [...rgb, 1] };
    },
} as Record<string, Shortcut>;
