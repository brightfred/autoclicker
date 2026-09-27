const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    // The Vite plugin normally only copies the .vite build folder into the app.
    // My native module (@jitsi/robotjs) is "external" in
    // vite.main.config.mjs, so it's not bundled — without this, the
    // installed app crashes with "Cannot find module '@jitsi/robotjs'".
    // Keeping /node_modules lets electron-packager copy my production
    // dependencies (devDependencies are still pruned out).
    // Return true = file is left out of the app, false = file is kept.
    ignore: (file) => {
      if (!file) return false;
      const keep =
        file.startsWith('/.vite') ||
        file === '/package.json' ||
        file.startsWith('/node_modules');
      return !keep;
    },
  },
  rebuildConfig: {
    // robotjs ships prebuilt N-API binaries, so nothing needs rebuilding
    onlyModules: [],
  },
  makers: [
    {
      // Windows installer (.exe) — this is the one my GitHub Action publishes
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'AlchClicker',
        setupExe: 'AlchClicker-Setup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      // Pulls the native .node binaries out of app.asar, because Electron
      // can't load a native module from inside an asar archive.
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};