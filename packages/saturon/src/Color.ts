import { ColorModel, colorModels, ColorSpace, Component } from "./converters.js";
import { config, Config, configure } from "./config.js";
import { NamedColor } from "./namedColors.js";
import { ComponentOptions, FormattingOptions, OutputType } from "./formatters.js";
import { mixColors, MixItem, MixOptions } from "./colorMix.js";
import { register, RegistererFn, RegistererType, unregister, UnregistererFn } from "./registry.js";
import { parse } from "./parse.js";
import { format } from "./format.js";
import { convert } from "./convert.js";
import { deltaE2000, deltaE76, deltaE94, deltaEOK } from "./deltaE.js";
import { inGamut, InGamutOptions, toGamut, ToGamutOptions } from "./gamut.js";
import { contrast } from "./contrast.js";
import { random, RandomOptions } from "./random.js";
import { toArray } from "./toArray.js";
import { toObject } from "./toObject.js";
import { isValid, IsValidOptions } from "./isValid.js";
import { ColorUpdateValues, updateColor } from "./updateColor.js";
import { interpolate } from "./interpolate.js";
import { scale, ScaleOptions } from "./scale.js";
import { get, Getter, getters } from "./getters.js";

/** Signature for a plugin function that augments the Color class at runtime. */
export type Plugin = (colorClass: typeof Color) => void; // eslint-disable-line no-unused-vars

/** Registered plugin functions that extend the Color class. */
export const plugins = new Set<(colorClass: typeof Color) => void>(); // eslint-disable-line no-unused-vars

/** Represents a CSS color value and exposes parsing, conversion, formatting, and mixing behavior. */
export class Color<M extends ColorModel = ColorModel> {
    model: M;
    coords: number[];

    constructor(model: M, coords: number[] = [0, 0, 0, 0]) {
        if (model in colorModels === false) throw new Error(`Unsupported color model: '${model}'`);
        if ([3, 4].includes(coords.length) === false) throw new Error("Coordinates array must have 3 or 4 elements.");

        const c = coords.slice();
        if (c.length === 3) c.push(1);

        this.model = model;
        this.coords = c;
    }

    /** @returns The current configuration object. */
    static get config(): Config {
        return config;
    }

    /**
     * Merges a partial runtime configuration into the global configuration object.
     *
     * @param options - The partial configuration values to apply.
     */
    static configure(options: Partial<Config>): void {
        return configure(options);
    }

    /**
     * Registers one or more plugins to extend the Color class.
     *
     * @param pluginFns - Functions that receive the Color class and enhance it.
     * @throws If no plugins are provided or a plugin is not a function.
     */
    static use(...pluginFns: Plugin[]): void {
        if (!pluginFns.length) throw new Error("use() requires at least one plugin.");

        for (const [i, plugin] of pluginFns.entries()) {
            if (typeof plugin !== "function")
                throw new TypeError(`Plugin at index ${i} is not a function (received ${typeof plugin})`);

            if (plugins.has(plugin)) {
                console.warn(`Plugin at index ${i} is already registered. Skipping.`);
                continue;
            }

            try {
                plugin(Color);
                plugins.add(plugin);
            } catch (err) {
                console.error(`Error running plugin at index ${i}:`, err);
            }
        }
    }

    /**
     * Registers a batch of entries for the requested registry type.
     *
     * @template T - The registry category to register into.
     * @param type - The registry type to use.
     * @param entries - The entries to register.
     */
    static register<T extends RegistererType>(
        type: T,
        entries: Array<{
            name: Parameters<RegistererFn<T>>[0];
            value: Parameters<RegistererFn<T>>[1];
        }>
    ): void {
        return register(type, entries);
    }

    /**
     * Unregisters a batch of entries for the requested registry type.
     *
     * @template T - The registry category to unregister from.
     * @param type - The registry type to use.
     * @param names - The names of the entries to unregister.
     */
    static unregister<T extends RegistererType>(type: T, names: Array<Parameters<UnregistererFn<T>>[0]>): void {
        return unregister(type, names);
    }

