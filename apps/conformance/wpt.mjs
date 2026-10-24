#!/usr/bin/env node
/**
 * WPT css-color parsing conformance comparison:
 * saturon vs chroma-js vs colorjs.io vs culori
 *
 * Three kinds of WPT cases are scored separately:
 *   valid     test_valid_value     -> library must accept the input
 *   invalid   test_invalid_value   -> library must reject the input
 *   computed  test_computed_value  -> library's computed value must equal the expected string
 *
 * Install:  pnpm --filter saturon-conformance add -D chroma-js colorjs.io culori
 * Run:      pnpm --filter saturon-conformance wpt [--verbose] [--all] [--json[=path]]
 *
 * Env:
 *   WPT_DIR=/path/to/wpt   use an existing checkout instead of cloning
 *   NO_COLOR=1             disable colored output
 *
 * Flags:
 *   --verbose      list every wrongly-handled input per library (colorized)
 *   --all          don't skip var(...) / currentcolor / sibling-index() / sibling-count() cases
 *   --level-6      register CSS Color Level 6 syntax (color-layers()) in saturon and include its WPT cases
 *   --json[=path]  write results as JSON to a file (default: results.json)
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

import chroma from "chroma-js";
import ColorJS from "colorjs.io";
import { parse as culoriParse, formatCss as culoriFormatCss } from "culori";
import { Color as SaturonColor } from "saturon";

import { MATRICES } from "saturon/matrices";
import { parseNode } from "saturon/syntax";
import { convert } from "saturon/convert";
import { getLayout } from "saturon/layout";

const argv = process.argv.slice(2);
const args = new Set(argv);
const VERBOSE = args.has("--verbose");
const INCLUDE_ALL = args.has("--all");
const LEVEL_6 = args.has("--level-6");
const jsonArg = argv.find((a) => a === "--json" || a.startsWith("--json="));
const JSON_PATH = jsonArg ? resolve(jsonArg.includes("=") ? jsonArg.split("=")[1] : "results.json") : null;

const USE_COLOR = !process.env.NO_COLOR && (process.stdout.isTTY || !!process.env.FORCE_COLOR);
const paint = (code) => (s) => (USE_COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = {
    bold: paint("1"),
    dim: paint("2"),
    red: paint("31"),
    green: paint("32"),
    yellow: paint("33"),
    magenta: paint("35"),
    cyan: paint("36"),
};

const libs = {
    saturon: {
        isValid: (s) => SaturonColor.isValid(s),
        computed: (s) => SaturonColor.computed(s),
    },
    "chroma-js": {
        isValid: (s) => chroma.valid(s),
        computed: (s) => chroma(s).css(),
    },
    "colorjs.io": {
        isValid: (s) => {
            try {
                new ColorJS(s);
                return true;
            } catch {
                return false;
            }
        },
        computed: (s) => new ColorJS(s).toString(),
    },
    culori: {
        isValid: (s) => culoriParse(s) !== undefined,
        computed: (s) => {
            const parsed = culoriParse(s);
            if (parsed === undefined) throw new Error("unparseable");
            return culoriFormatCss(parsed);
        },
    },
};

function readCommit(repo) {
    try {
        const out = execFileSync("git", ["log", "-1", "--format=%H%n%cI%n%s"], {
            cwd: repo,
            stdio: ["ignore", "pipe", "ignore"],
        })
            .toString()
            .trim()
            .split("\n");
        const [hash, date, ...subject] = out;
        return { hash, short: hash.slice(0, 10), date, subject: subject.join(" ") };
    } catch {
        return null;
    }
}

function loadWpt() {
    if (process.env.WPT_DIR) {
        const root = process.env.WPT_DIR;
        return {
            dir: join(root, "css/css-color/parsing"),
            commit: readCommit(root),
            cleanup: () => {},
        };
    }

    const tmp = mkdtempSync(join(tmpdir(), "wpt-"));
    const git = (label, a, cwd = tmp) => {
        console.error(c.dim(`› ${label}`));
        execFileSync("git", a, { cwd, stdio: ["ignore", "ignore", "inherit"] });
    };

    git("Cloning WPT (shallow, sparse)…", [
        "clone",
        "--depth",
        "1",
        "--filter=blob:none",
        "--sparse",
        "--progress",
        "https://github.com/web-platform-tests/wpt.git",
        "wpt",
    ]);
    const repo = join(tmp, "wpt");
    git("Fetching css/css-color files…", ["sparse-checkout", "set", "css/css-color"], repo);

    return {
        dir: join(repo, "css/css-color/parsing"),
        commit: readCommit(repo),
        cleanup: () => rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }),
    };
}

function collect(dir) {
    const cases = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
        const html = readFileSync(join(dir, file), "utf8");
        const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
        const sandbox = {
            test_valid_value: (prop, input, expected) =>
                cases.push({ kind: "valid", prop, input, expected: expected ?? input, file }),
            test_invalid_value: (prop, input) => cases.push({ kind: "invalid", prop, input, file }),
            test_computed_value: (prop, input, expected) =>
                cases.push({ kind: "computed", prop, input, expected: expected ?? input, file }),
            test: () => {},
            assert_equals: () => {},
            CSS: { supports: () => true },
        };
        vm.createContext(sandbox);
        for (const s of scripts) {
            try {
                vm.runInContext(s, sandbox);
            } catch {} // eslint-disable-line no-empty
        }
    }
    return cases;
}

const wpt = loadWpt();
let cases;
try {
    if (!existsSync(wpt.dir)) throw new Error(`WPT dir not found: ${wpt.dir}`);
    cases = collect(wpt.dir);
} finally {
    wpt.cleanup();
}

if (LEVEL_6) {
    SaturonColor.register("color-spaces", [
        {
            name: "display-p3-linear",
            value: {
                components: ["r", "g", "b"],
                bridge: "xyz-d65",
                toBridgeMatrix: MATRICES.P3_to_XYZD65,
                fromBridgeMatrix: MATRICES.XYZD65_to_P3,
            },
        },
    ]);

    const blendModes = [
        "normal",
        "darken",
        "multiply",
        "color-burn",
        "lighten",
        "screen",
        "color-dodge",
        "overlay",
        "soft-light",
        "hard-light",
        "difference",
        "exclusion",
        "hue",
        "saturation",
        "color",
        "luminosity",
    ];

    const isBlendMode = (mode) => blendModes.includes(mode);

    const separable = {
        normal: (b, s) => s,
        darken: Math.min,
        multiply: (b, s) => b * s,
        "color-burn": (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
        lighten: Math.max,
        screen: (b, s) => b + s - b * s,
        "color-dodge": (b, s) => (b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))),
        overlay: (b, s) => separable["hard-light"](s, b),
        "soft-light": (b, s) => {
            if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
            const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
            return b + (2 * s - 1) * (d - b);
        },
        "hard-light": (b, s) => (s <= 0.5 ? b * 2 * s : separable.screen(b, 2 * s - 1)),
        difference: (b, s) => Math.abs(b - s),
        exclusion: (b, s) => b + s - 2 * b * s,
    };

    const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;

    const sat = (c) => Math.max(...c) - Math.min(...c);

    function clipColor(c) {
        const l = lum(c);
        const n = Math.min(...c);
        const x = Math.max(...c);
        if (n < 0) c = c.map((v) => l + ((v - l) * l) / (l - n));
        if (x > 1) c = c.map((v) => l + ((v - l) * (1 - l)) / (x - l));
        return c;
    }

    function setLum(c, l) {
        const d = l - lum(c);
        return clipColor(c.map((v) => v + d));
    }

    function setSat(c, s) {
        const [iMin, iMid, iMax] = [0, 1, 2].sort((i, j) => c[i] - c[j]);
        const out = [0, 0, 0];
        if (c[iMax] > c[iMin]) {
            out[iMid] = ((c[iMid] - c[iMin]) * s) / (c[iMax] - c[iMin]);
            out[iMax] = s;
        }
        return out;
    }

    const nonSeparable = {
        hue: (cb, cs) => setLum(setSat(cs, sat(cb)), lum(cb)),
        saturation: (cb, cs) => setLum(setSat(cb, sat(cs)), lum(cb)),
        color: (cb, cs) => setLum(cs, lum(cb)),
        luminosity: (cb, cs) => setLum(cb, lum(cs)),
    };

    const isNonSeparable = (mode) => mode in nonSeparable;

    function blendChannels(cb, cs, mode) {
        if (isNonSeparable(mode)) {
            return nonSeparable[mode]([cb[0], cb[1], cb[2]], [cs[0], cs[1], cs[2]]);
        }
        const fn = separable[mode];
        return cs.map((s, i) => fn(cb[i], s));
    }

    function composite(top, bottom, mode, alphaIndex) {
        const as = top[alphaIndex];
        const ab = bottom[alphaIndex];
        const ao = as + ab * (1 - as);
        if (ao === 0) return top.map(() => 0);

        const blended = blendChannels(bottom, top, mode);

        return top.map((s, i) => {
            if (i === alphaIndex) return ao;
            const cb = bottom[i];
            const cr = (1 - ab) * s + ab * blended[i];
            return (as * cr + (1 - as) * ab * cb) / ao;
        });
    }

    SaturonColor.register("parsers", [
        {
            name: "<blend-mode>",
            value: {
                rule: blendModes.join(" | "),
            },
        },
        {
            name: "<color-layers()>",
            value: {
                appendTo: "<color>",
                rule: "color-layers([ <blend-mode>, ]? <color># )",
                parse: (node) => {
                    const children = node.value;
                    const rawMode = children.find((n) => n.type === "<blend-mode>")?.value ?? "normal";
                    const mode = isBlendMode(rawMode) ? rawMode : "normal";
                    const { alphaIndex } = getLayout("srgb");

                    const layers = children
                        .filter((n) => n.type === "<color>")
                        .map((n) => convert(parseNode(n), "srgb"));

                    const coords = layers
                        .slice(0, -1)
                        .reduceRight((bottom, top) => composite(top, bottom, mode, alphaIndex), layers.at(-1));

                    return { model: "srgb", coords };
                },
            },
        },
    ]);
}

const SKIP = [/var\(/, /currentcolor/i, /sibling-(index|count)\(/i];
const seen = new Set();
cases = cases
    .filter((t) => t.prop === "color")
    .filter((t) => {
        if (!INCLUDE_ALL && SKIP.some((r) => r.test(t.input))) return false;
        const key = t.kind === "computed" ? `computed|${t.input}|${t.expected}` : `${t.kind}|${t.input}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

const validCases = cases.filter((t) => t.kind === "valid");
const invalidCases = cases.filter((t) => t.kind === "invalid");
const computedCases = cases.filter((t) => t.kind === "computed");

const results = {};
for (const [name, lib] of Object.entries(libs)) {
    const r = {
        validPass: 0,
        invalidPass: 0,
        computedPass: 0,
        computedSupported: typeof lib.computed === "function",
        failures: [],
    };
    for (const t of cases) {
        if (t.kind === "computed") {
            if (!r.computedSupported) continue;
            let got;
            try {
                got = String(lib.computed(t.input));
            } catch {
                got = null;
            }
            if (got === t.expected) r.computedPass++;
            else r.failures.push({ kind: "computed", input: t.input, expected: t.expected, got, file: t.file });
            continue;
        }

        const shouldBeValid = t.kind === "valid";
        let got;
        try {
            got = !!lib.isValid(t.input);
        } catch {
            got = false;
        }
        if (got === shouldBeValid) {
            if (shouldBeValid) r.validPass++;
            else r.invalidPass++;
        } else {
            r.failures.push({
                kind: t.kind,
                input: t.input,
                expected: shouldBeValid ? "valid" : "invalid",
                file: t.file,
            });
        }
    }
    results[name] = r;
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) + "%" : "n/a");
const frac = (n, d) => `${n}/${d} (${pct(n, d)})`;

const summary = Object.entries(results)
    .map(([name, r]) => ({
        library: name,
        valid: frac(r.validPass, validCases.length),
        invalid: frac(r.invalidPass, invalidCases.length),
        computed: r.computedSupported ? frac(r.computedPass, computedCases.length) : "n/a",
        _score: r.validPass + r.invalidPass,
    }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest); // eslint-disable-line no-unused-vars

console.log(
    `\n${c.bold("WPT css-color parsing:")} ${cases.length} cases ` +
        `(${c.green(validCases.length + " valid")}, ${c.red(invalidCases.length + " invalid")}, ` +
        `${c.cyan(computedCases.length + " computed")})` +
        (INCLUDE_ALL ? "" : c.dim(" — var()/currentcolor/sibling-index()/sibling-count() skipped")) +
        "\n"
);

const wptLine = wpt.commit
    ? `${c.bold("WPT commit:")} ${c.cyan(wpt.commit.short)} ${c.dim(`(${wpt.commit.date.slice(0, 10)})`)} ${wpt.commit.subject}`
    : c.dim("WPT commit: unknown (WPT_DIR is not a git checkout)");
console.log(wptLine + "\n");

console.table(summary);

if (JSON_PATH) {
    writeFileSync(
        JSON_PATH,
        JSON.stringify(
            {
                wpt: wpt.commit,
                totals: {
                    valid: validCases.length,
                    invalid: invalidCases.length,
                    computed: computedCases.length,
                    all: cases.length,
                },
                summary,
                results,
            },
            null,
            2
        )
    );
    console.log(`\n${c.green("✔")} JSON written to ${c.cyan(JSON_PATH)}`);
}

if (VERBOSE) {
    for (const [name, r] of Object.entries(results)) {
        const missed = r.failures.filter((f) => f.kind === "valid").length;
        const leaked = r.failures.filter((f) => f.kind === "invalid").length;
        const mismatched = r.failures.filter((f) => f.kind === "computed").length;
        console.log(
            `\n${c.bold(c.cyan(`=== ${name}`))} ${c.bold(c.cyan("==="))} ` +
                (r.failures.length ? c.red(`${r.failures.length} wrong`) : c.green("0 wrong")) +
                c.dim(
                    ` (${missed} valid rejected, ${leaked} invalid accepted` +
                        (r.computedSupported ? `, ${mismatched} computed mismatches)` : ")")
                )
        );
        for (const f of r.failures) {
            if (f.kind === "computed") {
                console.log(
                    `  ${c.red("[computed mismatch]")} ${c.yellow(f.input)}  ${c.dim(f.file)}\n` +
                        `      expected ${c.green(f.expected)}\n` +
                        `      got      ${f.got === null ? c.red("(threw)") : c.red(f.got)}`
                );
                continue;
            }
            const tag = f.expected === "valid" ? c.red("[should be valid]  ") : c.magenta("[should be invalid]");
            console.log(`  ${tag} ${c.yellow(f.input)}  ${c.dim(f.file)}`);
        }
    }
} else {
    console.log(c.dim("\nRun with --verbose to list every wrongly-handled input."));
}
