import { Color } from "../Color.js";
import { colorModels } from "../converters.js";

describe("random", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("model selection", () => {
        it("generates a color using an explicitly specified model", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({ model: "rgb" });

            expect(result.model).toBe("rgb");
            expect(result.coords).toHaveLength(Color.get("components:rgb").length);
        });

        it("randomly selects a model when no model is specified", () => {
            const models = Color.get("color-models");

            jest.spyOn(Math, "random").mockReturnValue(0);

            const result = Color.random();

            expect(result.model).toBe(models[0]);
        });

        it("selects the last model when Math.random is close to 1", () => {
            const models = Color.get("color-models");

            jest.spyOn(Math, "random").mockReturnValue(0.999999);

            const result = Color.random();

            expect(result.model).toBe(models[models.length - 1]);
        });
    });

    describe("default ranges", () => {
        it("generates RGB components within their default ranges", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({ model: "rgb" });

            for (const value of result.coords) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(255);
            }
        });

        it("generates HSL hue within 0-360", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({ model: "hsl" });

            expect(result.coords[0]).toBe(180);
        });

        it("generates HSL percentages within 0-100", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({ model: "hsl" });

            expect(result.coords[1]).toBe(50);
            expect(result.coords[2]).toBe(50);
        });
    });

    describe("limits", () => {
        it("uses custom minimum and maximum limits", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [100, 200],
                },
            });

            expect(result.coords[0]).toBe(150);
        });

        it("allows only a custom minimum", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [100, undefined],
                },
            });

            expect(result.coords[0]).toBe(178);
        });

        it("allows only a custom maximum", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [undefined, 200],
                },
            });

            expect(result.coords[0]).toBe(100);
        });

        it("supports a fixed component using equal min and max", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.123);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [42, 42],
                },
            });

            expect(result.coords[0]).toBe(42);
        });

        it("throws when minimum is greater than maximum", () => {
            expect(() =>
                Color.random({
                    model: "rgb",
                    limits: {
                        r: [200, 100],
                    },
                })
            ).toThrow('Limit min (200) cannot be greater than max (100) for component "r".');
        });
    });

    describe("invalid components", () => {
        it("throws for an invalid limits component", () => {
            expect(() =>
                Color.random({
                    model: "rgb",
                    limits: {
                        invalid: [0, 100],
                    } as never,
                })
            ).toThrow(/Invalid component "invalid" for model "rgb"\. Valid components:/);
        });

        it("throws for an invalid bias component", () => {
            expect(() =>
                Color.random({
                    model: "rgb",
                    bias: {
                        invalid: () => 0.5,
                    } as never,
                })
            ).toThrow(/Invalid component "invalid" for model "rgb"\. Valid components:/);
        });

        it("throws for an invalid base component", () => {
            expect(() =>
                Color.random({
                    model: "rgb",
                    base: {
                        invalid: 50,
                    } as never,
                })
            ).toThrow(/Invalid component "invalid" for model "rgb"\. Valid components:/);
        });

        it("throws for an invalid deviation component", () => {
            expect(() =>
                Color.random({
                    model: "rgb",
                    deviation: {
                        invalid: 10,
                    } as never,
                })
            ).toThrow(/Invalid component "invalid" for model "rgb"\. Valid components:/);
        });
    });

    describe("bias", () => {
        it("applies a bias function to the random value", () => {
            const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);

            const bias = jest.fn((x: number) => x * 2);

            const result = Color.random({
                model: "rgb",
                bias: {
                    r: bias,
                },
            });

            expect(bias).toHaveBeenCalledWith(0.25);
            expect(result.coords[0]).toBe(128);
            expect(randomSpy).toHaveBeenCalled();
        });

        it("allows a bias function to produce values outside 0-1", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                bias: {
                    r: () => 2,
                },
            });

            expect(result.coords[0]).toBe(255);
        });

        it("clamps a negatively biased value to the minimum", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                bias: {
                    r: () => -1,
                },
            });

            expect(result.coords[0]).toBe(0);
        });
    });

    describe("base and deviation", () => {
        it("uses the supplied base and deviation", () => {
            const u = 0.5;
            const v = 0;
            const expected = 100 + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 10;

            jest.spyOn(Math, "random").mockReturnValueOnce(u).mockReturnValueOnce(v);

            const result = Color.random({
                model: "rgb",
                base: {
                    r: 100,
                },
                deviation: {
                    r: 10,
                },
            });

            expect(result.coords[0]).toBeCloseTo(Math.round(expected));
        });

        it("uses the midpoint as the default base when only deviation is supplied", () => {
            const u = 0.5;
            const v = 0;

            jest.spyOn(Math, "random").mockReturnValueOnce(u).mockReturnValueOnce(v);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [50, 150],
                },
                deviation: {
                    r: 0,
                },
            });

            expect(result.coords[0]).toBe(100);
        });

        it("uses one-sixth of the range as the default deviation when only base is supplied", () => {
            const u = 0.5;
            const v = 0;

            jest.spyOn(Math, "random").mockReturnValueOnce(u).mockReturnValueOnce(v);

            const expected = 100 + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * ((150 - 50) / 6);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [50, 150],
                },
                base: {
                    r: 100,
                },
            });

            expect(result.coords[0]).toBeCloseTo(Math.round(expected));
        });

        it("clamps Gaussian values above the maximum", () => {
            jest.spyOn(Math, "random").mockReturnValueOnce(0.000001).mockReturnValueOnce(0);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [0, 100],
                },
                base: {
                    r: 100,
                },
                deviation: {
                    r: 100,
                },
            });

            expect(result.coords[0]).toBe(100);
        });

        it("clamps Gaussian values below the minimum", () => {
            jest.spyOn(Math, "random").mockReturnValueOnce(0.000001).mockReturnValueOnce(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [0, 100],
                },
                base: {
                    r: 0,
                },
                deviation: {
                    r: 100,
                },
            });

            expect(result.coords[0]).toBe(0);
        });

        it("uses 1e-9 when Math.Color.random() returns zero", () => {
            jest.spyOn(Math, "random").mockReturnValue(0);

            const result = Color.random({
                model: "rgb",
                base: {
                    r: 100,
                },
                deviation: {
                    r: 0,
                },
            });

            expect(result.coords[0]).toBe(100);
        });
    });

    describe("hue normalization", () => {
        it("wraps hue values above 360", () => {
            jest.spyOn(Math, "random").mockReturnValue(1);

            const result = Color.random({
                model: "hsl",
                bias: {
                    h: () => 2,
                },
            });

            expect(result.coords[0]).toBe(0);
        });

        it("wraps negative hue values", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "hsl",
                bias: {
                    h: () => -0.5,
                },
            });

            expect(result.coords[0]).toBe(180);
        });

        it("normalizes hue using modulo rather than clamping", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "hsl",
                bias: {
                    h: () => 2,
                },
            });

            expect(result.coords[0]).toBe(0);
        });
    });

    describe("clamping", () => {
        it("clamps regular components to their configured maximum", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [50, 100],
                },
                bias: {
                    r: () => 2,
                },
            });

            expect(result.coords[0]).toBe(100);
        });

        it("clamps regular components to their configured minimum", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [50, 100],
                },
                bias: {
                    r: () => -1,
                },
            });

            expect(result.coords[0]).toBe(50);
        });
    });

    describe("precision", () => {
        it("rounds components according to their configured precision", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.123456);

            const result = Color.random({
                model: "rgb",
            });

            expect(result.coords[0]).toBe(Math.round(0.123456 * 255));
        });

        it("applies rounding after clamping/normalization", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.123456);

            const result = Color.random({
                model: "hsl",
            });

            expect(result.coords[0]).toBe(Math.round(0.123456 * 360));
            expect(result.coords[1]).toBe(Math.round(0.123456 * 100));
        });
    });

    describe("coordinate ordering", () => {
        it("places component values at their declared indexes", () => {
            jest.spyOn(Math, "random").mockReturnValue(0);

            const result = Color.random({
                model: "rgb",
            });

            const components = colorModels.rgb.components;

            for (const [name, component] of Object.entries(components)) {
                expect(result.coords[component.index]).toBeDefined();
                expect(result.coords[component.index]).toBe(0);
                expect(name).toBeDefined();
            }
        });
    });

    describe("options", () => {
        it("does not use options for an implicitly selected model", () => {
            jest.spyOn(Math, "random").mockReturnValue(0);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [100, 100],
                },
            });

            expect(result.model).toBe(Object.keys(colorModels)[0]);
        });

        it("supports an empty options object", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            expect(() => Color.random({})).not.toThrow();
        });

        it("supports calling random without arguments", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            expect(() => Color.random()).not.toThrow();
        });
    });

    describe("multiple components", () => {
        it("applies independent limits to multiple RGB components", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                limits: {
                    r: [10, 20],
                    g: [30, 40],
                    b: [50, 60],
                },
            });

            expect(result.coords.slice(0, 3)).toEqual([15, 35, 55]);
        });

        it("applies independent bias functions to multiple components", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                bias: {
                    r: () => 0,
                    g: () => 0.5,
                    b: () => 1,
                },
            });

            expect(result.coords[0]).toBe(0);
            expect(result.coords[1]).toBe(128);
            expect(result.coords[2]).toBe(255);
        });

        it("applies independent base values to multiple components", () => {
            jest.spyOn(Math, "random").mockReturnValue(0.5);

            const result = Color.random({
                model: "rgb",
                base: {
                    r: 10,
                    g: 100,
                    b: 200,
                },
                deviation: {
                    r: 0,
                    g: 0,
                    b: 0,
                },
            });

            expect(result.coords.slice(0, 3)).toEqual([10, 100, 200]);
        });
    });
});
