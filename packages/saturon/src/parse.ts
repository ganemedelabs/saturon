import { NamedColor } from "./namedColors.js";
import { shortcuts } from "./shortcuts.js";
import { parseNode, tokenize, validateTokens, ColorData } from "./syntax.js";

export function parse(color: NamedColor): ColorData; /* eslint-disable-line no-unused-vars */
export function parse(color: string): ColorData; /* eslint-disable-line no-unused-vars */
export function parse(color: NamedColor | string): ColorData {
    for (const shortcut of Object.values(shortcuts)) {
        const result = shortcut(color);
        if (result !== null) return result;
    }

    const tokens = tokenize(color);
    const tree = validateTokens(tokens);

    try {
        const { model, coords } = parseNode(tree);
        return { model, coords };
    } catch (error) {
        throw new Error(`Failed to parse color string '${color}'`, { cause: error });
    }
}
