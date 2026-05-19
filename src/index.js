import * as Modules from "modules";
import {PluginUpdater, Patcher, Logger, DOMTools} from "modules";
import {Settings, Tooltip, Toasts, Popouts, Modals, DiscordContextMenu, ErrorBoundary} from "ui";
import BasePlugin, {wrapPluginBase} from "./structs/plugin";
const LibraryConfig = require("./config"); // Use cjs require to prevent polyfill

const Library = {};
Library.DCM = DiscordContextMenu;
Library.ContextMenu = DiscordContextMenu;
Library.Tooltip = Tooltip;
Library.Toasts = Toasts;
Library.Settings = Settings;
Library.Popouts = Popouts;
Library.Modals = Modals;
for (const mod in Modules) Library[mod] = Modules[mod];

Library.Components = {ErrorBoundary};

const createLookupWarnOnce = (pluginName) => {
    const warned = new Set();
    return (path, type) => {
        const key = `${type}:${path}`;
        if (warned.has(key)) return;
        warned.add(key);
        Logger.warn("ZeresPluginLibrary", `Plugin "${pluginName}" requested unresolved ${type} "${path}". This usually means the plugin is using an outdated ZLib alias or class path.`);
    };
};

const shouldIgnoreLookupProperty = (prop) => {
    if (typeof prop === "symbol") return true;
    return prop === "toJSON"
        || prop === "toString"
        || prop === "valueOf"
        || prop === "inspect"
        || prop === "constructor"
        || prop === "prototype"
        || prop === "__proto__"
        || prop === "hasOwnProperty"
        || prop === "then";
};

const createGlobalLookupWarnOnce = () => {
    const warned = new Set();
    return (path, type) => {
        const key = `${type}:${path}`;
        if (warned.has(key)) return;
        warned.add(key);
        Logger.warn("ZeresPluginLibrary", `Global ZLibrary access requested unresolved ${type} "${path}". This usually means an older plugin is using an outdated ZLib export, alias, or class path.`);
    };
};

const createBoundDiscordModules = (source, warnMissing) => new Proxy(source, {
    get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof prop === "string" && !shouldIgnoreLookupProperty(prop)) {
            if (!Object.prototype.hasOwnProperty.call(target, prop)) warnMissing(`DiscordModules.${prop}`, "module alias");
            else if (value == null) warnMissing(`DiscordModules.${prop}`, "module alias");
        }
        return value;
    }
});

const createEmptyDiscordClassProxy = (moduleName, type, warnMissing) => new Proxy({}, {
    get(_, prop) {
        if (prop == "getRaw" || prop == "getClass" || prop == "getSelector" || prop == "getSelectorAll") return () => "";
        if (typeof prop === "string" && !shouldIgnoreLookupProperty(prop)) warnMissing(`${type}.${moduleName}.${prop}`, "class alias");
        return "";
    }
});

const createBoundDiscordClassModules = (source, warnMissing) => new Proxy(source, {
    get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof prop === "string" && !shouldIgnoreLookupProperty(prop)) {
            if (!Object.prototype.hasOwnProperty.call(target, prop)) warnMissing(`DiscordClassModules.${prop}`, "class module");
            else if (value == null) warnMissing(`DiscordClassModules.${prop}`, "class module");
        }
        return value;
    }
});

const getRawClass = function(prop) {
    if (!Object.prototype.hasOwnProperty.call(this, prop)) return "";
    return this[prop];
};

const getSingleClass = function(prop) {
    if (!Object.prototype.hasOwnProperty.call(this, prop)) return "";
    if (typeof this[prop] !== "string") return this[prop];
    return this[prop].split(" ")[0];
};

const getSelectorAll = function(prop) {
    if (!Object.prototype.hasOwnProperty.call(this, prop)) return "";
    if (typeof this[prop] !== "string") return this[prop];
    return `.${this[prop].split(" ").join(".")}`;
};

const getSelector = function(prop) {
    if (!Object.prototype.hasOwnProperty.call(this, prop)) return "";
    if (typeof this[prop] !== "string") return this[prop];
    return `.${this[prop].split(" ")[0]}`;
};

