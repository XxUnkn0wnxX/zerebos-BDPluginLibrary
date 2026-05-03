const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const pkg = require("./package.json");
const pluginConfig = require("./src/config");
const buildMeta = require("./lib/meta");
const installScript = require("./lib/installscript");
const buildConfig = pkg.zplConfig;
pluginConfig.version = pkg.version;

const banner = buildMeta(pluginConfig) + "\n" + installScript;
const exportNormalization = `
if (module.exports && module.exports.ZeresPluginLibrary) {
  module.exports = module.exports.ZeresPluginLibrary;
}
else if (module.exports && module.exports.default) {
  module.exports = module.exports.default;
}`;

function getBetterDiscordFolder() {
  if (process.platform === "win32") return path.join(process.env.APPDATA, "BetterDiscord");

  if (process.platform === "darwin") {
    const candidates = [
      path.join(process.env.HOME, "Library", "Application Support", "BetterDiscord"),
      path.join(process.env.HOME, "Library", "Preferences", "BetterDiscord")
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }

    return candidates[0];
  }

  return path.join(process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(process.env.HOME, ".config"), "BetterDiscord");
}

module.exports = {
  mode: "development",
  target: "node",
  devtool: false,
  entry: "./src/index.js",
  output: {
    filename: "0PluginLibrary.plugin.js",
    path: path.resolve(__dirname, "release"),
    library: "ZeresPluginLibrary",
    libraryTarget: "commonjs2",
    libraryExport: "default",
    compareBeforeEmit: false
  },
  externals: {
    electron: `window.require("electron")`,
    fs: `window.require("fs")`,
    path: `window.require("path")`,
    request: `window.require("request")`
  },
  resolve: {
    extensions: [".js"],
    modules: [
      path.resolve("src", "modules"),
      path.resolve("src", "structs"),
      path.resolve("src", "ui")
    ]
  },
  module: {
    rules: [{test: /\.css$/, use: "raw-loader"}]
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new webpack.DefinePlugin({"process.env": {__LIBRARY_VERSION__: JSON.stringify(pkg.version)}}),
    new webpack.BannerPlugin({raw: true, banner: banner}),
    new webpack.BannerPlugin({raw: true, banner: exportNormalization, footer: true}),
    new webpack.BannerPlugin({raw: true, banner: `/*@end@*/`, footer: true}),
    {
      apply: (compiler) => {
        compiler.hooks.assetEmitted.tap("CopyToBD", (filename, info) => {
          /* eslint-disable no-console */
          if (!buildConfig.copyToBD) return;

          const bdFolder = getBetterDiscordFolder();
          fs.mkdirSync(path.join(bdFolder, "plugins"), {recursive: true});
          fs.copyFileSync(info.targetPath, path.join(bdFolder, "plugins", filename));
          console.log(`\n\n✅ Copied to BD folder\n`);
        });
      }
    },
    
  ]
};
