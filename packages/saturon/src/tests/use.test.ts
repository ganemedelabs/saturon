import { Color } from "../Color.js";
import { ColorModel } from "../converters.js";

declare module "../Color.js" {
    // eslint-disable-next-line no-unused-vars
    interface Color<M extends ColorModel = ColorModel> {
        /**
         * Lightens the color by the given amount.
         * @param amount - The amount to lighten the color by.
         * @returns A new `Color` instance with increased brightness.
         */
        lighten(amount: number): Color<"hsl">; // eslint-disable-line no-unused-vars
        /**
         * Darkens the color by the given amount.
         * @param amount - The amount to darken the color by.
         * @returns A new `Color` instance with decreased brightness.
         */
        darken(amount: number): Color<"hsl">; // eslint-disable-line no-unused-vars
    }
}

describe("Color.use()", () => {
    it("should register methods to the class", () => {
        const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

        const lightenPlugin = (ColorClass: typeof Color) => {
            ColorClass.prototype.lighten = function <M extends ColorModel>(this: Color<M>, amount: number) {
                return this.in("hsl").with({
                    l: (l: number) => clamp(l + amount, 0, 100),
                });
            };
        };

        const darkenPlugin = (ColorClass: typeof Color) => {
            ColorClass.prototype.darken = function <M extends ColorModel>(this: Color<M>, amount: number) {
                return this.in("hsl").with({
                    l: (l: number) => clamp(l - amount, 0, 100),
                });
            };
        };

        Color.use(lightenPlugin, darkenPlugin);

        const color = Color.from("hsl(50 50 50)");
        expect(color.lighten(10).toString()).toBe("hsl(50 50 60)");
        expect(color.darken(20).toString()).toBe("hsl(50 50 30)");
    });

    it("should throw if called with no arguments", () => {
        expect(() => Color.use()).toThrow();
    });

    it("should throw if a non-function plugin is passed", () => {
        expect(() => Color.use("notAFunction" as unknown as () => void)).toThrow();
    });

    it("should warn and skip duplicate plugins", () => {
        const plugin = jest.fn();
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        Color.use(plugin);
        Color.use(plugin);

        expect(warnSpy).toHaveBeenCalledWith("Plugin at index 0 is already registered. Skipping.");
        warnSpy.mockRestore();
    });

    it("should log an error if a plugin throws", () => {
        const error = new Error("plugin fail");
        const badPlugin = () => {
            throw error;
        };

        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        Color.use(badPlugin);

        expect(errorSpy).toHaveBeenCalledWith("Error running plugin at index 0:", error);
        errorSpy.mockRestore();
    });

    it("should allow multiple plugins in a single call", () => {
        const pluginA = jest.fn();
        const pluginB = jest.fn();

        Color.use(pluginA, pluginB);

        expect(pluginA).toHaveBeenCalledWith(Color);
        expect(pluginB).toHaveBeenCalledWith(Color);
    });
});
