import { cache } from "./config.js";
import {
    ColorFunction,
    ColorModel,
    ColorModelConverter,
    colorModels,
    ColorSpace,
    ColorSpaceConverter,
    colorSpaces,
    ComponentDefinition,
    spaceConverterToModelConverter,
} from "./converters.js";
import { grammarMap, parseExpression, parseNode, ParseNode } from "./syntax.js";
import { parsers, bindColorFunctionParsers, bindColorSpaceParsers } from "./parsers.js";
import { FitFunction, FitMethod, fitMethods } from "./fitMethods.js";
import { ColorFormatter, createColorFormatter, formatters, GrammarRuleSpec, OutputType } from "./formatters.js";
import { NamedColor, namedColors } from "./namedColors.js";
import { Shortcut, shortcuts } from "./shortcuts.js";
import { generateColorFunctionGrammar, generateColorSpaceGrammar } from "./grammar.js";
import { validators } from "./validators.js";

/** Supported registration categories for the public registry API. */
export type RegistererType = keyof typeof registerers;

/** Extracts the exact function type for a given registerer key. */
export type RegistererFn<T extends RegistererType> = (typeof registerers)[T];

/** Extracts the exact function type for a given unregisterer key. */
export type UnregistererFn<T extends RegistererType> = (typeof unregisterers)[T];

/** Shared state for dynamically registered color spaces, functions, and grammar extensions. */
export const registry = {
    customSpaces: new Set<string>(),
    rectangularFunctions: new Set<string>(),
    polarFunctions: new Set<string>(),
    functionRules: new Set<string>(),
    grammarExtensions: new Map<string, Set<string>>(),
};

