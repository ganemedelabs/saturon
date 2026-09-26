import { ColorModel, colorModels } from "./converters.js";
import { grammar } from "./grammar.js";
import { shortcuts } from "./shortcuts.js";
import { parsers } from "./parsers.js";
import { validators } from "./validators.js";

/** Runtime representation of a parsed or converted color value. */
export type ColorData = {
    model: ColorModel;
    coords: number[];
};

/** Union of the grammar AST node variants used by the parser. */
export type GrammarNode =
    SequenceNode | ChoiceNode | LiteralNode | RefNode | OptionalNode | RepeatNode | PermutationNode | HashListNode;

/** Represents an unordered permutation of grammar nodes, where each child may match in any order. */
export type PermutationNode = {
    kind: "permutation";
    nodes: GrammarNode[];
};

/** Represents a comma-separated list of repeated grammar nodes. */
export type HashListNode = {
    kind: "hashList";
    node: GrammarNode;
};

/** Represents a sequence of grammar nodes that must match in order. */
export type SequenceNode = {
    kind: "sequence";
    nodes: GrammarNode[];
};

/** Represents a grammar choice between alternative node paths. */
export type ChoiceNode = {
    kind: "choice";
    nodes: GrammarNode[];
};

/** Represents a literal token that must match exactly. */
export type LiteralNode = {
    kind: "literal";
    value: string;
};

/** Represents a reference to another grammar rule, optionally with arguments. */
export type RefNode = {
    kind: "ref";
    name: string;
    args?: string[];
};

/** Represents a grammar node that may be omitted. */
export type OptionalNode = {
    kind: "optional";
    node: GrammarNode;
};

/** Represents a grammar node that must repeat a fixed number of times. */
export type RepeatNode = {
    kind: "repeat";
    node: GrammarNode;
    min: number;
    max?: number;
};

/** Represents the outcome of a grammar match attempt. */
export type MatchResult = {
    success: boolean;
    nextIndex: number;
    nodes: ParseNode[];
};

/** Represents a parsed tree node produced while evaluating a CSS grammar rule. */
export type ParseNode<T extends string = string> = {
    type: T;
    value: T extends "literal" | "symbol" ? string : string | ParseNode[];
    data?: ColorData;
};

const RULE_START_RE = /^<[^>]+>\s*=/;
const HASH_REPEAT_RE = /^(.*)#\{(\d+)\}$/;
const REPEAT_RE = /^(.*)\{(\d+)\}$/;
const REF_RE = /^<([^>\s]+)(?:\s+([^>]+))?>$/;
const ARG_RE = /\[[^\]]+\]|[^\s]+/g;

/** Parsed CSS grammar rules indexed by their rule name. */
export const grammarMap = parseGrammar(grammar);

/**
 * Concatenates two arrays of parser nodes into a single ordered list.
 *
 * @param a - The first list of parser nodes.
 * @param b - The second list of parser nodes.
 * @returns A combined node list containing the elements of both inputs.
 */
export function concatNodes(a: ParseNode[], b: ParseNode[]): ParseNode[] {
    const lenA = a.length;
    const lenB = b.length;
    const result = new Array(lenA + lenB);
    for (let i = 0; i < lenA; i++) result[i] = a[i];
    for (let i = 0; i < lenB; i++) result[lenA + i] = b[i];
    return result;
}

/**
 * Tokenizes a CSS color string into a stream of grammar-friendly tokens.
 *
 * @param input - The raw CSS input string.
 * @returns An array of normalized tokens.
 */
