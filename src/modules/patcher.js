import Logger from "./logger";
import DiscordModules from "./discordmodules";
import WebpackModules from "./webpackmodules";


function noop() {return () => undefined;}

function isModuleInvalid(moduleToPatch) {
    return (typeof moduleToPatch !== "object" && typeof moduleToPatch !== "function") || moduleToPatch === null;
}

function resolveModule(moduleToPatch) {
    if (!moduleToPatch) return moduleToPatch;
    if (typeof moduleToPatch === "function" || (typeof moduleToPatch === "object" && !Array.isArray(moduleToPatch))) return moduleToPatch;
    if (typeof moduleToPatch === "string") return DiscordModules[moduleToPatch] ?? WebpackModules.getByProps(moduleToPatch);
    if (Array.isArray(moduleToPatch)) return WebpackModules.getByProps(...moduleToPatch);
    return null;
}

function getDisplayName(moduleToPatch, fallbackName = "unknown target") {
    if (!moduleToPatch) return fallbackName;
    if (typeof moduleToPatch === "string") return moduleToPatch;
    if (Array.isArray(moduleToPatch)) return moduleToPatch.join(", ");
    return moduleToPatch.displayName || moduleToPatch.name || moduleToPatch.constructor?.displayName || moduleToPatch.constructor?.name || fallbackName;
}

function normalizePatchArgs(boundCaller, args) {
    if (!boundCaller) {
        const [caller, moduleToPatch, functionName, callback, options = {}] = args;
        return {caller, moduleToPatch, functionName, callback, options};
    }

    const [first, second, third, fourth, fifth = {}] = args;

    if (typeof first === "string" && typeof third === "string" && typeof fourth === "function") {
        return {
            caller: first,
            moduleToPatch: second,
            functionName: third,
            callback: fourth,
            options: fifth
        };
    }

    return {
        caller: boundCaller,
        moduleToPatch: first,
        functionName: second,
        callback: third,
        options: fourth ?? {}
    };
}

/**
 * Patcher that can patch other functions allowing you to run code before, after or
 * instead of the original function. Can also alter arguments and return values.
 *
 * This wrapper keeps ZLib-compatible behavior on top of the newer BetterDiscord
 * patcher API by tolerating stale/invalid patch targets instead of hard-throwing.
 *
 * @module Patcher
 */
export default class Patcher {

    constructor(callerName = "") {
        this.callerName = callerName;
    }

    static get patches() {return [];}

    static getPatchesByCaller(name) {
        return BdApi.Patcher.getPatchesByCaller(name);
    }

    getPatchesByCaller(name = this.callerName) {
        return Patcher.getPatchesByCaller(name);
    }

    static unpatchAll(patches) {
        BdApi.Patcher.unpatchAll(patches);
    }

    unpatchAll(patches = this.callerName) {
        Patcher.unpatchAll(patches);
    }

    static _patch(type, boundCaller, ...args) {
        const {caller, moduleToPatch, functionName, callback, options = {}} = normalizePatchArgs(boundCaller, args);
        const resolvedModule = resolveModule(moduleToPatch);
        const targetName = `${caller || "unknown caller"} -> ${getDisplayName(moduleToPatch)}.${String(functionName)}`;

        if (typeof caller !== "string") {
            Logger.warn("Patcher", `Skipping ${type} patch with invalid caller for ${targetName}`);
            return noop();
        }

        if (typeof functionName !== "string") {
            Logger.warn("Patcher", `Skipping ${type} patch with invalid function name for ${targetName}`);
            return noop();
        }

        if (typeof callback !== "function") {
            Logger.warn("Patcher", `Skipping ${type} patch with invalid callback for ${targetName}`);
            return noop();
        }

        if (isModuleInvalid(resolvedModule)) {
            Logger.warn("Patcher", `Skipping ${type} patch for ${targetName} because the module target could not be resolved.`);
            return noop();
        }

        if (typeof resolvedModule[functionName] !== "function") {
            if (options.forcePatch) {
                resolvedModule[functionName] = function() {};
            }
            else {
                Logger.warn("Patcher", `Skipping ${type} patch for ${targetName} because ${String(functionName)} is not a function.`);
                return noop();
            }
        }

        try {
            return BdApi.Patcher[type](caller, resolvedModule, functionName, callback);
        }
        catch (error) {
            Logger.stacktrace("Patcher", `Failed to apply ${type} patch for ${targetName}`, error);
            return noop();
        }
    }

    static before(...args) {return this._patch("before", "", ...args);}
    before(...args) {return Patcher._patch("before", this.callerName, ...args);}

    static after(...args) {return this._patch("after", "", ...args);}
    after(...args) {return Patcher._patch("after", this.callerName, ...args);}

    static instead(...args) {return this._patch("instead", "", ...args);}
    instead(...args) {return Patcher._patch("instead", this.callerName, ...args);}
}