const createBoundDiscordClasses = (classModules, warnMissing) => new Proxy(classModules, {
    get(target, moduleName, receiver) {
        if (moduleName == "getRaw" || moduleName == "getClass") return (module, prop) => {
            const namespace = receiver[module];
            return namespace[moduleName](prop);
        };

        const source = Reflect.get(target, moduleName, receiver);
        if (typeof moduleName !== "string") return source;
        if (!source || typeof source !== "object") {
            warnMissing(`DiscordClasses.${moduleName}`, "class module");
            return createEmptyDiscordClassProxy(moduleName, "DiscordClasses", warnMissing);
        }

        return new Proxy({}, {
            get(_, prop) {
                if (prop == "getRaw") return getRawClass.bind(source);
                if (prop == "getClass") return getSingleClass.bind(source);
                if (!Object.prototype.hasOwnProperty.call(source, prop) || source[prop] == null || source[prop] === "") {
                    if (typeof prop === "string" && !shouldIgnoreLookupProperty(prop)) warnMissing(`DiscordClasses.${moduleName}.${prop}`, "class alias");
                    return "";
                }
                if (typeof source[prop] !== "string") return source[prop];
                return new DOMTools.ClassName(source[prop]);
            },
            ownKeys() {
                return Reflect.ownKeys(source);
            },
            getOwnPropertyDescriptor(_, prop) {
                if (!Object.prototype.hasOwnProperty.call(source, prop)) return undefined;
                return {configurable: true, enumerable: true};
            }
        });
    }
});

const createBoundDiscordSelectors = (classModules, warnMissing) => new Proxy(classModules, {
    get(target, moduleName, receiver) {
        if (moduleName == "getSelectorAll" || moduleName == "getSelector") return (module, prop) => {
            const namespace = receiver[module];
            return namespace[moduleName](prop);
        };

        const source = Reflect.get(target, moduleName, receiver);
        if (typeof moduleName !== "string") return source;
        if (!source || typeof source !== "object") {
            warnMissing(`DiscordSelectors.${moduleName}`, "class module");
            return createEmptyDiscordClassProxy(moduleName, "DiscordSelectors", warnMissing);
        }

        return new Proxy({}, {
            get(_, prop) {
                if (prop == "getSelectorAll") return getSelectorAll.bind(source);
                if (prop == "getSelector") return getSelector.bind(source);
                if (!Object.prototype.hasOwnProperty.call(source, prop) || source[prop] == null || source[prop] === "") {
                    if (typeof prop === "string" && !shouldIgnoreLookupProperty(prop)) warnMissing(`DiscordSelectors.${moduleName}.${prop}`, "class alias");
                    return "";
                }
                if (typeof source[prop] !== "string") return source[prop];
                return new DOMTools.Selector(source[prop]);
            },
            ownKeys() {
                return Reflect.ownKeys(source);
            },
            getOwnPropertyDescriptor(_, prop) {
                if (!Object.prototype.hasOwnProperty.call(source, prop)) return undefined;
                return {configurable: true, enumerable: true};
            }
        });
    }
});

const createGlobalLibrary = (source) => {
    const warnMissing = createGlobalLookupWarnOnce();
    const wrappedModules = createBoundDiscordModules(source.DiscordModules, warnMissing);
    const wrappedClassModules = createBoundDiscordClassModules(source.DiscordClassModules, warnMissing);
    const wrappedClasses = createBoundDiscordClasses(source.DiscordClassModules, warnMissing);
    const wrappedSelectors = createBoundDiscordSelectors(source.DiscordClassModules, warnMissing);

    return new Proxy(source, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (typeof prop === "string" && !shouldIgnoreLookupProperty(prop)) {
                if (!Object.prototype.hasOwnProperty.call(target, prop)) warnMissing(`ZLibrary.${prop}`, "library export");
                else if (value == null) warnMissing(`ZLibrary.${prop}`, "library export");
            }

            if (prop === "DiscordModules") return wrappedModules;
            if (prop === "DiscordClassModules") return wrappedClassModules;
            if (prop === "DiscordClasses") return wrappedClasses;
            if (prop === "DiscordSelectors") return wrappedSelectors;
            return value;
        }
    });
};

// export default LibraryPlugin(Library.Structs.Plugin, Library); // eslint-disable-line new-cap

class PluginLibrary extends BasePlugin {
    get Library() {return Library;}