export function tokenize(input: string): string[] {
    const tokens: string[] = [];
    const len = input.length;
    let i = 0;

    const toAsciiLower = (str: string) => str.replace(/[A-Z]/g, (c) => c.toLowerCase());

    while (i < len) {
        const charCode = input.charCodeAt(i);

        // Skip Whitespace
        if (charCode === 32 || charCode === 9 || charCode === 13 || charCode === 10 || charCode === 12) {
            i++;
            continue;
        }

        // Skip Comments
        if (charCode === 47 && input.charCodeAt(i + 1) === 42) {
            const endIndex = input.indexOf("*/", i + 2);
            if (endIndex !== -1) {
                i = endIndex + 2;
            } else {
                i = len;
            }
            continue;
        }

        // Match calc(...)
        if (
            i + 4 < len &&
            (input.charCodeAt(i) | 32) === 99 &&
            (input.charCodeAt(i + 1) | 32) === 97 &&
            (input.charCodeAt(i + 2) | 32) === 108 &&
            (input.charCodeAt(i + 3) | 32) === 99 &&
            input.charCodeAt(i + 4) === 40
        ) {
            const start = i;
            let parenCount = 0;

            while (i < len) {
                const c = input.charCodeAt(i);
                if (c === 40) parenCount++;
                else if (c === 41) {
                    parenCount--;
                    if (parenCount === 0) {
                        i++;
                        break;
                    }
                }
                i++;
            }
            tokens.push(toAsciiLower(input.slice(start, i)));
            continue;
        }

        // "(", ")", ",", "/"
        if (charCode === 40 || charCode === 41 || charCode === 44 || charCode === 47) {
            tokens.push(input[i]);
            i++;
            continue;
        }

        // Read Words / Identifiers / Numbers
        const start = i;
        while (i < len) {
            const c = input.charCodeAt(i);
            if (c === 32 || c === 9 || c === 13 || c === 10 || c === 12) break;
            if (c === 40 || c === 41 || c === 44 || c === 47) break;
            i++;
        }

        tokens.push(toAsciiLower(input.slice(start, i)));
    }
    return tokens;
}

let grammarKeys: string[] | null = null;

/**
 * Validates a token sequence against the grammar and returns the first matching parse tree.
 *
 * @param tokens - The tokenized input to validate.
 * @param rootRule - Optional rule name to constrain validation to a specific entry point.
 * @returns The matched parse node.
 * @throws If the token sequence does not match any supported grammar rule.
 */
export function validateTokens(tokens: string[], rootRule?: string): ParseNode {
    const memo = new Map<string, MatchResult[]>();

    const rulesToTest = rootRule ? [rootRule] : grammarKeys || (grammarKeys = Object.keys(grammarMap));

    for (let i = 0; i < rulesToTest.length; i++) {
        const ruleName = rulesToTest[i];
        const results = matchRule(ruleName, tokens, 0, grammarMap, memo, null);

        for (let j = 0; j < results.length; j++) {
            const result = results[j];
            if (result.success && result.nextIndex === tokens.length) {
                return result.nodes[0];
            }
        }
    }

    throw new Error("Invalid syntax");
}

/**
 * Attempts to match a grammar rule against the provided token stream.
 *
 * @param ruleName - The grammar rule name to match.
 * @param tokens - The available tokens.
 * @param index - The current token index.
 * @param grammar - The grammar definition map.
 * @param memo - Memoization cache for rule matches.
 * @param currentFunction - The currently active color function, if any.
 * @param args - Optional rule arguments used during validation.
 * @returns The list of possible match results for the rule.
 */
export function matchRule(
    ruleName: string,
    tokens: string[],
    index: number,
    grammar: Record<string, GrammarNode>,
    memo: Map<string, MatchResult[]>,
    currentFunction: string | null,
    args?: string[]
): MatchResult[] {
    const token = tokens[index];

    if (ruleName in shortcuts) {
        const result = shortcuts[ruleName](token);
        if (result !== null) {
            return [{ success: true, nextIndex: index + 1, nodes: [{ type: ruleName, value: token }] }];
        }
    }

    const validate = validators[ruleName as keyof typeof validators];
    if (validate) {
        if (!token) return [];
        if (validate(token, args)) {
            return [{ success: true, nextIndex: index + 1, nodes: [{ type: ruleName, value: token }] }];
        }
        return [];
    }

    let key = ruleName + "@" + index;
    if (currentFunction) key += "@" + currentFunction;
    if (args) {
        for (let i = 0; i < args.length; i++) {
            key += "@" + args[i];
        }
    }

    const cached = memo.get(key);
    if (cached) return cached;

    const rule = grammar[ruleName];
    if (!rule) {
        memo.set(key, []);
        return [];
    }

    const results = matchNode(rule, tokens, index, grammar, memo, currentFunction);

    const wrapped = new Array(results.length);
    for (let i = 0; i < results.length; i++) {
        wrapped[i] = {
            success: true,
            nextIndex: results[i].nextIndex,
            nodes: [{ type: ruleName, value: results[i].nodes }],
        };
    }

    memo.set(key, wrapped);
    return wrapped;
}

