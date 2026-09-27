import { ComponentDefinition } from "./converters.js";

const UNIT_NUM = 1; // 001
const UNIT_PCT = 2; // 010
const UNIT_ANG = 4; // 100

/**
 * Represents the unit of a parsed CSS calculation value.
 */
export type CalcUnitType = typeof UNIT_NUM | typeof UNIT_PCT | typeof UNIT_ANG;

/**
 * Represents a lexical token parsed from a `calc()` expression.
 */
export type CalcToken =
    | { type: "number"; value: number; unit: CalcUnitType }
    | { type: "identifier"; value: string }
    | { type: "operator"; value: string };

/**
 * Represents an Abstract Syntax Tree (AST) node for a CSS `calc()` expression.
 */
export type CalcASTNode =
    | { type: "number"; value: number; unit: CalcUnitType }
    | { type: "var"; name: string }
    | { type: "binary"; op: string; left: CalcASTNode; right: CalcASTNode }
    | { type: "unary"; op: string; arg: CalcASTNode }
    | { type: "call"; func: string; args: CalcASTNode[] };

/**
 * The evaluation result of a `calc()` AST node.
 */
export type CalcEvalResult = { value: number; unit: CalcUnitType };

/**
 * Mutable parser state holding token array and current cursor position.
 */
export type CalcParserState = {
    tokens: CalcToken[];
    pos: number;
};

/** Math environment used by the `calc()` parser and evaluator. */
// eslint-disable-next-line no-unused-vars
export const MATH_ENV: Record<string, number | ((...a: number[]) => number)> = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
    pow: Math.pow,
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    exp: Math.exp,
    log: (a: number, b?: number) => (b !== undefined ? Math.log(a) / Math.log(b) : Math.log(a)),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    clamp: (min: number, val: number, max: number) => Math.max(min, Math.min(val, max)),
    mod: (a: number, b: number) => ((a % b) + b) % b,
    rem: (a: number, b: number) => a % b,
    hypot: Math.hypot,
    sign: Math.sign,
    round: Math.round,
    ceil: Math.ceil,
    floor: Math.floor,
    trunc: Math.trunc,
    random: Math.random,
};

/**
 * Parses a percentage-like CSS value into a numeric component value.
 *
 * @param str - The percentage string to parse.
 * @param type - The expected component definition type.
 * @param min - Lower bound of the component range.
 * @param max - Upper bound of the component range.
 * @returns The parsed numeric value.
 * @throws If the string is not a valid percentage.
 */
export function parsePercent(str: string, type: ComponentDefinition["value"], min: number, max: number) {
    const percent = parseFloat(str);
    if (isNaN(percent)) throw new Error(`Invalid percentage: '${str}'.`);
    if (type === "percentage") return percent;
    if (min < 0 && max > 0) return ((percent / 100) * (max - min)) / 2;
    return (percent / 100) * (max - min) + min;
}

/**
 * Parses a CSS hue token into a numeric degree value.
 *
 * @param str - The hue value, including an optional unit such as `deg`, `rad`, `grad`, or `turn`.
 * @returns The hue value in degrees.
 * @throws If the hue is not a valid number.
 */
export function parseHue(str: string) {
    const val = parseFloat(str);
    if (isNaN(val)) throw new Error(`Invalid hue: '${str}'.`);
    if (str.endsWith("deg")) return val;
    if (str.endsWith("grad")) return val * 0.9;
    if (str.endsWith("rad")) return val * (180 / Math.PI);
    if (str.endsWith("turn")) return val * 360;
    return val;
}

/**
 * Returns a human-readable name for a given calculation unit.
 *
 * @param u - The unit type.
 * @returns "angle", "percent", or "number".
 */
export function getCalcUnitName(u: CalcUnitType): string {
    return u === UNIT_ANG ? "angle" : u === UNIT_PCT ? "percent" : "number";
}

/**
 * Tokenizes a CSS `calc()` expression string into an array of lexical tokens.
 *
 * @param s - The expression body.
 * @param type - The expected component definition type.
 * @param min - Lower bound of the component range.
 * @param max - Upper bound of the component range.
 * @returns An array of parsed lexical tokens.
 */
