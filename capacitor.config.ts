import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.voxroyale.socialclub",
  appName: "VOX ROYALE",
  webDir: ".output/public",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
};

export default config;
