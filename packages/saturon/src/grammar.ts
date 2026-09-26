import { ColorModelConverter, colorModels, colorSpaces, ComponentDefinition } from "./converters.js";

export type GrammarRules = {
    /** A record of generated grammar rules mapped by their rule name, preserving insertion order. */
    rules: Record<string, string>;

    /** The root base rule names generated for the color function and its alpha variant. */
    functionNames: string[];

    /** The rule names registered as polar space functions. */
    polarSpaces: string[];

    /** The rule names registered as rectangular space functions. */
    rectangularSpaces: string[];

    /** An array of valid component identifiers for this color syntax. */
    compKeys: string[];
};

/**
 * Dynamically generates all grammar specifications for a color function model.
 *
 * @param name - The color function model name.
 * @param converter - The converter configuration defining its components and legacy support.
 * @returns The structured set of ordered grammar rule strings.
 */
export function generateColorFunctionGrammar(name: string, converter: ColorModelConverter): GrammarRules {
    const rules: Record<string, string> = {};
    const compEntries = Object.entries(converter.components).filter(([k]) => k !== "alpha");
    const compKeys = compEntries.map(([k]) => k);

    const isHueComp = (def: ComponentDefinition) => def && def.value === "hue";
    const isPolar = compEntries.some(([, def]) => isHueComp(def));

    const compressPieces = (pieces: string[]) => {
        const compressed: string[] = [];
        let current = pieces[0];
        let count = 1;
        for (let i = 1; i < pieces.length; i++) {
            if (pieces[i] === current) {
                count++;
            } else {
                compressed.push(count > 1 ? `${current}{${count}}` : current);
                current = pieces[i];
                count = 1;
            }
        }
        compressed.push(count > 1 ? `${current}{${count}}` : current);
        return compressed.join(" ");
    };

    const modernPieces = compEntries.map(([, def]) =>
        isHueComp(def) ? "[ <hue> | none ]" : "[ <number> | <percentage> | none ]"
    );
    const modernComponentsExpr = compressPieces(modernPieces);

    const getLegacyCompExpr = (def: ComponentDefinition) => {
        if (def?.value === "hue") return "<hue>";
        if (def?.value === "percentage") return "<percentage>";
        if (Array.isArray(def?.value)) return "<number>";
        return "[ <number> | <percentage> ]";
    };

    const compList = compKeys.join(" | ");

    const registerForName = (fName: string) => {
        const baseRuleName = `<${fName}()>`;
        const legacyRuleName = `<legacy-${fName}-syntax>`;
        const modernRuleName = `<modern-${fName}-syntax>`;
        const relativeRuleName = `<relative-${fName}-syntax>`;

        const compRuleName = `<${fName}-relative-component>`;
        const hueRuleName = `<${fName}-relative-hue>`;
        const alphaRuleName = `<${fName}-relative-alpha>`;

        const functionSubOptions = [];
        if (converter.supportsLegacy) {
            functionSubOptions.push(legacyRuleName);
        }
        functionSubOptions.push(modernRuleName, relativeRuleName);

        rules[baseRuleName] = `[ ${functionSubOptions.join(" | ")} ]`;

        if (converter.supportsLegacy) {
            if (!isPolar) {
                const len = compEntries.length;
                rules[legacyRuleName] =
                    `${fName}( <percentage>#{${len}} [ , <alpha-value> ]? ) | ${fName}( <number>#{${len}} [ , <alpha-value> ]? )`;
            } else {
                const legacyComponentsExpr = compEntries.map(([, def]) => getLegacyCompExpr(def)).join(" , ");
                rules[legacyRuleName] = `${fName}( ${legacyComponentsExpr} [ , <alpha-value> ]? )`;
            }
        }

        rules[modernRuleName] = `${fName}( ${modernComponentsExpr} [ / [ <alpha-value> | none ] ]? )`;

        const relativePieces = compEntries.map(([, def]) => (isHueComp(def) ? hueRuleName : compRuleName));
        const relativeComponentsExpr = compressPieces(relativePieces);

        rules[relativeRuleName] = `${fName}( from <color> ${relativeComponentsExpr} [ / ${alphaRuleName} ]? )`;

        if (relativePieces.includes(hueRuleName)) {
            rules[hueRuleName] = `<hue> | none | ${compList} | alpha`;
        }

        if (relativePieces.includes(compRuleName)) {
            rules[compRuleName] = `<number> | <percentage> | none | ${compList} | alpha`;
        }

        rules[alphaRuleName] = `<alpha-value> | none | ${compList} | alpha`;

        return baseRuleName;
    };

    const baseRuleName = registerForName(name);
    const functionNames = [baseRuleName];

    if (converter.alphaVariant) {
        functionNames.push(registerForName(converter.alphaVariant.replace(/(?:\s+)/g, "").toLowerCase()));
    }

    return {
        rules,
        functionNames,
        polarSpaces: isPolar ? [name] : [],
        rectangularSpaces: !isPolar ? [name] : [],
        compKeys,
    };
}

/**
 * Dynamically generates all grammar specifications for a relative `color(space ...)` function.
 *
 * @param name - The color space name.
 * @param converter - The converter configuration defining its components.
 * @returns The structured set of ordered grammar rule strings.
 */