/**
 * Matches a grammar node against the provided token stream.
 *
 * @param node - The grammar node to match.
 * @param tokens - The available tokens.
 * @param index - The current token index.
 * @param grammar - The grammar definition map.
 * @param memo - Memoization cache for node matches.
 * @param currentFunction - The currently active color function, if any.
 * @returns The list of possible match results for the node.
 */
export function matchNode(
    node: GrammarNode,
    tokens: string[],
    index: number,
    grammar: Record<string, GrammarNode>,
    memo: Map<string, MatchResult[]>,
    currentFunction: string | null
): MatchResult[] {
    switch (node.kind) {
        case "literal": {
            const token = tokens[index];
            if (!token) return [];

            if (token !== node.value) return [];

            const isSymbol = token === "(" || token === ")" || token === "," || token === "/";

            return [
                {
                    success: true,
                    nextIndex: index + 1,
                    nodes: [
                        {
                            type: isSymbol ? "symbol" : "literal",
                            value: token,
                        },
                    ],
                },
            ];
        }

        case "ref": {
            const token = tokens[index];

            if (token !== undefined && currentFunction && colorModels[currentFunction as ColorModel]) {
                const component = (
                    colorModels[currentFunction as ColorModel].components as Record<string, { value: string }>
                )[token];

                if (component && component.value === node.name) {
                    return [
                        {
                            success: true,
                            nextIndex: index + 1,
                            nodes: [{ type: node.name, value: token }],
                        },
                    ];
                }
            }

            return matchRule(node.name, tokens, index, grammar, memo, currentFunction, node.args);
        }

        case "choice": {
            for (let i = 0; i < node.nodes.length; i++) {
                const matches = matchNode(node.nodes[i], tokens, index, grammar, memo, currentFunction);

                if (matches.length > 0) {
                    return matches;
                }
            }

            return [];
        }

        case "sequence": {
            let states: MatchResult[] = [{ success: true, nextIndex: index, nodes: [] }];

            for (let i = 0; i < node.nodes.length; i++) {
                const child = node.nodes[i];
                const nextStates: MatchResult[] = [];

                for (let j = 0; j < states.length; j++) {
                    const state = states[j];
                    const matches = matchNode(child, tokens, state.nextIndex, grammar, memo, currentFunction);

                    for (let k = 0; k < matches.length; k++) {
                        nextStates.push({
                            success: true,
                            nextIndex: matches[k].nextIndex,
                            nodes: concatNodes(state.nodes, matches[k].nodes),
                        });
                    }
                }
                states = nextStates;
                if (states.length === 0) return [];
            }
            return states;
        }

        case "optional": {
            const matches = matchNode(node.node, tokens, index, grammar, memo, currentFunction);
            const results = new Array(matches.length + 1);
            results[0] = { success: true, nextIndex: index, nodes: [] };
            for (let i = 0; i < matches.length; i++) {
                results[i + 1] = matches[i];
            }
            return results;
        }

        case "repeat": {
            let states: MatchResult[] = [{ success: true, nextIndex: index, nodes: [] }];

            for (let i = 0; i < node.min; i++) {
                const nextStates: MatchResult[] = [];
                for (let j = 0; j < states.length; j++) {
                    const state = states[j];
                    const matches = matchNode(node.node, tokens, state.nextIndex, grammar, memo, currentFunction);

                    for (let k = 0; k < matches.length; k++) {
                        nextStates.push({
                            success: true,
                            nextIndex: matches[k].nextIndex,
                            nodes: concatNodes(state.nodes, matches[k].nodes),
                        });
                    }
                }
                states = nextStates;
                if (states.length === 0) return [];
            }
            return states;
        }

        case "permutation": {
            const numNodes = node.nodes.length;
            const fullMask = (1 << numNodes) - 1;

            type PermState = { nextIndex: number; nodes: ParseNode[]; remainingMask: number };
            let states: PermState[] = [{ nextIndex: index, nodes: [], remainingMask: fullMask }];
            const finalResults: MatchResult[] = [];

            while (states.length > 0) {
                const nextStates: PermState[] = [];

                for (let i = 0; i < states.length; i++) {
                    const state = states[i];

                    let allRemainingOptional = true;
                    for (let bit = 0; bit < numNodes; bit++) {
                        if ((state.remainingMask & (1 << bit)) !== 0) {
                            if (node.nodes[bit].kind !== "optional") {
                                allRemainingOptional = false;
                                break;
                            }
                        }
                    }

                    if (allRemainingOptional) {
                        finalResults.push({
                            success: true,
                            nextIndex: state.nextIndex,
                            nodes: state.nodes,
                        });
                    }

                    for (let bit = 0; bit < numNodes; bit++) {
                        if ((state.remainingMask & (1 << bit)) !== 0) {
                            const child = node.nodes[bit];
                            const nodeToMatch = child.kind === "optional" ? child.node : child;
                            const matches = matchNode(
                                nodeToMatch,
                                tokens,
                                state.nextIndex,
                                grammar,
                                memo,
                                currentFunction
                            );

                            const nextMask = state.remainingMask & ~(1 << bit);
                            for (let m = 0; m < matches.length; m++) {
                                nextStates.push({
                                    nextIndex: matches[m].nextIndex,
                                    nodes: concatNodes(state.nodes, matches[m].nodes),
                                    remainingMask: nextMask,
                                });
                            }
                        }
                    }
                }
                states = nextStates;
            }
            return finalResults;
        }

        case "hashList": {
            let currentStates = matchNode(node.node, tokens, index, grammar, memo, currentFunction);
            const allSuccessfulStates: MatchResult[] = [];

            while (currentStates.length > 0) {
                const nextStates: MatchResult[] = [];

                for (let i = 0; i < currentStates.length; i++) {
                    const state = currentStates[i];
                    allSuccessfulStates.push(state);

                    const commaIdx = state.nextIndex;
                    if (commaIdx < tokens.length && tokens[commaIdx] === ",") {
                        const commaNode: ParseNode = { type: "symbol", value: "," };
                        const matches = matchNode(node.node, tokens, commaIdx + 1, grammar, memo, currentFunction);

                        for (let m = 0; m < matches.length; m++) {
                            const match = matches[m];
                            if (match.nextIndex > commaIdx) {
                                const newNodes = new Array(state.nodes.length + 1 + match.nodes.length);
                                let idx = 0;
                                for (let n = 0; n < state.nodes.length; n++) newNodes[idx++] = state.nodes[n];
                                newNodes[idx++] = commaNode;
                                for (let n = 0; n < match.nodes.length; n++) newNodes[idx++] = match.nodes[n];

                                nextStates.push({
                                    success: true,
                                    nextIndex: match.nextIndex,
                                    nodes: newNodes,
                                });
                            }
                        }
                    }
                }
                currentStates = nextStates;
            }
            return allSuccessfulStates;
        }
    }
}

