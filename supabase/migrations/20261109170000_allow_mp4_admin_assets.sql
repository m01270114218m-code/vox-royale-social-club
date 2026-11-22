-- Allow admin-uploaded MP4 assets (gift/frame/entry) in the private admin-assets bucket.
update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/gif','image/svg+xml',
  'video/mp4',
  'model/gltf-binary','model/gltf+json','application/octet-stream'
]
where id='admin-assets';