    constructor() {
        super(LibraryConfig);

        const wasLibLoaded = !!document.getElementById("ZLibraryCSS");
        const isBDLoading = document.getElementById("bd-loading-icon");
        DOMTools.removeStyle("ZLibraryCSS");
        DOMTools.addStyle("ZLibraryCSS", Settings.CSS + Toasts.CSS + PluginUpdater.CSS);
        Popouts.initialize();

        /**
         * Checking if this is the library first being loaded during init
         * This means that subsequent loads will cause dependents to reload
         * This also means first load when installing for the first time
         * will automatically reload the dependent plugins. This is needed
         * for those plugins that prompt to download and install the lib.
         */

        if (!wasLibLoaded && isBDLoading) return; // If the this is the lib's first load AND this is BD's initialization

        /**
         * Now we can go ahead and reload any dependent plugins by checking
         * for any with instance._config. Both plugins using buildPlugin()
         * and plugin skeletons that prompt for download should have this
         * instance property.
         */

        // Older BetterDiscord builds exposed settings toggles on BdApi directly.
        // Newer builds removed those methods, so fail soft and just reload plugins.
        const canToggleToasts = typeof BdApi?.isSettingEnabled === "function"
            && typeof BdApi?.disableSetting === "function"
            && typeof BdApi?.enableSetting === "function";
        const wasEnabled = canToggleToasts ? BdApi.isSettingEnabled("settings", "general", "showToasts") : false;
        try {
            if (wasEnabled) BdApi.disableSetting("settings", "general", "showToasts");
            this._reloadPlugins();
        }
        finally {
            if (wasEnabled) BdApi.enableSetting("settings", "general", "showToasts");
        }
    }

    _reloadPlugins() {
        const list = BdApi.Plugins.getAll().reduce((acc, val) => {
            if (!val.instance || !val.instance._config) return acc;
            const name = val.id || val.instance?.getName();
            if (name === "ZeresPluginLibrary") return acc;
            acc.push(name);
            return acc;
        }, []);
        for (let p = 0; p < list.length; p++) BdApi.Plugins.reload(list[p]);
    }

    static bindLibrary(name) {
        const warnMissing = createLookupWarnOnce(name);
        const BoundAPI = {
            Logger: {
                stacktrace: (message, error) => Logger.stacktrace(name, message, error),
                log: (...message) => Logger.log(name, ...message),
                error: (...message) => Logger.err(name, ...message),
                err: (...message) => Logger.err(name, ...message),
                warn: (...message) => Logger.warn(name, ...message),
                info: (...message) => Logger.info(name, ...message),
                debug: (...message) => Logger.debug(name, ...message)
            },
            Patcher: {
                getPatchesByCaller: () => {return Patcher.getPatchesByCaller(name);},
                unpatchAll: () => {return Patcher.unpatchAll(name);},
                before: (moduleToPatch, functionName, callback, options = {}) => {return Patcher.before(name, moduleToPatch, functionName, callback, options);},
                instead: (moduleToPatch, functionName, callback, options = {}) => {return Patcher.instead(name, moduleToPatch, functionName, callback, options);},
                after: (moduleToPatch, functionName, callback, options = {}) => {return Patcher.after(name, moduleToPatch, functionName, callback, options);}
            }
        };
        const BoundLib = Object.assign({}, Library);
        BoundLib.Logger = BoundAPI.Logger;
        BoundLib.Patcher = BoundAPI.Patcher;
        BoundLib.DiscordModules = createBoundDiscordModules(Library.DiscordModules, warnMissing);
        BoundLib.DiscordClassModules = createBoundDiscordClassModules(Library.DiscordClassModules, warnMissing);
        BoundLib.DiscordClasses = createBoundDiscordClasses(Library.DiscordClassModules, warnMissing);
        BoundLib.DiscordSelectors = createBoundDiscordSelectors(Library.DiscordClassModules, warnMissing);
        return BoundLib;
    }

    static buildPlugin(config) {
        return [wrapPluginBase(config), this.bindLibrary(config.name ?? config.info.name)]; // eslint-disable-line new-cap
    }
}

Object.assign(PluginLibrary, Library);
Library.bindLibrary = PluginLibrary.bindLibrary;
Library.buildPlugin = PluginLibrary.buildPlugin;
window.ZLibrary = createGlobalLibrary(Library);
window.ZeresPluginLibrary = PluginLibrary;
export default PluginLibrary;
