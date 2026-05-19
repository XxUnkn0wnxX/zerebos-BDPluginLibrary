const config = "";
class Dummy {
    constructor() {this._config = config;}
    start() {}
    stop() {}
}
 
if (!global.ZeresPluginLibrary) {
    BdApi.UI.showConfirmationModal("Library Missing", `The library plugin needed for ${config.name ?? config.info.name} is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: async () => {
            try {
                const fetchMethod = BdApi?.Net?.fetch?.bind(BdApi.Net) ?? fetch;
                const response = await fetchMethod("https://betterdiscord.app/gh-redirect?id=9", {timeout: 10000});
                if (!response?.ok) throw new Error(`Unexpected status ${response?.status ?? "unknown"}`);
                const content = await response.text();
                await new Promise((resolve, reject) => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, error => error ? reject(error) : resolve()));
            }
            catch {
                require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
            }
        }
    });
}
 
module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
     const plugin = "";
     return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