    /**
     * Creates a new `Color` from a color string.
     *
     * @template T - Color model type.
     * @param color - Color string to parse.
     * @returns A new `Color` instance.
     */
    /* eslint-disable no-unused-vars, @typescript-eslint/no-explicit-any */
    static from(color: NamedColor): Color<"rgb">;
    static from(color: "transparent"): Color<"rgb">;
    static from(color: `#${string}`): Color<"rgb">;
    static from(color: `rgb(${string})` | `rgba(${string})`): Color<"rgb">;
    static from(color: `hsl(${string})` | `hsla(${string})`): Color<"hsl">;
    static from(color: `hwb(${string})`): Color<"hwb">;
    static from(color: `lab(${string})`): Color<"lab">;
    static from(color: `lch(${string})`): Color<"lch">;
    static from(color: `oklab(${string})`): Color<"oklab">;
    static from(color: `oklch(${string})`): Color<"oklch">;
    static from(color: `color(srgb ${string})`): Color<"srgb">;
    static from(color: `color(srgb-linear ${string})`): Color<"srgb-linear">;
    static from(color: `color(display-p3 ${string})`): Color<"display-p3">;
    static from(color: `color(rec2020 ${string})`): Color<"rec2020">;
    static from(color: `color(a98-rgb ${string})`): Color<"a98-rgb">;
    static from(color: `color(prophoto-rgb ${string})`): Color<"prophoto-rgb">;
    static from(color: `color(xyz-d65 ${string})`): Color<"xyz-d65">;
    static from(color: `color(xyz-d50 ${string})`): Color<"xyz-d50">;
    static from(color: `color(xyz ${string})`): Color<"xyz">;
    static from<T extends ColorModel = ColorModel>(color: `color-mix(in ${T}, ${string})`): Color<T>;
    static from(color: `color-mix(${string})`): Color<"oklab">;
    static from(color: `contrast-color(${string})`): Color<"rgb">;
    static from(color: string): Color<any>;
    static from<T extends ColorModel = ColorModel>(color: string): Color<T>;
    static from<T extends ColorModel = ColorModel>(color: NamedColor | (string & {})): Color<T | any> {
        /* eslint-enable no-unused-vars, @typescript-eslint/no-explicit-any */
        const { model, coords } = parse(color);
        return new Color(model as T, coords);
    }

    /**
     * Validates a color string.
     *
     * @param color - Color string to check.
     * @param options - Validation options.
     * @returns `true` if valid, otherwise `false`.
     */
    static isValid(color: string, options: IsValidOptions = {}): boolean {
        return isValid(color, options);
    }

    /**
     * Retrieves a list of registered items for the requested getter key.
     *
     * @template T - The getter category to query.
     * @param type - The getter name.
     * @returns The array produced by the selected getter.
     */
    static get<T extends Getter>(type: T): ReturnType<(typeof getters)[T]> {
        return get(type);
    }

    /**
     * Generates a random `Color` instance.
     *
     * @template M - The color model type.
     * @param options - Random generation options.
     * @returns A new random `Color` instance.
     * @throws If an invalid component is specified.
     */
    static random<M extends ColorModel = ColorModel>(options: RandomOptions<M> = {}): Color<M> {
        const { model, coords } = random<M>(options);
        return new Color(model as M, coords);
    }

    /**
     * Statically mixes multiple colors together by specified percentages.
     * Replicates the behavior of the CSS `color-mix()` function.
     *
     * @param colors - Array of MixItems containing colors and optional percentages.
     * @param options - Options containing the interpolation space and hue policy.
     * @returns A new `Color` instance representing the mixed color.
     */
    static mix<M extends ColorModel = "oklab">(colors: MixItem[], options: MixOptions<M>): Color<M> {
        const { in: model = "oklab" as M } = options;
        const coords = mixColors(colors, options);
        return new Color(model, coords);
    }

    /**
     * Returns a function that interpolates across an array of colors.
     *
     * @param colors - An array of colors or color strings to interpolate between.
     * @param options - Interpolation options (e.g., color space and hue interpolation).
     * @returns A function accepting a progress value `t` (0 to 1) that returns the interpolated `Color`.
     */
    static interpolate<M extends ColorModel = "oklab">(
        colors: Color[],
        options: MixOptions<M> = {}
        // eslint-disable-next-line no-unused-vars
    ): (t: number) => Color<M> {
        if (colors.length < 2) throw new Error("Color.interpolate requires at least two colors.");
        const { in: model = "oklab" as M, hue = "shorter" } = options;
        const int = interpolate(colors, { in: model, hue });

        return (t: number) => {
            const coords = int(t);
            return new Color(model, coords);
        };
    }

