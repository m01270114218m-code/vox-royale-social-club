# VOX ROYALE original artwork

This folder stores original scalable vector source artwork. SVG source files intentionally live under Android's `assets/` tree, not `res/drawable`, because Android's resource compiler does not consume raw SVG files as drawable resources.

See `asset-manifest.json` for stable IDs and intended UI placement. Before runtime use, convert the artwork to Android VectorDrawable XML or raster PNG/WebP and wire it into Compose. This is a starter batch of six assets, not the complete 1,400-asset production library.
