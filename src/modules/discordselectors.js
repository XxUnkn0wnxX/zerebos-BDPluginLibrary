import DiscordClassModules from "./discordclassmodules";
import DOMTools from "./domtools";

const getSelectorAll = function(prop) {
    if (!this.hasOwnProperty(prop)) return "";
    if (typeof this[prop] !== "string") return this[prop];
    return `.${this[prop].split(" ").join(".")}`;
};

const getSelector = function(prop) {
    if (!this.hasOwnProperty(prop)) return "";
    if (typeof this[prop] !== "string") return this[prop];
    return `.${this[prop].split(" ")[0]}`;
};

/**
 * Gives us a way to retrieve the internal classes as selectors without
 * needing to concatenate strings or use string templates. Wraps the
 * selector in {@link module:DOMTools.Selector} which adds features but can 
 * still be used in native function.
 * 
 * For a list of all available class namespaces check out {@link module:DiscordClassModules}.
 * 
 * @see module:DiscordClassModules
 * @module DiscordSelectors
 */
const DiscordSelectors = new Proxy(DiscordClassModules, {
    get: function(list, item) {
        if (item == "getSelectorAll" || item == "getSelector") return (module, prop) => DiscordSelectors[module][item]([prop]);
        if (list[item] === undefined) return new Proxy({}, {get: function() {return "";}});
        const source = list[item];
        return new Proxy({}, {
            get: function(_, prop) {
                if (prop == "getSelectorAll") return getSelectorAll.bind(source);
                if (prop == "getSelector") return getSelector.bind(source);
                if (!source || !Object.prototype.hasOwnProperty.call(source, prop)) return "";
                if (typeof source[prop] !== "string") return source[prop];
                return new DOMTools.Selector(source[prop]);
            },
            ownKeys: function() {
                return source ? Reflect.ownKeys(source) : [];
            },
            getOwnPropertyDescriptor: function(_, prop) {
                if (!source || !Object.prototype.hasOwnProperty.call(source, prop)) return undefined;
                return {
                    configurable: true,
                    enumerable: true
                };
            }
        });
    }
});

export default DiscordSelectors;
