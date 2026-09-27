import { parsePercent, parseHue, parseCalcExpression } from "../calc.js";

describe("CSS Color Calc Engine (W3C Level 4 Compliant)", () => {
    describe("parsePercent", () => {
        it("correctly maps percentages to standard array bounds", () => {
            expect(parsePercent("50%", [0, 255], 0, 255)).toBe(127.5);
            expect(parsePercent("100%", [0, 1], 0, 1)).toBe(1);
        });

        it("throws on invalid percentages", () => {
            expect(() => parsePercent("abc%", [0, 1], 0, 1)).toThrow("Invalid percentage");
        });
    });

    describe("parseHue (Angle Unit Conversion)", () => {
        it("handles standard degrees", () => {
            expect(parseHue("90deg")).toBe(90);
            expect(parseHue("-45deg")).toBe(-45);
        });

        it("converts radians to degrees", () => {
            expect(parseHue(`${Math.PI}rad`)).toBeCloseTo(180);
            expect(parseHue(`${Math.PI / 2}rad`)).toBeCloseTo(90);
        });

        it("converts gradians to degrees", () => {
            expect(parseHue("100grad")).toBe(90);
            expect(parseHue("400grad")).toBe(360);
        });

        it("converts turns to degrees", () => {
            expect(parseHue("0.5turn")).toBe(180);
            expect(parseHue("1turn")).toBe(360);
        });
    });

    describe("parseCalcExpression & AST Evaluation", () => {
        const evaluateCalc = (expr: string, base = {}) => parseCalcExpression(expr, [0, 100], base, 0, 100);

        describe("Basic Arithmetic & Precedence", () => {
            it("respects standard PEMDAS precedence", () => {
                expect(evaluateCalc("10 + 5 * 2")).toBe(20);
                expect(evaluateCalc("(10 + 5) * 2")).toBe(30);
                expect(evaluateCalc("100 / 2 + 50")).toBe(100);
            });
        });

        describe("Strict W3C Whitespace Rules", () => {
            it("evaluates valid spacing for + and -", () => {
                expect(evaluateCalc("10 + 5")).toBe(15);
                expect(evaluateCalc("10 - 5")).toBe(5);
            });

            it("throws syntax error if + or - lacks surrounding whitespace", () => {
                expect(() => evaluateCalc("10+ 5")).toThrow();
                expect(() => evaluateCalc("10 +5")).toThrow();
                expect(() => evaluateCalc("10-5")).toThrow();
            });

            it("allows * and / without whitespace", () => {
                expect(evaluateCalc("10*5")).toBe(50);
                expect(evaluateCalc("100/2")).toBe(50);
            });

            it("allows unary operators without whitespace", () => {
                expect(evaluateCalc("10 * -5")).toBe(-50);
                expect(evaluateCalc("10 * +5")).toBe(50);
            });
        });

        describe("Constants (<calc-keyword>)", () => {
            it("evaluates math constants", () => {
                expect(evaluateCalc("pi")).toBeCloseTo(Math.PI);
                expect(evaluateCalc("e")).toBeCloseTo(Math.E);
            });

            it("handles infinity and NaN within expressions", () => {
                expect(evaluateCalc("infinity * 0")).toBeNaN();
                expect(evaluateCalc("infinity / 2")).toBe(Infinity);
                expect(evaluateCalc("-infinity + 10")).toBe(-Infinity);
            });
        });

        describe("Trigonometry & Angle Conversions", () => {
            it("converts standard degree angle units to radians for trig functions", () => {
                expect(evaluateCalc("sin(90deg)")).toBe(1);
                expect(evaluateCalc("cos(180deg)")).toBe(-1);
                expect(evaluateCalc("tan(45deg)")).toBeCloseTo(1);
            });

            it("evaluates pure numbers as radians", () => {
                expect(evaluateCalc(`sin(${Math.PI / 2})`)).toBe(1);
            });

            it("returns degrees from inverse trig functions", () => {
                expect(evaluateCalc("asin(1)")).toBe(90);
                expect(evaluateCalc("acos(-1)")).toBeCloseTo(180);
            });
        });

        describe("CSS Level 4 Math Functions", () => {
            it("evaluates clamp, min, and max", () => {
                expect(evaluateCalc("clamp(10, 5, 20)")).toBe(10);
                expect(evaluateCalc("clamp(10, 25, 20)")).toBe(20);
                expect(evaluateCalc("min(10, 5, 20)")).toBe(5);
                expect(evaluateCalc("max(10, 5, 20)")).toBe(20);
            });

            it("evaluates CSS mod and rem", () => {
                expect(evaluateCalc("mod(17, 5)")).toBe(2);
                expect(evaluateCalc("mod(-17, 5)")).toBe(3); // CSS mod() differs from JS % on negatives
                expect(evaluateCalc("rem(-17, 5)")).toBe(-2);
            });

            it("evaluates pow, sqrt, hypot", () => {
                expect(evaluateCalc("pow(2, 3)")).toBe(8);
                expect(evaluateCalc("sqrt(25)")).toBe(5);
                expect(evaluateCalc("hypot(3, 4)")).toBe(5);
            });
        });

        describe("CSS round() Strategies", () => {
            it("defaults to nearest", () => {
                expect(evaluateCalc("round(105, 10)")).toBe(110);
                expect(evaluateCalc("round(104, 10)")).toBe(100);
            });

            it("respects 'nearest' keyword", () => {
                expect(evaluateCalc("round(nearest, 105, 10)")).toBe(110);
            });

            it("respects 'up' keyword", () => {
                expect(evaluateCalc("round(up, 101, 10)")).toBe(110);
            });

            it("respects 'down' keyword", () => {
                expect(evaluateCalc("round(down, 109, 10)")).toBe(100);
            });

            it("respects 'to-zero' keyword", () => {
                expect(evaluateCalc("round(to-zero, 105, 10)")).toBe(100);
                expect(evaluateCalc("round(to-zero, -105, 10)")).toBe(-100);
            });
        });

        describe("Nested Contexts (var and calc)", () => {
            it("resolves nested calc() as logical parentheses", () => {
                expect(evaluateCalc("10 * calc(2 + 3)")).toBe(50);
            });

            it("resolves inline var() statements", () => {
                expect(evaluateCalc("10 + var(--my-var)", { "--my-var": 20 })).toBe(30);
            });

            it("throws on unknown variables", () => {
                expect(() => evaluateCalc("var(--missing)")).toThrow("Unknown variable");
            });
        });

        describe("Unit Interaction & Error Handling", () => {
            it("allows multiplying/dividing values by raw numbers", () => {
                expect(parseCalcExpression("10deg * 5", "hue", {}, 0, 100)).toBe(50);
                expect(parseCalcExpression("100% / 2", [0, 100], {}, 0, 100)).toBe(50);
            });

            it("throws when multiplying two units together", () => {
                expect(() => parseCalcExpression("10deg * 10deg", "hue", {}, 0, 100)).toThrow("Cannot multiply units");
                expect(() => parseCalcExpression("10% * 10%", "percentage", {}, 0, 100)).toThrow(
                    "Cannot multiply units"
                );
            });

            it("throws when adding mismatched units", () => {
                expect(() => parseCalcExpression("10deg + 50%", "hue", {}, 0, 100)).toThrow("mismatched units");
            });
        });
    });
});
