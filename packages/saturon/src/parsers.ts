import { evaluateCSSValue } from "./calc.js";
import { parseColorMixFunction } from "./colorMix.js";
import { config } from "./config.js";
import { convert } from "./convert.js";
import { ColorModel, ColorModelConverter, colorModels, colorSpaces, ComponentDefinition } from "./converters.js";
import { ColorData, parseNode, ParseNode } from "./syntax.js";
import { normalizeComponentValue } from "./toArray.js";
import { toObject } from "./toObject.js";

/**
 * Extracts the first usable token value from a parse tree node.
 *
 * @param n - The parse tree node.
 * @returns The extracted token as a string.
 */
export function extractToken(n: ParseNode): string {
    if (typeof n === "string") return n;
    if (n.type === "<percentage>") return String(n.value || "");
    if (Array.isArray(n.value)) return extractToken(n.value[0]);
    return String(n.value || "");
}

/**
 * Evaluates a parse tree component node into a numeric value.
 *
 * @param node - The parse tree node to evaluate.
 * @param expectedType - The expected component value type.
 * @param base - Optional variables available for relative color evaluation.
 * @returns The evaluated numeric component value.
 */
export function evaluateComponent(
    node: ParseNode,
    expectedType: ComponentDefinition["value"],
    base: Record<string, number> = {}
): number {
    if (!node) return NaN;

    const token = extractToken(node);
    return evaluateCSSValue(token, expectedType, base);
}

/**
 * Creates a parser for legacy comma-separated color function syntax.
 *
 * @param model - The target color model.
 * @param componentKeys - The component names for the parser's three channels.
 * @returns A parser function for the matched AST node.
 */
export function createLegacyColorParser(model: ColorModel, componentKeys: [string, string, string]) {
    return (node: ParseNode) => {
        const t = node.value as ParseNode[];
        const config = colorModels[model].components as Record<string, ComponentDefinition>;

        const c1 = evaluateComponent(t[2], config[componentKeys[0]].value);
        const c2 = evaluateComponent(t[4], config[componentKeys[1]].value);
        const c3 = evaluateComponent(t[6], config[componentKeys[2]].value);

        let alpha = 1;
        if (t[7]?.type === "symbol" && t[7]?.value === ",") alpha = evaluateComponent(t[8], [0, 1]);

        return { model, coords: [c1, c2, c3, alpha] };
    };
}

/**
 * Creates a parser for modern space-separated color function syntax.
 *
 * @param model - The target color model.
 * @param componentKeys - The component names for the parser's three channels.
 * @returns A parser function for the matched AST node.
 */
export function createModernColorParser(model: ColorModel, componentKeys: [string, string, string]) {
    return (node: ParseNode) => {
        const t = node.value as ParseNode[];
        const config = colorModels[model].components as Record<string, ComponentDefinition>;

        const c1 = evaluateComponent(t[2], config[componentKeys[0]].value);
        const c2 = evaluateComponent(t[3], config[componentKeys[1]].value);
        const c3 = evaluateComponent(t[4], config[componentKeys[2]].value);

        let alpha = 1;
        if (t[5]?.type === "symbol" && t[5]?.value === "/") alpha = evaluateComponent(t[6], [0, 1]);

        return { model, coords: [c1, c2, c3, alpha] };
    };
}

/**
 * Creates a parser for relative color syntax that uses an origin color as context.
 *
 * @param model - The target color model.
 * @param componentKeys - The component names for the parser's three channels.
 * @returns A parser function for the matched AST node.
 */
export function createRelativeColorParser(model: ColorModel, componentKeys: [string, string, string]) {
    return (node: ParseNode) => {
        const t = node.value as ParseNode[];
        const config = colorModels[model].components as Record<string, ComponentDefinition>;

        const originColorNode = t[3];

        const origin = parseNode(originColorNode);

        const convertedCoords = convert(origin, model);

        const baseEnv = toObject({ model, coords: convertedCoords }, { fit: "none", precision: null });

        const c1 = evaluateComponent(t[4], config[componentKeys[0]].value, baseEnv);
        const c2 = evaluateComponent(t[5], config[componentKeys[1]].value, baseEnv);
        const c3 = evaluateComponent(t[6], config[componentKeys[2]].value, baseEnv);

        let alpha = 1;
        if (t[7]?.type === "symbol" && t[7]?.value === "/") {
            alpha = evaluateComponent(t[8], [0, 1], baseEnv);
        }

        return {
            model,
            coords: [c1, c2, c3, alpha],
        };
    };
}

