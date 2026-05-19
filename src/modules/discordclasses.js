import DiscordClassModules from "./discordclassmodules";
import DOMTools from "./domtools";

const getRaw = function(prop) {
    if (!this.hasOwnProperty(prop)) return "";
    return this[prop];
};

const getClass = function(prop) {
    if (!this.hasOwnProperty(prop)) return "";
    if (typeof this[prop] !== "string") return this[prop];
    return this[prop].split(" ")[0];
};

/**
 * Proxy for all the class packages, allows us to safely attempt
 * to retrieve nested things without error. Also wraps the class in
 * {@link module:DOMTools.ClassName} which adds features but can still
 * be used in native function.
 * 
 * For a list of all available class namespaces check out {@link module:DiscordClassModules}.
 * 
 * @see module:DiscordClassModules
 * @module DiscordClasses
 */
const DiscordModules = new Proxy(DiscordClassModules, {
    get: function(list, item) {
        if (item == "getRaw" || item == "getClass") return (module, prop) => DiscordModules[module][item]([prop]);
        if (list[item] === undefined) return new Proxy({}, {get: function() {return "";}});
        const source = list[item];
        return new Proxy({}, {
            get: function(_, prop) {
                if (prop == "getRaw") return getRaw.bind(source);
                if (prop == "getClass") return getClass.bind(source);
                if (!source || !Object.prototype.hasOwnProperty.call(source, prop)) return "";
                if (typeof source[prop] !== "string") return source[prop];
                return new DOMTools.ClassName(source[prop]);
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
export default DiscordModules;