/**
 * Parses a grammar definition string into a map of rule names to grammar nodes.
 *
 * @param grammar - The grammar source text.
 * @returns A grammar map keyed by rule name.
 */
export function parseGrammar(grammar: string): Record<string, GrammarNode> {
    const rules: Record<string, GrammarNode> = {};
    const cleanGrammar = grammar.replace(/\/\*[\s\S]*?\*\//g, "");

    let currentRuleName = "";
    let currentDef = "";

    for (let line of cleanGrammar.split("\n")) {
        line = line.trim();
        if (!line) continue;

        if (RULE_START_RE.test(line)) {
            if (currentRuleName) {
                rules[currentRuleName] = parseExpression(currentDef);
            }
            const eqIndex = line.indexOf("=");
            currentRuleName = line.slice(0, eqIndex).trim();
            currentDef = line.slice(eqIndex + 1).trim();
        } else if (currentRuleName) {
            currentDef += ` ${line}`;
        }
    }

    if (currentRuleName) {
        rules[currentRuleName] = parseExpression(currentDef);
    }

    return rules;
}

/**
 * Parses a grammar expression into a choice or permutation node tree.
 *
 * @param expr - The grammar expression to parse.
 * @returns The parsed grammar node.
 */
export function parseExpression(expr: string): GrammarNode {
    const parts = splitTopLevel(expr, "|");
    return parts.length > 1 ? { kind: "choice", nodes: parts.map(parsePermutation) } : parsePermutation(expr);
}

/**
 * Splits a grammar expression by a separator while preserving nested groups.
 *
 * @param str - The expression string to split.
 * @param separator - The separator token to look for.
 * @returns The split expression parts.
 */
export function splitTopLevel(str: string, separator: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === "[" || char === "(") {
            depth++;
        } else if (char === "]" || char === ")") {
            depth--;
        } else if (depth === 0 && str.startsWith(separator, i)) {
            const part = str.slice(start, i).trim();
            if (part) result.push(part);

            i += separator.length - 1;
            start = i + 1;
        }
    }

    const lastPart = str.slice(start).trim();
    if (lastPart) result.push(lastPart);

    return result;
}