/**
 * Parses a relative color function that uses a color function as its source context.
 *
 * @param node - The parse tree node for the relative color function.
 * @returns The parsed color data.
 */
export function createRelativeColorFunctionParser(node: ParseNode) {
    const t = node.value as ParseNode[];

    const origin = parseNode(t[3]);

    const spaceNode = t[4];
    const targetModel = (Array.isArray(spaceNode.value) ? spaceNode.value[0]?.value : spaceNode.value) as ColorModel;

    const targetCoords = convert(origin, targetModel);
    const baseEnv = toObject({ model: targetModel, coords: targetCoords }, { fit: "none", precision: null });

    const c1 = evaluateComponent(t[5], [0, 1], baseEnv);
    const c2 = evaluateComponent(t[6], [0, 1], baseEnv);
    const c3 = evaluateComponent(t[7], [0, 1], baseEnv);

    let alpha = 1;
    if (t[8]?.type === "symbol" && t[8]?.value === "/") {
        alpha = evaluateComponent(t[9], [0, 1], baseEnv);
    }

    return {
        model: targetModel,
        coords: [c1, c2, c3, alpha],
    };
}

export function bindColorFunctionParsers(
    name: string,
    converter: ColorModelConverter,
    parsersTarget: Record<string, (node: ParseNode) => ColorData> // eslint-disable-line no-unused-vars
) {
    const compKeys = Object.keys(converter.components).filter((k) => k !== "alpha") as [string, string, string];

    const attach = (fName: string) => {
        parsersTarget[`<${fName}()>`] = (node: ParseNode) => parseNode(node.value[0] as ParseNode);
        parsersTarget[`<modern-${fName}-syntax>`] = createModernColorParser(name as ColorModel, compKeys);
        parsersTarget[`<relative-${fName}-syntax>`] = createRelativeColorParser(name as ColorModel, compKeys);

        if (converter.supportsLegacy) {
            parsersTarget[`<legacy-${fName}-syntax>`] = createLegacyColorParser(name as ColorModel, compKeys);
        }
    };

    attach(name);
    if (converter.alphaVariant) attach(converter.alphaVariant);
}

// eslint-disable-next-line no-unused-vars
export function bindColorSpaceParsers(name: string, parsersTarget: Record<string, (node: ParseNode) => ColorData>) {
    parsersTarget[`<relative-${name}-color-syntax>`] = createRelativeColorFunctionParser;
}

