import { configure } from "saturon/config";
import { SystemColor, systemColors } from "saturon/systemColors";
import { parse } from "saturon/parse";
import { convert } from "saturon/convert";
import { toArray } from "saturon/toArray";
import { Color } from "saturon";
import { FormattingOptions } from "saturon/formatters";
import { ColorModel } from "saturon/converters";
import { FitMethod } from "saturon/fitMethods";
import { RandomOptions } from "saturon/random";
import { InputTab, OutputType } from "@/types";

export function detectGamut() {
    if (typeof window === "undefined") return "srgb";
    if (matchMedia("(color-gamut: rec2020)").matches) return "rec2020";
    if (matchMedia("(color-gamut: p3)").matches) return "display-p3";
    return "srgb";
}

let usableGamut: string | null = null;

export function detectUsableGamut() {
    if (!usableGamut && typeof window !== "undefined") usableGamut = detectGamut();
    return usableGamut || "srgb";
}

export function browserSupportsSpace(space: string) {
    if (typeof window === "undefined" || !("CSS" in window) || !CSS.supports) return false;
    return CSS.supports("color", `color(${space} 1 0 0)`);
}

export function supportsSRGBFunction() {
    if (typeof window === "undefined" || !("CSS" in window) || !CSS.supports) return false;
    return CSS.supports("color", "color(srgb 1 0 0)");
}

export function formatColorOutput(color: Color, space: string, options: FormattingOptions) {
    const { fit: method, precision, legacy, units } = options;
    if (browserSupportsSpace(space)) return color.fit({ method, precision }).to(space, { legacy, units });
    if (supportsSRGBFunction()) return color.fit({ method, precision }).to("srgb", { legacy, units });
    return color.fit({ method, precision }).to("rgb", { legacy, units });
}

interface SnippetOptions {
    inputTab: InputTab;
    stringInput: string;
    randomModel: string;
    getCleanRandomOptions: () => Omit<RandomOptions, "model">;
    directModel: string;
    directC1: number;
    directC2: number;
    directC3: number;
    directAlpha: number;
    outputType: OutputType;
    fit: FitMethod;
    precision?: number;
    legacy: boolean;
    units: boolean;
}

export function generateCodeSnippet({
    inputTab,
    stringInput,
    randomModel,
    getCleanRandomOptions,
    directModel,
    directC1,
    directC2,
    directC3,
    directAlpha,
    outputType,
    fit,
    precision,
    legacy,
    units,
}: SnippetOptions): string {
    let code = 'import { Color } from "saturon";\n\n'; // eslint-disable-line quotes

    if (inputTab === "string") {
        code += "// 1. Parse a color string\n";
        code += `const color = Color.from("${stringInput || "transparent"}");\n\n`;
    } else if (inputTab === "random") {
        const parsedOpts: RandomOptions = {
            model: undefined,
            ...getCleanRandomOptions(),
        };
        if (randomModel !== "undefined") parsedOpts.model = randomModel as ColorModel;

        /* eslint-disable indent */
        const optsStr = Object.keys(parsedOpts).length
            ? JSON.stringify(parsedOpts, null, 4)
                  .replace(/"([^"]+)":/g, "$1:")
                  .replace(/\[\s*([\s\S]*?)\s*\]/g, (_, p1) => {
                      const elements = p1.split(/,\s*|\s+/).filter(Boolean);
                      return `[${elements.join(", ")}]`;
                  })
            : ""; /* eslint-enable indent */

        code += "// 1. Generate a random color\n";
        code += `const color = Color.random(${optsStr});\n`;
        if (randomModel === "undefined") {
            code += "// Note: When no model is specified, a random model is chosen,\n";
            code += "// so options like limits, base, and deviation are ignored.\n\n";
        } else code += "\n";
    } else if (inputTab === "direct") {
        code += "// 1. Create a color directly from channel values\n";
        code += `const color = new Color("${directModel}", [${directC1}, ${directC2}, ${directC3}${
            directAlpha === 1 ? "" : ", " + directAlpha
        }]);\n\n`;
    }

    const opts: string[] = [];
    if (fit !== "clip") opts.push(`    fit: "${fit}"`);
    if (precision !== undefined && !Number.isNaN(precision))
        opts.push(`    precision: ${precision > 100 ? null : precision}`);

    if (outputType === "string") {
        const strOpts = [...opts];
        if (legacy) strOpts.push("    legacy: true");
        if (units) strOpts.push("    units: true");
        const strOptsStr = strOpts.length ? `{\n${strOpts.join(",\n")}\n}` : "";

        code += "// 2. Format and output\nconst result = color";
        code += strOpts.length ? `.to(model, ${strOptsStr});\n` : ".to(model);\n";
        code += "// Note: color.in(model).toString(options) works the same as color.to(model, options)";
    } else if (outputType === "object") {
        code += "// 2. Convert to the target model\nconst converted = color.in(model);\n\n";
        code += "// 3. Format the output\n";

        const baseOptsStr = opts.length ? `{\n${opts.join(",\n")}\n}` : "";
        code += `const result = converted.toObject(${baseOptsStr});`;
    } else if (outputType === "array") {
        code += "// 2. Convert to the target model\nconst converted = color.in(model);\n\n";
        code += "// 3. Format the output\n";

        const baseOptsStr = opts.length ? `{\n${opts.join(",\n")}\n}` : "";
        code += `const result = converted.toArray(${baseOptsStr});`;
    }

    return code;
}

export function updateSystemColorsFromEnvironment() {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return null;
    }

    const keys = Object.keys(systemColors) as SystemColor[];

    const readThemeColors = (isDark: boolean): Record<string, number[]> => {
        const el = document.createElement("div");
        el.style.display = "none";

        el.style.colorScheme = isDark ? "dark" : "light";

        document.body.appendChild(el);

        const result: Record<string, number[]> = {};

        for (const key of keys) {
            el.style.backgroundColor = key;

            const computed = window.getComputedStyle(el).backgroundColor;

            try {
                const parsed = parse(computed);
                const coords = convert(parsed, "rgb");
                const [r, g, b] = toArray({ model: "rgb", coords });
                result[key] = [r, g, b];
            } catch {
                result[key] = isDark ? systemColors[key][1] : systemColors[key][0];
            }
        }

        document.body.removeChild(el);
        return result;
    };

    const lightMap = readThemeColors(false);
    const darkMap = readThemeColors(true);

    const updatedSystemColors: Record<string, number[][]> = {};

    for (const key of keys) {
        updatedSystemColors[key] = [lightMap[key] ?? systemColors[key][0], darkMap[key] ?? systemColors[key][1]];
    }

    configure({ systemColors: updatedSystemColors });

    return updatedSystemColors;
}
