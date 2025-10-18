-- Políticas para que los admins puedan gestionar imágenes de cualquier usuario

-- Admins pueden subir imágenes para cualquier usuario
CREATE POLICY "Admins can upload any profile image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins pueden actualizar imágenes de cualquier usuario
CREATE POLICY "Admins can update any profile image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins pueden eliminar imágenes de cualquier usuario
CREATE POLICY "Admins can delete any profile image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' AND
  has_role(auth.uid(), 'admin'::app_role)
);