/** Registry handlers for built-in registration types. */
export const registerers = {
    "named-colors": (name: string, rgb: number[]): void => {
        if (!Array.isArray(rgb) || rgb.length !== 3) {
            throw new Error(`RGB value must be an array of three numbers, received length ${rgb.length}.`);
        }

        const n = name.replace(/[^a-zA-Z]/g, "").toLowerCase() as NamedColor;
        const names = namedColors as Record<NamedColor, number[]>;
        if (names[n]) throw new Error(`<named-color> '${n}' is already registered.`);

        const duplicate = Object.entries(names).find(([, value]) => value.every((channel, i) => channel === rgb[i]));
        if (duplicate) throw new Error(`RGB value [${rgb.join(", ")}] is already registered as '${duplicate[0]}'.`);

        names[n] = rgb;
    },

    "color-models": (name: string, converter: ColorModelConverter): void => {
        const n = name.replace(/(?:\s+)/g, "").toLowerCase() as ColorModel;
        const models = colorModels as unknown as Record<string, ColorModelConverter>;

        if (typeof converter !== "object" || converter === null) {
            throw new TypeError("Converter must be a non-null object.");
        }

        if (
            typeof converter.components === "object" &&
            converter.components !== null &&
            !Array.isArray(converter.components)
        ) {
            const normalized: Record<string, ComponentDefinition> = {};
            for (const key of Object.keys(converter.components)) {
                normalized[key.toLowerCase()] = converter.components[key];
            }
            converter.components = normalized;
        } else {
            throw new TypeError("Converter.components must be a non-null object.");
        }

        const requiredFns: Array<[keyof ColorModelConverter, string]> = [
            ["bridge", "string"],
            ["toBridge", "function"],
            ["fromBridge", "function"],
        ];

        for (const [key, type] of requiredFns) {
            if (typeof converter[key] !== type) {
                throw new TypeError(`Converter.${String(key)} must be a ${type}.`);
            }
        }

        if (converter.bridge in colorModels === false) {
            throw new Error(
                `Converter.bridge '${converter.bridge}' does not correspond to any registered color model.`
            );
        }

        if ("targetGamut" in converter && converter.targetGamut !== null && typeof converter.targetGamut !== "string") {
            throw new TypeError(`Converter.targetGamut must be a string or null.`);
        }

        if ("supportsLegacy" in converter && typeof converter.supportsLegacy !== "boolean") {
            throw new TypeError(`Converter.supportsLegacy must be a boolean.`);
        }

        if ("alphaVariant" in converter && typeof converter.alphaVariant !== "string") {
            throw new TypeError(`Converter.alphaVariant must be a string.`);
        }

        const componentNames = Object.keys(converter.components);
        if (new Set(componentNames).size !== componentNames.length) {
            throw new Error("Converter.components must have unique component names.");
        }
        if (componentNames.includes("none")) {
            throw new Error('Converter.components cannot have a component named "none".');
        }

        models[n] = converter;
        formatters[n] = createColorFormatter(n, converter);

        try {
            const { rules, functionNames, polarSpaces, rectangularSpaces } = generateColorFunctionGrammar(n, converter);

            for (const [ruleName, expr] of Object.entries(rules)) {
                grammarMap[ruleName] = parseExpression(expr);
            }

            bindColorFunctionParsers(n, converter, parsers);

            functionNames.forEach((fn) => registry.functionRules.add(fn));
            polarSpaces.forEach((ps) => registry.polarFunctions.add(ps));
            rectangularSpaces.forEach((rs) => registry.rectangularFunctions.add(rs));

            grammarMap["<custom-color-function>"] = parseExpression(Array.from(registry.functionRules).join(" | "));

            if (registry.rectangularFunctions.size > 0) {
                grammarMap["<custom-rectangular-space>"] = parseExpression(
                    Array.from(registry.rectangularFunctions).join(" | ")
                );
            }

            if (registry.polarFunctions.size > 0) {
                grammarMap["<custom-polar-space>"] = parseExpression(Array.from(registry.polarFunctions).join(" | "));
            }
        } catch (error) {
            throw new Error(`Failed to dynamically bind custom color definition execution parameters for "${n}".`, {
                cause: error,
            });
        }
    },

    "color-spaces": (name: string, converter: ColorSpaceConverter): void => {
        const n = name.replace(/(?:\s+)/g, "-").toLowerCase();
        const spaces = colorSpaces as unknown as Record<string, ColorModelConverter>;
        const models = colorModels as unknown as Record<string, ColorModelConverter>;

        if (typeof converter !== "object" || converter === null) {
            throw new TypeError("Converter must be a non-null object.");
        }

        if (!Array.isArray(converter.components) || converter.components.some((c) => typeof c !== "string")) {
            throw new TypeError("Converter.components must be an array of strings.");
        }

        if (typeof converter.bridge !== "string") {
            throw new TypeError("Converter.bridge must be a string.");
        }

        const matrixChecks: Array<[keyof ColorSpaceConverter, string]> = [
            ["toBridgeMatrix", "toBridgeMatrix"],
            ["fromBridgeMatrix", "fromBridgeMatrix"],
        ];

        for (const [key, label] of matrixChecks) {
            const matrix = converter[key];
            if (
                !Array.isArray(matrix) ||
                matrix.some((row) => !Array.isArray(row) || row.some((val) => typeof val !== "number"))
            ) {
                throw new TypeError(`Converter.${label} must be a 2D array of numbers.`);
            }
        }

        if (converter.bridge in colorModels === false) {
            throw new Error(
                `Converter.bridge '${converter.bridge}' does not correspond to any registered color model.`
            );
        }

        if ("targetGamut" in converter && converter.targetGamut !== null) {
            throw new TypeError("Converter.targetGamut must be null if provided.");
        }

        if ("toLinear" in converter && typeof converter.toLinear !== "function") {
            throw new TypeError("Converter.toLinear must be a function if provided.");
        }

        if ("fromLinear" in converter && typeof converter.fromLinear !== "function") {
            throw new TypeError("Converter.fromLinear must be a function if provided.");
        }

        const modelConv = spaceConverterToModelConverter(n, converter);
        spaces[n] = modelConv;
        models[n] = modelConv;

        try {
            const { rules } = generateColorSpaceGrammar(n, modelConv);

            for (const [ruleName, expr] of Object.entries(rules)) {
                grammarMap[ruleName] = parseExpression(expr);
            }

            bindColorSpaceParsers(n, parsers);

            registry.customSpaces.add(n);

            grammarMap["<custom-color-space>"] = parseExpression(Array.from(registry.customSpaces).join(" | "));

            const relativeChoiceExpr = Array.from(registry.customSpaces)
                .map((space) => `<relative-${space}-color-syntax>`)
                .join(" | ");

            grammarMap["<relative-custom-color-syntax>"] = parseExpression(relativeChoiceExpr);
        } catch (error) {
            throw new Error(`Failed to dynamically bind color space "${n}" to grammarMap.`, { cause: error });
        }
    },

    parsers: (name: string, spec: GrammarRuleSpec): void => {
        const n = name.trim().toLowerCase();

        if (!/^<.+>$/.test(n)) {
            throw new Error(`Grammar rule name must start with '<' and end with '>', received '${n}'.`);
        }

        if (typeof spec !== "object" || spec === null) {
            throw new TypeError("Grammar rule specification must be a non-null object.");
        }

        if (typeof spec.rule !== "string" && typeof spec.rule !== "function") {
            throw new TypeError("Grammar rule specification must include a 'rule' string or function.");
        }

        if (spec.parse !== undefined && typeof spec.parse !== "function") {
            throw new TypeError("Grammar rule specification 'parse' must be a function if provided.");
        }

        if (spec.appendTo !== undefined && typeof spec.appendTo !== "string" && !Array.isArray(spec.appendTo)) {
            throw new TypeError("Grammar rule 'appendTo' must be a string or an array of strings.");
        }

        try {
            if (typeof spec.rule === "string") {
                grammarMap[n] = parseExpression(spec.rule);
            } else {
                const validatorName = n.slice(1, -1);
                validators[validatorName as keyof typeof validators] = spec.rule;
            }

            if (spec.parse) {
                parsers[n] = spec.parse;
            }

            if (spec.appendTo) {
                const targets = Array.isArray(spec.appendTo) ? spec.appendTo : [spec.appendTo];

                for (let target of targets) {
                    target = target.trim().toLowerCase();

                    if (!/^<.+>$/.test(target)) {
                        throw new Error(
                            `Target appendTo rule must be formatted as '<rule-name>', received '${target}'.`
                        );
                    }

                    if (!registry.grammarExtensions.has(target)) {
                        registry.grammarExtensions.set(target, new Set());
                    }
                    registry.grammarExtensions.get(target)!.add(n);

                    const baseTargetName = `<${target.slice(1, -1)}-core-base>`;

                    if (!grammarMap[baseTargetName]) {
                        if (!grammarMap[target]) {
                            throw new Error(`Target rule '${target}' does not exist in the grammar map to append to.`);
                        }
                        grammarMap[baseTargetName] = grammarMap[target];
                    }

                    const extensions = Array.from(registry.grammarExtensions.get(target)!);
                    const appendedChoiceExpr = `[ ${baseTargetName} | ${extensions.join(" | ")} ]`;

                    grammarMap[target] = parseExpression(appendedChoiceExpr);

                    parsers[target] = (node) => parseNode(node.value[0] as ParseNode);
                    parsers[baseTargetName] = (node) => parseNode(node.value[0] as ParseNode);
                }
            }
        } catch (error) {
            throw new Error(`Failed to register custom grammar rule for "${n}".`, { cause: error });
        }
    },

    formatters: (name: string, converter: ColorFormatter): void => {
        const n = name.trim().toLowerCase();

        if (typeof converter !== "object" || converter === null) {
            throw new TypeError("Formatter must be a non-null object.");
        }

        if (typeof converter.bridge !== "string") {
            throw new TypeError("Formatter.bridge must be a string.");
        }

        if (typeof converter.fromBridge !== "function") {
            throw new TypeError("Formatter.fromBridge must be a function.");
        }

        if (typeof converter.format !== "function") {
            throw new TypeError("Formatter.format must be a function.");
        }

        if (converter.bridge in colorModels === false) {
            throw new Error(
                `Formatter.bridge '${converter.bridge}' does not correspond to any registered color model.`
            );
        }

        const registeredFormatters = formatters as Record<string, ColorFormatter>;

        if (n in registeredFormatters) {
            throw new Error(`Formatter '${n}' is already registered.`);
        }

        registeredFormatters[n] = converter;
    },

    shortcuts: (
        name: string,
        converter: {
            parse: Shortcut;
            appendTo?: string | string[];
        }
    ): void => {
        const { parse, appendTo } = converter;
        const n = name.trim().toLowerCase();

        if (!/^<.+>$/.test(n)) {
            throw new Error(`Shortcut name must start with '<' and end with '>', received '${n}'.`);
        }

        if (typeof parse !== "function") {
            throw new TypeError("Shortcut must be a function.");
        }

        if (appendTo !== undefined && typeof appendTo !== "string" && !Array.isArray(appendTo)) {
            throw new TypeError("Shortcut 'appendTo' must be a string or an array of strings.");
        }

        const registeredShortcuts = shortcuts as Record<string, Shortcut>;

        if (n in registeredShortcuts) {
            throw new Error(`Shortcut '${n}' is already registered.`);
        }

        registeredShortcuts[n] = parse;

        if (appendTo) {
            const targets = Array.isArray(appendTo) ? appendTo : [appendTo];

            for (let target of targets) {
                target = target.trim().toLowerCase();

                if (!/^<.+>$/.test(target)) {
                    throw new Error(`Target appendTo rule must be formatted as '<rule-name>', received '${target}'.`);
                }

                if (!registry.grammarExtensions.has(target)) {
                    registry.grammarExtensions.set(target, new Set());
                }
                registry.grammarExtensions.get(target)!.add(n);

                const baseTargetName = `<${target.slice(1, -1)}-core-base>`;

                if (!grammarMap[baseTargetName]) {
                    if (!grammarMap[target]) {
                        throw new Error(`Target rule '${target}' does not exist in the grammar map to append to.`);
                    }
                    grammarMap[baseTargetName] = grammarMap[target];
                }

                const extensions = Array.from(registry.grammarExtensions.get(target)!);
                const appendedChoiceExpr = `[ ${baseTargetName} | ${extensions.join(" | ")} ]`;

                grammarMap[target] = parseExpression(appendedChoiceExpr);

                parsers[target] = (node) => parseNode(node.value[0] as ParseNode);
                parsers[baseTargetName] = (node) => parseNode(node.value[0] as ParseNode);
            }
        }
    },

    "fit-methods": (name: string, method: FitFunction): void => {
        const n = name.trim().replace(/\s+/g, "-").toLowerCase() as FitMethod;
        const methods = fitMethods as Record<string, FitFunction>;
        if (n in methods) throw new Error(`Fit method '${n}' already exists.`);
        if (typeof method !== "function") throw new TypeError("Fit method must be a function.");
        methods[n] = method;
    },
} as const;

