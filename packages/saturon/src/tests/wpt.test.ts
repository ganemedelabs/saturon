import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import vm from "vm";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Color } from "../Color.js";

type Case = { kind: "valid" | "invalid" | "computed"; prop: string; input: string; expected?: string; file: string };

function loadWptCases(): Case[] {
    const tmp = mkdtempSync(join(tmpdir(), "wpt-"));
    const repo = join(tmp, "wpt");
    const git = (args: string[], cwd = tmp) => execFileSync("git", args, { cwd, stdio: "pipe" });

    try {
        git([
            "clone",
            "--depth",
            "1",
            "--filter=blob:none",
            "--sparse",
            "https://github.com/web-platform-tests/wpt.git",
            "wpt",
        ]);
        git(["sparse-checkout", "set", "css/css-color"], repo);
        return collect(join(repo, "css/css-color/parsing"));
    } finally {
        rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
    }
}

export function collect(dir: string): Case[] {
    const cases: Case[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
        const html = readFileSync(join(dir, file), "utf8");
        const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
        const sandbox = {
            test_valid_value: (prop: string, input: string, expected?: string) =>
                cases.push({ kind: "valid", prop, input, expected: expected ?? input, file }),
            test_invalid_value: (prop: string, input: string) => cases.push({ kind: "invalid", prop, input, file }),
            test_computed_value: (prop: string, input: string, expected?: string) =>
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

const cases = loadWptCases().filter((c) => c.prop === "color");
const SKIP = [/var\(/, /currentcolor/i];

describe("WPT css-color parsing", () => {
    for (const c of cases) {
        if (SKIP.some((r) => r.test(c.input))) continue;
        it(`${c.kind}: ${c.input}`, () => {
            if (c.kind === "invalid") {
                expect(Color.isValid(c.input)).toBe(false);
            } else {
                expect(Color.isValid(c.input)).toBe(true);
            }
        });
    }
});
