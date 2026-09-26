import { parse } from "./parse.js";
import { grammarMap, matchNode, MatchResult, matchRule, parseExpression, tokenize } from "./syntax.js";
import { validators } from "./validators.js";

/** Options for validating color input strings. */
export type IsValidOptions = {
    /** The specific rule or color type to validate against (e.g., `"<rgb()>"`, `"<hex-color>"`, `"<color-base>"`). If omitted, validates against all supported formats. */
    rule?: string;
};

/**
 * Checks if a token sequence or color string is valid according to the grammar and parseable.
 *
 * @param input - The color string or tokenized array to validate.
 * @param options - Options including an optional rule constraint.
 * @returns True if the tokens match the rule(s) AND parse successfully, otherwise false.
 */
export function isValid(input: string | string[], options: IsValidOptions = {}): boolean {
    const { rule } = options;

    try {
        const string = Array.isArray(input) ? input.join(" ") : input;
        const tokens = Array.isArray(input) ? input : tokenize(string);

        const memo = new Map<string, MatchResult[]>();

        if (rule) {
            let isGrammarValid = false;

            if (grammarMap[rule] || validators[rule as keyof typeof validators]) {
                const results = matchRule(rule, tokens, 0, grammarMap, memo, null);
                isGrammarValid = results.some((result) => result.success && result.nextIndex === tokens.length);
            } else {
                try {
                    const inlineNode = parseExpression(rule);
                    const results = matchNode(inlineNode, tokens, 0, grammarMap, memo, null);
                    isGrammarValid = results.some((result) => result.success && result.nextIndex === tokens.length);
                } catch (error) {
                    throw new Error(`Failed to resolve rule or parse inline expression: "${rule}"`, { cause: error });
                }
            }
            return isGrammarValid && !!parse(string);
        } else {
            return !!parse(string);
        }
    } catch {
        return false;
    }
}
