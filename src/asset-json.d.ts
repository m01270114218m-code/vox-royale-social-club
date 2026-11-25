declare module "*.asset.json" {
  const asset: { url: string; content_type: string; original_filename: string };
  export default asset;
}