export function generateColorSpaceGrammar(
    name: string,
    converter: Omit<ColorModelConverter, "toBridge" | "fromBridge">
): GrammarRules {
    const rules: Record<string, string> = {};
    const compKeys = Object.keys(converter.components).filter((k) => k !== "alpha");
    const compList = compKeys.join(" | ");

    const syntaxRuleName = `<relative-${name}-color-syntax>`;
    const compRuleName = `<${name}-relative-component>`;
    const alphaRuleName = `<${name}-relative-alpha>`;

    rules[syntaxRuleName] = `color( from <color> ${name} ${compRuleName}{3} [ / ${alphaRuleName} ]? )`;

    rules[compRuleName] = `<number> | <percentage> | none | ${compList} | alpha`;
    rules[alphaRuleName] = `<alpha-value> | none | ${compList} | alpha`;

    return {
        rules,
        functionNames: [],
        polarSpaces: [],
        rectangularSpaces: [],
        compKeys,
    };
}

/** A collection of grammar rules that define the syntax for parsing color strings. */
export const grammar = (() => {
    let baseGrammar = `
/* ==========================================================================
   Core Color Types
   ========================================================================== */
<color> = <color-base> | currentColor | <system-color> | <contrast-color()> | <device-cmyk()> | <light-dark-color>

<color-base> = <named-color> | <hex-color> | <color-function> | <color-mix()> | transparent

<color-function> = %color-functions% | <alpha()> | <color()> | <custom-color-function>

/* ==========================================================================
   Color Functions
   ========================================================================== */

%function-rules%
/* ==========================================================================
   ALPHA Syntax
   ========================================================================== */
<alpha()> = alpha( from <color> [ / [ <alpha-value> | none | alpha ] ]? )

/* ==========================================================================
   COLOR Space Function Syntax
   ========================================================================== */
<color()> = [ <absolute-color-syntax> | <relative-color-syntax> ]
<absolute-color-syntax> = color( [ <predefined-rgb> | <xyz-space> | <custom-color-space> ] [ <number> | <percentage> | none ]{3} [ / [ <alpha-value> | none ] ]? )

<relative-color-syntax> = [ %relative-spaces% | <relative-custom-color-syntax> ]

%space-rules%
<predefined-rgb> = srgb | srgb-linear | display-p3 | a98-rgb | prophoto-rgb | rec2020
<xyz-space> = xyz | xyz-d50 | xyz-d65

/* ==========================================================================
   Functional Utilities
   ========================================================================== */
<light-dark-color> = light-dark( <color> , <color> )
<contrast-color()> = contrast-color( <color> )

<device-cmyk()> = <legacy-device-cmyk-syntax> | <modern-device-cmyk-syntax>
<legacy-device-cmyk-syntax> = device-cmyk( <number>#{4} )
<modern-device-cmyk-syntax> = device-cmyk( <cmyk-component>{4} [ / [ <alpha-value> | none ] ]? )
<cmyk-component> = <number> | <percentage> | none

<color-mix()> = color-mix( [ <color-interpolation-method> , ]? [ <color> && <percentage [0,100]>? ]# )
<color-interpolation-method> = in [ <rectangular-color-space> | <polar-color-space> <hue-interpolation-method>? ]
<color-space> = <rectangular-color-space> | <polar-color-space>
<rectangular-color-space> = srgb | srgb-linear | display-p3 | display-p3-linear | a98-rgb | prophoto-rgb | rec2020 | lab | oklab | <xyz-space> | <custom-color-space> | <custom-rectangular-space>
<polar-color-space> = hsl | hwb | lch | oklch | <custom-polar-space>
<hue-interpolation-method> = [ shorter | longer | increasing | decreasing ] hue

/* ==========================================================================
   Custom Space Sentinels
   ========================================================================== */
<custom-color-function> = %unregistered-sentinel-value%
<custom-rectangular-space> = %unregistered-sentinel-value%
<custom-polar-space> = %unregistered-sentinel-value%
<custom-color-space> = %unregistered-sentinel-value%
<relative-custom-color-syntax> = %unregistered-sentinel-value%

/* ==========================================================================
   Shared Value Components
   ========================================================================== */
<alpha-value> = <number> | <percentage>
<hue> = <number> | <angle>
`;

    const functionRules: string[] = [];
    const functionNames: string[] = [];

    for (const [name, converter] of Object.entries(colorModels) as [string, ColorModelConverter][]) {
        if (name in colorSpaces) continue;
        const res = generateColorFunctionGrammar(name, converter);
        functionRules.push(`/* ${name.toUpperCase()} Syntax */`);
        for (const [ruleName, ruleExpr] of Object.entries(res.rules)) {
            functionRules.push(`${ruleName} = ${ruleExpr}`);
        }
        functionRules.push("");
        functionNames.push(...res.functionNames);
    }

    const spaceRules: string[] = [];
    const relativeSpaceNames: string[] = [];

    for (const [name, converter] of Object.entries(colorSpaces)) {
        const res = generateColorSpaceGrammar(name, converter);
        spaceRules.push(`/* ${name.toUpperCase()} Relative Color Space Syntax */`);
        for (const [ruleName, ruleExpr] of Object.entries(res.rules)) {
            spaceRules.push(`${ruleName} = ${ruleExpr}`);
        }
        spaceRules.push("");
        relativeSpaceNames.push(`<relative-${name}-color-syntax>`);
    }

    baseGrammar = baseGrammar.replace("%color-functions%", functionNames.join(" | "));
    baseGrammar = baseGrammar.replace("%function-rules%", functionRules.join("\n"));

    baseGrammar = baseGrammar.replace("%relative-spaces%", relativeSpaceNames.join(" | "));
    baseGrammar = baseGrammar.replace("%space-rules%", spaceRules.join("\n"));

    return baseGrammar;
})();