/** Parser handlers for CSS syntax rules and color functions. */
export const parsers = (() => {
    const parseCmykComponent = (n: ParseNode) => {
        if (!n?.value) return 0;
        const raw = Array.isArray(n.value) ? n.value[0]?.value : n.value;
        return parseFloat(raw as string);
    };

    const base = {
        "<color>": (node) => {
            const child = node.value[0] as ParseNode<"literal">;
            const { type, value } = child;
            if (type === "literal") {
                if (value === "currentcolor") return { model: "rgb", coords: [0, 0, 0, 1] };
                else throw new Error(`Unknown <color>: ${value}`);
            }
            return parseNode(child);
        },

        "<color-base>": (node) => {
            const child = node.value[0] as ParseNode<"literal">;
            const { type, value } = child;
            if (type === "literal") {
                if (value === "transparent") return { model: "rgb", coords: [0, 0, 0, 0] };
                else throw new Error(`Unknown <color-base>: ${value}`);
            }
            return parseNode(child);
        },

        "<contrast-color()>": (node) => {
            // contrast-color ( <color> )
            const colorNode = node.value[2] as ParseNode;
            const parsed = parseNode(colorNode);
            const [, luminance] = convert(parsed, "xyz-d65");
            return { model: "rgb", coords: luminance > 0.5 ? [0, 0, 0, 1] : [255, 255, 255, 1] };
        },

        "<light-dark-color>": (node) => {
            const children = node.value;

            // light-dark ( <color> , <color> )
            const lightNode = children[2] as ParseNode;
            const darkNode = children[4] as ParseNode;

            const parsed = parseNode(config.theme === "light" ? lightNode : darkNode);
            const coords = convert(parsed, "rgb");
            return { model: "rgb", coords };
        },

        "<device-cmyk()>": (node) => parseNode(node.value[0] as ParseNode),

        "<legacy-device-cmyk-syntax>": (node) => {
            // device-cmyk( <number>#{4} )
            const t = node.value as ParseNode[];
            const [c, m, y, k] = [t[2], t[4], t[6], t[8]].map(parseCmykComponent);

            return {
                model: "rgb",
                coords: [
                    (1 - (c * (1 - k) + k)) * 255,
                    (1 - (m * (1 - k) + k)) * 255,
                    (1 - (y * (1 - k) + k)) * 255,
                    1,
                ],
            };
        },

        "<modern-device-cmyk-syntax>": (node) => {
            // device-cmyk( <cmyk-component>{4} [ / [ <alpha-value> | none ] ]? )
            const t = node.value as ParseNode[];

            const c = evaluateComponent(t[2], [0, 1]);
            const m = evaluateComponent(t[3], [0, 1]);
            const y = evaluateComponent(t[4], [0, 1]);
            const k = evaluateComponent(t[5], [0, 1]);

            const alphaNode = t.find(
                (c, idx) => idx === 7 && (c.type === "<alpha-value>" || (c.type === "literal" && c.value === "none"))
            );

            const alpha = alphaNode ? evaluateComponent(alphaNode, [0, 1]) : 1;

            const cMath = normalizeComponentValue(c, [0, 1]);
            const mMath = normalizeComponentValue(m, [0, 1]);
            const yMath = normalizeComponentValue(y, [0, 1]);
            const kMath = normalizeComponentValue(k, [0, 1]);

            const alphaMath = isNaN(alpha) ? alpha : Math.max(0, Math.min(1, alpha));

            return {
                model: "rgb",
                coords: [
                    (1 - (cMath * (1 - kMath) + kMath)) * 255,
                    (1 - (mMath * (1 - kMath) + kMath)) * 255,
                    (1 - (yMath * (1 - kMath) + kMath)) * 255,
                    alphaMath,
                ],
            };
        },

        "<color-mix()>": parseColorMixFunction,

        "<color-function>": (node) => parseNode(node.value[0] as ParseNode),
        "<custom-color-function>": (node) => parseNode(node.value[0] as ParseNode),

        "<alpha()>": (node) => {
            const children = node.value as ParseNode[];

            // alpha(from <color> / [ <alpha-value> | none ])
            const colorNode = children[3];
            const origin = parseNode(colorNode);
            if (!origin) throw new Error("Missing or invalid origin color in alpha() function");

            const baseEnv = toObject(origin, { fit: "none", precision: null });

            const alphaNode = children.find(
                (c, idx) => c.type === "<alpha-value>" || (idx === 5 && c.type === "literal" && c.value === "none")
            );

            const targetAlpha = alphaNode ? evaluateComponent(alphaNode, [0, 1], baseEnv) : origin.coords[3];

            return {
                model: origin.model,
                coords: [...origin.coords.slice(0, 3), targetAlpha],
            };
        },

        "<color()>": (node) => parseNode(node.value[0] as ParseNode),

        "<relative-color-syntax>": (node) => parseNode(node.value[0] as ParseNode),

        "<absolute-color-syntax>": (node) => {
            const t = node.value as ParseNode[];

            const spaceNode = t[2];
            const model = Array.isArray(spaceNode.value) ? spaceNode.value[0]?.value : spaceNode.value;

            const c1 = evaluateComponent(t[3], [0, 1]);
            const c2 = evaluateComponent(t[4], [0, 1]);
            const c3 = evaluateComponent(t[5], [0, 1]);

            const alphaNode = t.find(
                (c, idx) => idx > 5 && (c.type === "<alpha-value>" || (c.type === "literal" && c.value === "none"))
            );

            const alpha = alphaNode ? evaluateComponent(alphaNode, [0, 1]) : 1;

            return {
                model,
                coords: [c1, c2, c3, alpha],
            };
        },

        "<relative-custom-color-syntax>": (node) => parseNode(node.value[0] as ParseNode),
    } as Record<string, (node: ParseNode) => ColorData>; // eslint-disable-line no-unused-vars

    for (const [name, converter] of Object.entries(colorModels) as [string, ColorModelConverter][]) {
        if (name in colorSpaces) continue;
        bindColorFunctionParsers(name, converter, base);
    }

    for (const [name] of Object.entries(colorSpaces)) {
        bindColorSpaceParsers(name, base);
    }

    return base as Record<string, (node: ParseNode) => ColorData>; // eslint-disable-line no-unused-vars
})();