export function tokenizeCalcExpression(
    s: string,
    type: ComponentDefinition["value"],
    min: number,
    max: number
): CalcToken[] {
    const out: CalcToken[] = [];
    let i = 0;

    while (i < s.length) {
        const char = s[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        if (char === "-" && s[i + 1] === "-") {
            let id = "";
            while (i < s.length && /[a-zA-Z0-9_-]/.test(s[i])) id += s[i++];
            out.push({ type: "identifier", value: id });
            continue;
        }

        if ("*/(),".includes(char)) {
            out.push({ type: "operator", value: char });
            i++;
            continue;
        }

        if (char === "+" || char === "-") {
            const hasSpaceBefore = i > 0 && /\s/.test(s[i - 1]);
            const hasSpaceAfter = i < s.length - 1 && /\s/.test(s[i + 1]);

            if (hasSpaceBefore && hasSpaceAfter) {
                out.push({ type: "operator", value: char });
                i++;
                continue;
            }

            const prevToken = out.length > 0 ? out[out.length - 1] : null;
            const isAfterOperatorOrParen =
                !prevToken ||
                (prevToken.type === "operator" && ["(", ",", "*", "/", "+", "-"].includes(prevToken.value));
            const isFollowedByNum = /[0-9]/.test(s[i + 1] || "") || (s[i + 1] === "." && /[0-9]/.test(s[i + 2] || ""));

            if (isAfterOperatorOrParen) {
                if (!isFollowedByNum) {
                    out.push({ type: "operator", value: char });
                    i++;
                    continue;
                }
            } else if (!isFollowedByNum) {
                throw new Error(`CSS calc() requires whitespace around binary operators '+' and '-'.`);
            }
        }

        const keywordMatch = s.slice(i).match(/^(?:-?\+?infinity|nan|pi|e)\b/i);
        if (keywordMatch) {
            const kw = keywordMatch[0];
            let val = 0;
            if (kw === "infinity" || kw === "+infinity") val = Infinity;
            else if (kw === "-infinity") val = -Infinity;
            else if (kw === "nan") val = NaN;
            else if (kw === "pi") val = Math.PI;
            else if (kw === "e") val = Math.E;

            out.push({ type: "number", value: val, unit: UNIT_NUM });
            i += keywordMatch[0].length;
            continue;
        }

        const isNumStart = /[0-9]/.test(char) || (char === "." && /[0-9]/.test(s[i + 1] || ""));
        const isSignedNumStart =
            (char === "+" || char === "-") &&
            (/[0-9]/.test(s[i + 1] || "") || (s[i + 1] === "." && /[0-9]/.test(s[i + 2] || "")));

        if (isNumStart || isSignedNumStart) {
            let numStr = "";
            if (char === "+" || char === "-") {
                numStr += char;
                i++;
            }
            while (i < s.length && /[0-9.]/.test(s[i])) numStr += s[i++];
            if (i < s.length && /[eE]/.test(s[i])) {
                numStr += s[i++];
                if (/[+-]/.test(s[i])) numStr += s[i++];
                while (i < s.length && /[0-9]/.test(s[i])) numStr += s[i++];
            }

            let unitType: CalcUnitType = UNIT_NUM;
            let rawUnit = "";

            if (s[i] === "%") {
                unitType = UNIT_PCT;
                rawUnit = "%";
                i++;
            } else {
                const unitMatch = s.slice(i).match(/^(deg|rad|grad|turn)\b/i);
                if (unitMatch) {
                    unitType = UNIT_ANG;
                    rawUnit = unitMatch[1];
                    i += rawUnit.length;
                }
            }

            let val = parseFloat(numStr);
            if (unitType === UNIT_PCT) {
                val = parsePercent(numStr + rawUnit, type, min, max);
            } else if (unitType === UNIT_ANG) {
                val = parseHue(numStr + rawUnit);
            }

            out.push({ type: "number", value: val, unit: unitType });
            continue;
        }

        if (/[a-zA-Z_-]/.test(char)) {
            let id = "";
            while (i < s.length && /[a-zA-Z0-9_-]/.test(s[i])) id += s[i++];
            out.push({ type: "identifier", value: id });
            continue;
        }

        throw new Error(`Unexpected character: ${char}`);
    }
    return out;
}

/**
 * Returns the current token without consuming it.
 */
export function getCurrentCalcToken(state: CalcParserState): CalcToken | null {
    return state.pos < state.tokens.length ? state.tokens[state.pos] : null;
}

/**
 * Consumes and returns the current token.
 */
export function consumeCalcToken(state: CalcParserState): CalcToken {
    if (state.pos >= state.tokens.length) {
        throw new Error("Unexpected end of input");
    }
    return state.tokens[state.pos++];
}

/**
 * Asserts that the current token matches the expected operator or value and consumes it.
 */
export function expectCalcToken(state: CalcParserState, expectedValue: string): void {
    const token = getCurrentCalcToken(state);
    if (!token || token.value !== expectedValue) {
        throw new Error(`Expected "${expectedValue}" but got "${token ? token.value : "end of input"}"`);
    }
    consumeCalcToken(state);
}

/**
 * Parses primary AST nodes (numbers, variables, function calls, and parenthesized expressions).
 */
export function parseCalcPrimary(state: CalcParserState): CalcASTNode {
    const token = getCurrentCalcToken(state);
    if (!token) {
        throw new Error("Unexpected end of input");
    }

    if (token.type === "number") {
        consumeCalcToken(state);
        return { type: "number", value: token.value as number, unit: token.unit as CalcUnitType };
    }

    if (token.type === "identifier") {
        consumeCalcToken(state);
        const next = getCurrentCalcToken(state);
        if (next && next.value === "(") {
            consumeCalcToken(state);
            const args: CalcASTNode[] = [];
            if (getCurrentCalcToken(state)?.value !== ")") {
                args.push(parseCalcAdditiveExpression(state));
                while (getCurrentCalcToken(state)?.value === ",") {
                    consumeCalcToken(state);
                    args.push(parseCalcAdditiveExpression(state));
                }
            }
            expectCalcToken(state, ")");
            return { type: "call", func: token.value as string, args };
        }
        return { type: "var", name: token.value as string };
    }

    if (token.value === "(") {
        consumeCalcToken(state);
        const expr = parseCalcAdditiveExpression(state);
        expectCalcToken(state, ")");
        return expr;
    }

    throw new Error(`Unexpected token: ${token.value}`);
}

/**
 * Parses unary operational AST nodes (`+` or `-`).
 */
export function parseCalcUnary(state: CalcParserState): CalcASTNode {
    const token = getCurrentCalcToken(state);
    if (token && (token.value === "+" || token.value === "-")) {
        const op = consumeCalcToken(state).value as string;
        return { type: "unary", op, arg: parseCalcUnary(state) };
    }
    return parseCalcPrimary(state);
}

/**
 * Parses multiplicative binary expressions (`*` or `/`).
 */
export function parseCalcMultiplicativeExpression(state: CalcParserState): CalcASTNode {
    let left = parseCalcUnary(state);
    let token = getCurrentCalcToken(state);
    while (token && (token.value === "*" || token.value === "/")) {
        const op = consumeCalcToken(state).value as string;
        left = { type: "binary", op, left, right: parseCalcUnary(state) };
        token = getCurrentCalcToken(state);
    }
    return left;
}

/**
 * Parses additive binary expressions (`+` or `-`).
 */
export function parseCalcAdditiveExpression(state: CalcParserState): CalcASTNode {
    let left = parseCalcMultiplicativeExpression(state);
    let token = getCurrentCalcToken(state);
    while (token && (token.value === "+" || token.value === "-")) {
        const op = consumeCalcToken(state).value as string;
        left = { type: "binary", op, left, right: parseCalcMultiplicativeExpression(state) };
        token = getCurrentCalcToken(state);
    }
    return left;
}

/**
 * Parses an array of calculation tokens into an Abstract Syntax Tree (AST).
 *
 * @param tokens - The array of lexical tokens to parse.
 * @returns The root AST node of the parsed expression.
 */
export function parseCalcTokens(tokens: CalcToken[]): CalcASTNode {
    const state: CalcParserState = { tokens, pos: 0 };
    const ast = parseCalcAdditiveExpression(state);

    if (state.pos < tokens.length) {
        throw new Error(
            `Extra tokens after expression: ${tokens
                .slice(state.pos)
                .map((t) => t.value)
                .join(" ")}`
        );
    }
    return ast;
}

/**
 * Evaluates a calculation AST against a provided environment of variables and math functions.
 *
 * @param ast - The root AST node to evaluate.
 * @param env - The environment context containing variables and functions.
 * @returns The computed numeric result and its resolved unit.
 */
export function evaluateCalcAST(
    ast: CalcASTNode,
    env: Record<string, number | ((...a: number[]) => number)> // eslint-disable-line no-unused-vars
): CalcEvalResult {
    switch (ast.type) {
        case "number":
            return { value: ast.value, unit: ast.unit };
        case "var": {
            const v = env[ast.name];
            if (v === undefined) throw new Error(`Unknown variable: ${ast.name}`);
            if (typeof v === "function") {
                throw new Error(`Expected variable but found function: ${ast.name}`);
            }
            return { value: v as number, unit: UNIT_NUM };
        }
        case "binary": {
            const L = evaluateCalcAST(ast.left, env);
            const R = evaluateCalcAST(ast.right, env);
            switch (ast.op) {
                case "+":
                case "-": {
                    const val = ast.op === "+" ? L.value + R.value : L.value - R.value;
                    const unitMask = L.unit | R.unit;

                    if (L.unit === R.unit) return { value: val, unit: L.unit };
                    if (unitMask === 5) return { value: val, unit: UNIT_ANG };

                    throw new Error(
                        `Cannot ${ast.op} mismatched units: ${getCalcUnitName(L.unit)} and ${getCalcUnitName(R.unit)}`
                    );
                }
                case "*": {
                    const val = L.value * R.value;
                    if (L.unit === UNIT_NUM) return { value: val, unit: R.unit };
                    if (R.unit === UNIT_NUM) return { value: val, unit: L.unit };
                    throw new Error(`Cannot multiply units: ${getCalcUnitName(L.unit)} and ${getCalcUnitName(R.unit)}`);
                }
                case "/": {
                    if (R.unit === UNIT_NUM) return { value: L.value / R.value, unit: L.unit };
                    if (L.unit === R.unit) return { value: L.value / R.value, unit: UNIT_NUM };
                    throw new Error(`Cannot divide units: ${getCalcUnitName(L.unit)} by ${getCalcUnitName(R.unit)}`);
                }
                default:
                    throw new Error(`Unknown binary operator: ${ast.op}`);
            }
        }
        case "unary": {
            const res = evaluateCalcAST(ast.arg, env);
            if (ast.op === "+") return { value: +res.value, unit: res.unit };
            if (ast.op === "-") return { value: -res.value, unit: res.unit };
            throw new Error(`Unknown unary operator: ${ast.op}`);
        }
        case "call": {
            const fnName = ast.func;

            if (fnName === "var") {
                if (ast.args.length === 0 || ast.args[0].type !== "var") throw new Error("Invalid var() syntax");
                const v = env[ast.args[0].name];
                if (v === undefined) throw new Error(`Unknown variable: ${ast.args[0].name}`);
                return { value: v as number, unit: UNIT_NUM };
            }

            if (fnName === "calc") {
                if (ast.args.length === 0) throw new Error("Empty calc() call");
                return evaluateCalcAST(ast.args[0], env);
            }

            if (fnName === "round") {
                let strategy = "nearest";
                const args = [...ast.args];

                if (args[0].type === "var" && ["nearest", "up", "down", "to-zero"].includes(args[0].name)) {
                    strategy = args[0].name;
                    args.shift();
                }

                const evalArgs = args.map((a) => evaluateCalcAST(a, env));
                const A = evalArgs[0].value;
                const B = evalArgs.length > 1 ? evalArgs[1].value : 1;

                let val: number;
                if (strategy === "nearest") val = Math.round(A / B) * B;
                else if (strategy === "up") val = Math.ceil(A / B) * B;
                else if (strategy === "down") val = Math.floor(A / B) * B;
                else val = Math.trunc(A / B) * B; // to-zero

                return { value: val, unit: evalArgs[0].unit };
            }

            const evaluatedArgs = ast.args.map((a) => evaluateCalcAST(a, env));

            const numArgs = evaluatedArgs.map((a) => {
                if (["sin", "cos", "tan"].includes(fnName) && a.unit === UNIT_ANG) {
                    return a.value * (Math.PI / 180);
                }
                return a.value;
            });

            const fn = env[fnName];
            if (typeof fn !== "function") throw new Error(`Unknown function: ${ast.func}`);

            const val = fn(...numArgs);

            if (["asin", "acos", "atan", "atan2"].includes(fnName)) {
                return { value: val * (180 / Math.PI), unit: UNIT_ANG };
            }

            const preserveUnitFuncs = ["min", "max", "clamp", "abs", "sign", "mod", "rem"];
            if (preserveUnitFuncs.includes(fnName)) {
                let combinedMask = 0;
                for (let i = 0; i < evaluatedArgs.length; i++) {
                    combinedMask |= evaluatedArgs[i].unit;
                }

                if ((combinedMask & 6) === 6) throw new Error(`Function ${ast.func} cannot mix angle and percent`);
                if ((combinedMask & 3) === 3) throw new Error(`Function ${ast.func} cannot mix number and percent`);

                const finalUnit = combinedMask & UNIT_ANG ? UNIT_ANG : combinedMask & UNIT_PCT ? UNIT_PCT : UNIT_NUM;
                return { value: val, unit: finalUnit };
            }

            return { value: val, unit: UNIT_NUM };
        }
        default: {
            throw new Error(`Unknown AST node type: ${(ast as any).type}`); // eslint-disable-line @typescript-eslint/no-explicit-any
        }
    }
}

/**
 * Evaluates a CSS `calc()` expression using the provided component context.
 *
 * @param expr - The expression body without the `calc(` / `)` wrapper.
 * @param type - The expected component definition type.
 * @param base - The environment of known variable values.
 * @param min - Lower bound of the component range.
 * @param max - Upper bound of the component range.
 * @returns The computed numeric result.
 */
export function parseCalcExpression(
    expr: string,
    type: ComponentDefinition["value"],
    base: Record<string, number>,
    min: number,
    max: number
) {
    const calcEnv = Object.assign({}, MATH_ENV, base);
    const tokens = tokenizeCalcExpression(expr, type, min, max);
    const ast = parseCalcTokens(tokens);

    return evaluateCalcAST(ast, calcEnv).value;
}
