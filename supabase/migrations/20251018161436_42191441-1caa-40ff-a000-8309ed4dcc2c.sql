-- Crear bucket para imágenes de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
);

-- Política para que los usuarios puedan ver todas las imágenes (bucket público)
CREATE POLICY "Profile images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- Política para que los usuarios puedan subir su propia imagen
CREATE POLICY "Users can upload their own profile image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para que los usuarios puedan actualizar su propia imagen
CREATE POLICY "Users can update their own profile image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para que los usuarios puedan eliminar su propia imagen
CREATE POLICY "Users can delete their own profile image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);