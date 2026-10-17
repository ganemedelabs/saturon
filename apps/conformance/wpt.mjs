#!/usr/bin/env node
/**
 * WPT css-color parsing conformance comparison:
 * saturon vs chroma-js vs colorjs.io vs culori
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
 *   --all          don't skip var(...) / currentcolor cases
 *   --json[=path]  write results as JSON to a file (default: results.json)
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

import chroma from "chroma-js";
import ColorJS from "colorjs.io";
import { parse as culoriParse } from "culori";
import { Color as SaturonColor } from "saturon";

const argv = process.argv.slice(2);
const args = new Set(argv);
const VERBOSE = args.has("--verbose");
const INCLUDE_ALL = args.has("--all");
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
    saturon: (s) => SaturonColor.isValid(s),
    "chroma-js": (s) => chroma.valid(s),
    "colorjs.io": (s) => {
        try {
            new ColorJS(s);
            return true;
        } catch {
            return false;
        }
    },
    culori: (s) => culoriParse(s) !== undefined,
};

function loadWpt() {
    if (process.env.WPT_DIR) {
        return { dir: join(process.env.WPT_DIR, "css/css-color/parsing"), cleanup: () => {} };
    }
    const tmp = mkdtempSync(join(tmpdir(), "wpt-"));
    const git = (a, cwd = tmp) => execFileSync("git", a, { cwd, stdio: "pipe" });
    git([
        "clone",
        "--depth",
        "1",
        "--filter=blob:none",
        "--sparse",
        "https://github.com/web-platform-tests/wpt.git",
        "wpt",
    ]);
    const repo = join(tmp, "wpt");
    git(["sparse-checkout", "set", "css/css-color"], repo);
    return {
        dir: join(repo, "css/css-color/parsing"),
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

const SKIP = [/var\(/, /currentcolor/i];
const seen = new Set();
cases = cases
    .filter((t) => t.prop === "color")
    .filter((t) => {
        if (!INCLUDE_ALL && SKIP.some((r) => r.test(t.input))) return false;
        const shouldBeValid = t.kind !== "invalid";
        const key = `${shouldBeValid}|${t.input}`;
        if (seen.has(key)) return false;
        seen.add(key);
        t.shouldBeValid = shouldBeValid;
        return true;
    });

const validCases = cases.filter((t) => t.shouldBeValid);
const invalidCases = cases.filter((t) => !t.shouldBeValid);

const results = {};
for (const [name, isValid] of Object.entries(libs)) {
    const r = { validPass: 0, invalidPass: 0, failures: [] };
    for (const t of cases) {
        let got;
        try {
            got = !!isValid(t.input);
        } catch {
            got = false;
        }
        if (got === t.shouldBeValid) {
            if (t.shouldBeValid) r.validPass++;
            else r.invalidPass++;
        } else {
            r.failures.push({ input: t.input, expected: t.shouldBeValid ? "valid" : "invalid", file: t.file });
        }
    }
    results[name] = r;
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) + "%" : "n/a");

const summary = Object.entries(results)
    .map(([name, r]) => ({
        library: name,
        valid: `${r.validPass}/${validCases.length} (${pct(r.validPass, validCases.length)})`,
        invalid: `${r.invalidPass}/${invalidCases.length} (${pct(r.invalidPass, invalidCases.length)})`,
        overall: `${r.validPass + r.invalidPass}/${cases.length} (${pct(r.validPass + r.invalidPass, cases.length)})`,
        _score: r.validPass + r.invalidPass,
    }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest); // eslint-disable-line no-unused-vars

console.log(
    `\n${c.bold("WPT css-color parsing:")} ${cases.length} cases ` +
        `(${c.green(validCases.length + " valid")}, ${c.red(invalidCases.length + " invalid")})` +
        (INCLUDE_ALL ? "" : c.dim(" — var()/currentcolor skipped")) +
        "\n"
);
console.table(summary);

if (JSON_PATH) {
    writeFileSync(
        JSON_PATH,
        JSON.stringify(
            {
                totals: { valid: validCases.length, invalid: invalidCases.length, all: cases.length },
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
        const missed = r.failures.filter((f) => f.expected === "valid").length;
        const leaked = r.failures.length - missed;
        console.log(
            `\n${c.bold(c.cyan(`=== ${name}`))} ${c.bold(c.cyan("==="))} ` +
                (r.failures.length ? c.red(`${r.failures.length} wrong`) : c.green("0 wrong")) +
                c.dim(` (${missed} valid rejected, ${leaked} invalid accepted)`)
        );
        for (const f of r.failures) {
            const tag = f.expected === "valid" ? c.red("[should be valid]  ") : c.magenta("[should be invalid]");
            console.log(`  ${tag} ${c.yellow(f.input)}  ${c.dim(f.file)}`);
        }
    }
} else {
    console.log(c.dim("\nRun with --verbose to list every wrongly-handled input."));
}