/** Unregistry handlers mirroring the registerer handlers for full type safety. */
export const unregisterers = {
    "named-colors": (name: NamedColor): void => {
        const colorName = name.replace(/[^a-zA-Z]/g, "") as NamedColor;
        delete namedColors[colorName];
    },

    "color-models": (name: ColorFunction): void => {
        delete colorModels[name as ColorModel];
    },

    "color-spaces": (name: ColorSpace): void => {
        delete colorSpaces[name as ColorSpace];
        delete colorModels[name as ColorSpace];
        registry.customSpaces.delete(name);
        grammarMap["<custom-color-space>"] = parseExpression(Array.from(registry.customSpaces).join(" | "));
    },

    parsers: (name: string): void => {
        delete parsers[name];
        delete grammarMap[name];
    },

    formatters: (name: OutputType): void => {
        delete formatters[name as OutputType];
    },

    shortcuts: (name: string): void => {
        delete shortcuts[name];
    },

    "fit-methods": (name: FitMethod): void => {
        delete fitMethods[name as Exclude<FitMethod, "none">];
    },
} as const;

/**
 * Registers a batch of entries for the requested registry type.
 *
 * @template T - The registry category to register into.
 * @param type - The registry type to use.
 * @param entries - The entries to register.
 */
export function register<T extends RegistererType>(
    type: T,
    entries: Array<{
        name: Parameters<RegistererFn<T>>[0];
        value: Parameters<RegistererFn<T>>[1];
    }>
): void {
    const fn = registerers[type] as (
        name: Parameters<RegistererFn<T>>[0], // eslint-disable-line no-unused-vars
        value: Parameters<RegistererFn<T>>[1] // eslint-disable-line no-unused-vars
    ) => void;

    for (const entry of entries) fn(entry.name, entry.value);

    if (typeof cache !== "undefined" && typeof cache.clear === "function") {
        cache.clear();
    }
}

/**
 * Unregisters a batch of items for the requested registry type to allow for rewriting.
 *
 * @template T - The registry category to unregister from.
 * @param type - The registry type to use.
 * @param names - An array of names to unregister.
 */
export function unregister<T extends RegistererType>(type: T, names: Array<Parameters<UnregistererFn<T>>[0]>): void {
    const fn = unregisterers[type] as (name: Parameters<UnregistererFn<T>>[0]) => void; // eslint-disable-line no-unused-vars

    for (const name of names) fn(name);

    if (typeof cache !== "undefined" && typeof cache.clear === "function") {
        cache.clear();
    }
}