    /**
     * Generates an array of colors (a palette) by interpolating evenly across the provided colors.
     *
     * @param colors - An array of colors or color strings to build the scale from.
     * @param options - Options including the number of `steps` and interpolation space.
     * @returns An array of distinct `Color` instances.
     */
    static scale<M extends ColorModel = "oklab">(colors: Color[], options: ScaleOptions<M> = {}): Color<M>[] {
        const arr = scale(colors, options);
        return arr.map((coords) => new Color(options.in as M, coords));
    }

    /**
     * Calculates the WCAG 2.1 contrast ratio between two colors.
     *
     * @param colorA - The first Color instance.
     * @param colorB - The second Color instance.
     * @returns Contrast ratio from 1 to 21.
     *
     * @remarks
     * - Ratios ≥ 4.5 are generally accessible for normal text.
     * - For perceptual accuracy, consider using APCA instead.
     */
    static contrast(colorA: Color, colorB: Color): number {
        return contrast(colorA, colorB);
    }

    /**
     * Calculates the CIE 1976 color difference (Delta E 76) using Euclidean distance in Lab space.
     *
     * @param colorA - The first Color instance.
     * @param colorB - The second Color instance.
     * @returns A non-negative Delta E value (0 = identical, ~1 = JND, >100 for opposite colors).
     */
    static deltaE76(colorA: Color<ColorModel>, colorB: Color<ColorModel>): number {
        return deltaE76(colorA, colorB);
    }

    /**
     * Calculates the CIE 1994 color difference (Delta E 94) addressing perceptual non-uniformities.
     *
     * @param colorA - The first Color instance.
     * @param colorB - The second Color instance.
     * @returns A non-negative Delta E value (0 = identical, ~1 = JND).
     */
    static deltaE94(colorA: Color<ColorModel>, colorB: Color<ColorModel>): number {
        return deltaE94(colorA, colorB);
    }

    /**
     * Calculates the CIEDE2000 color difference (Delta E 2000), the most accurate CIE standard.
     *
     * @param colorA - The first Color instance.
     * @param colorB - The second Color instance.
     * @returns A non-negative Delta E value (0 = identical, ~1 = JND).
     */
    static deltaE2000(colorA: Color<ColorModel>, colorB: Color<ColorModel>): number {
        return deltaE2000(colorA, colorB);
    }

    /**
     * Calculates the OKLab color difference (Delta E OK), scaled by 100 to match standard Delta E ranges.
     *
     * @param colorA - The first Color instance.
     * @param colorB - The second Color instance.
     * @returns A non-negative Delta E value (0 = identical, ~1 = JND).
     *
     * @remarks
     * This method uses the Euclidean distance in OKLAB color space, scaled to approximate a Just Noticeable Difference (JND) of ~2.
     * OKLAB's perceptual uniformity allows for a straightforward distance calculation without additional weighting.
     * The result is normalized by a factor of 100 to align with OKLAB's L range (0-1) and approximate the JND scale.
     */
    static deltaEOK(colorA: Color, colorB: Color): number {
        return deltaEOK(colorA, colorB);
    }

    /**
     * Converts this color to a specified format.
     *
     * @param type - Target output format.
     * @param options - Optional formatting options.
     * @returns The formatted color string.
     */
    to(type: string, options?: FormattingOptions): string; // eslint-disable-line no-unused-vars
    to(type: OutputType, options?: FormattingOptions): string; // eslint-disable-line no-unused-vars
    to(type: OutputType | (string & {}), options: FormattingOptions = {}): string | undefined {
        return format(this, type, options);
    }

    /**
     * Converts this color to another model or gives access to its raw values in that model.
     *
     * @template T - Target color model type.
     * @param model - Target color model.
     * @returns A new `Color` instance in the specified model.
     */
    in<T extends ColorModel = ColorModel>(model: T | (string & {})): Color<T> {
        const newCoords = convert(this, model);
        return new Color(model as T, newCoords);
    }