/**
 * Splits a grammar sequence into its individual terms while preserving punctuation.
 *
 * @param str - The sequence string to split.
 * @returns The sequence terms as strings.
 */
export function splitSequence(str: string): string[] {
    const isWhitespace = (char: string) => /\s/.test(char);
    const isDelimiter = (char: string) => "(),/|".includes(char);

    const result: string[] = [];
    let i = 0;
    const len = str.length;

    while (i < len) {
        const char = str[i];

        if (isWhitespace(char)) {
            i++;
            continue;
        }

        if (isDelimiter(char)) {
            result.push(str[i++]);
            continue;
        }

        const start = i;

        if (char === "<") {
            while (i < len && str[i] !== ">") i++;
            i++;
        } else if (char === "[") {
            let depth = 1;
            i++;
            while (i < len && depth > 0) {
                if (str[i] === "[") depth++;
                else if (str[i] === "]") depth--;
                i++;
            }
        }

        while (i < len && !isWhitespace(str[i]) && !isDelimiter(str[i])) {
            i++;
        }

        result.push(str.slice(start, i));
    }

    return result;
}

/**
 * Parses a permutation expression into a grammar node tree.
 *
 * @param targetExpr - The permutation expression to parse.
 * @returns The parsed grammar node.
 */
export function parsePermutation(targetExpr: string): GrammarNode {
    const parts = splitTopLevel(targetExpr, "&&");
    return parts.length > 1 ? { kind: "permutation", nodes: parts.map(parseSequence) } : parseSequence(targetExpr);
}

/**
 * Parses a sequence expression into a grammar node tree.
 *
 * @param targetExpr - The sequence expression to parse.
 * @returns The parsed grammar node.
 */
export function parseSequence(targetExpr: string): GrammarNode {
    return { kind: "sequence", nodes: splitSequence(targetExpr).map(parseTerm) };
}

/**
 * Parses a single grammar term into a node representation.
 *
 * @param term - The grammar term to parse.
 * @returns The parsed grammar node.
 */
export function parseTerm(term: string): GrammarNode {
    term = term.trim();

    if (term.length === 1 && "(),/".includes(term)) {
        return { kind: "literal", value: term };
    }

    if (term.endsWith("#") && !term.includes("{")) {
        return { kind: "hashList", node: parseTerm(term.slice(0, -1)) };
    }

    if (term.endsWith("?")) {
        return { kind: "optional", node: parseTerm(term.slice(0, -1)) };
    }

    const hashRepeatMatch = HASH_REPEAT_RE.exec(term);
    if (hashRepeatMatch) {
        const innerNode = parseTerm(hashRepeatMatch[1]);
        const count = Number(hashRepeatMatch[2]);
        const commaNode: GrammarNode = { kind: "literal", value: "," };

        const nodes = Array.from({ length: count * 2 - 1 }, (_, i) => (i % 2 === 0 ? innerNode : commaNode));

        return { kind: "sequence", nodes };
    }

    const repeatMatch = REPEAT_RE.exec(term);
    if (repeatMatch) {
        const count = Number(repeatMatch[2]);
        return { kind: "repeat", node: parseTerm(repeatMatch[1]), min: count, max: count };
    }

    if (term.startsWith("[") && term.endsWith("]")) {
        return parseExpression(term.slice(1, -1));
    }

    if (term.startsWith("<") && term.endsWith(">")) {
        const match = REF_RE.exec(term);
        if (match) {
            const args = match[2]?.match(ARG_RE)?.map((arg) => arg.trim());
            return { kind: "ref", name: `<${match[1]}>`, args };
        }
        return { kind: "ref", name: term };
    }

    return { kind: "literal", value: term.toLowerCase() };
}

/**
 * Dispatches a parse tree node to the matching parser implementation.
 *
 * @param node - The parse tree node to parse.
 * @returns The resulting color data.
 */
export function parseNode(node: ParseNode): ColorData {
    const { type, value } = node;
    if (type in shortcuts) {
        const result = shortcuts[type](value as string);
        if (result !== null) return result;
        throw new Error(`Failed to parse shortcut: ${type}`);
    }

    const parser = parsers[type as keyof typeof parsers];
    if (!parser) throw new Error(`No parser for rule: ${type}`);
    return parser(node);
}