    /**
     * Formats this color as a string in its current model.
     *
     * @param options - Optional formatting options.
     * @returns The formatted color string.
     */
    toString(options: FormattingOptions = {}): string {
        return format(this, this.model, options) as string;
    }

    /**
     * Returns the color as an object of component values.
     *
     * @param options - Optional retrieval options.
     * @returns An object mapping each component to its numeric value.
     * @throws If the model has no defined components.
     */
    // eslint-disable-next-line no-unused-vars
    toObject(options: ComponentOptions = {}): { [key in Component<M>]: number } {
        return toObject(this, options);
    }

    /**
     * Returns the color as an array of component values, optionally normalized and fitted.
     *
     * @param options - Conversion configuration.
     * @returns An array of normalized color components.
     * @throws If the model has no defined components.
     */
    toArray(options: ComponentOptions = {}): number[] {
        return toArray(this, options);
    }

    /**
     * Creates a new Color instance with modified component values.
     *
     * This method supports several flexible update styles:
     *
     * ### 1. Direct component update (object)
     * Update one or more components directly by providing a partial object.
     * ```typescript
     * color.with({ l: 50 })
     * color.with({ r: 128, g: 64 })
     * ```
     *
     * ### 2. Functional component update (object with updater functions)
     * You can use updater functions to modify existing component values dynamically.
     * ```typescript
     * color.with({ r: r => r * 2 })
     * ```
     *
     * ### 3. Functional bulk update (function returning object)
     * Pass a function that receives all current components and returns updated ones.
     * ```typescript
     * color.with(({ r, g, b }) => ({
     *   r: r * 0.393 + g * 0.769 + b * 0.189,
     *   g: r * 0.349 + g * 0.686 + b * 0.168,
     *   b: r * 0.272 + g * 0.534 + b * 0.131,
     * }));
     * ```
     *
     * ### 4. Direct coordinate array replacement
     * Replace all component coordinates directly via an array.
     * ```typescript
     * color.with([0.5, 0.6, 0.7, 1]);
     * ```
     *
     * ### 5. Functional coordinate update (function returning array)
     * The updater function can also return a new coordinate array.
     * ```typescript
     * color.with(({ r, g, b }) => [r * 0.5, g * 0.5, b * 0.5, 1]);
     * ```
     *
     * @template M - The color model type
     * @param values - The new component values to apply. Can be:
     *   - A partial object mapping component names to numbers or update functions
     *   - A function that receives current components and returns partial updates or an array of values
     *   - An array of new values corresponding to component indices
     * @param normalized - Whether to normalize component values to their valid ranges. Defaults to `true`.
     *   When `false`, values are not clamped or validated against their ranges.
     * @returns A new Color instance with the updated component values
     */
    with(values: ColorUpdateValues<M>): Color<M> {
        const nextCoords = updateColor(this, values);
        return new Color(this.model, nextCoords);
    }

    /**
     * Creates a new Color instance with values fitted to the color model's gamut.
     *
     * @param options - Configuration options for fitting
     * @returns A new Color instance with fitted values
     */
    fit(options: Omit<ComponentOptions, "fit"> & { method?: ComponentOptions["fit"] } = {}): Color<M> {
        const { method = config.defaults.fit, precision } = options;
        const fitted = toArray(this, { fit: method, precision });
        return new Color(this.model, fitted);
    }

    /**
     * Fits this color within the specified gamut using a given method.
     *
     * @param gamut - Target color space.
     * @param method - Fitting method (default to `config.defaults.fit` value).
     * @returns A new `Color` instance fitted to the gamut.
     * @throws If the gamut is unsupported.
     */
    within(gamut: ColorSpace, options: ToGamutOptions = {}): Color<M> {
        const { model, coords } = this;
        const fitted = toGamut({ model, coords }, gamut, options);
        return new Color(model, fitted);
    }

    /**
     * Determines whether this color lies within a given gamut.
     *
     * @param gamut - Target color space.
     * @param options -
     * @returns `true` if inside gamut, else `false`.
     */
    inGamut(gamut: ColorSpace | (string & {}), options: InGamutOptions = {}): boolean {
        return inGamut(this, gamut, options);
    }
}
