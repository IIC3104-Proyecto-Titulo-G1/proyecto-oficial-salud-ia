import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Upload, User, X, BarChart3, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/ImageCropper';
import { MedicoStatsDashboard } from '@/components/MedicoStatsDashboard';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'medico' | 'medico_jefe';
  hospital?: string;
  especialidad?: string;
  imagen?: string;
}

export default function AdminEditUser() {
  const { userId } = useParams<{ userId: string }>();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    rol: 'medico' as 'admin' | 'medico' | 'medico_jefe',
    hospital: '',
    especialidad: '',
    telefono: '',
    genero: 'masculino',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleteImage, setDeleteImage] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userRole !== 'admin') {
      toast({
        title: 'Acceso denegado',
        description: 'No tiene permisos para acceder a esta sección',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }
    if (userId) {
      loadUsuario();
    }
  }, [userId, userRole, navigate, toast]);

  const loadUsuario = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      setUsuario({
        id: data.user_id,
        nombre: data.nombre,
        email: data.email,
        rol: data.role,
        hospital: data.hospital,
        especialidad: data.especialidad,
        imagen: data.imagen,
      });

      setFormData({
        nombre: data.nombre,
        email: data.email,
        rol: data.role,
        hospital: data.hospital || '',
        especialidad: data.especialidad || '',
        telefono: data.telefono || '',
        genero: data.genero || 'masculino',
      });

      if (data.imagen) {
        setImagePreview(data.imagen);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el usuario',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const validationErrors: Record<string, string> = {};

    // Validar nombre
    const nombre = formData.nombre.trim();
    if (!nombre) {
      validationErrors.nombre = 'El nombre es obligatorio.';
    } else if (nombre.length < 3) {
      validationErrors.nombre = 'El nombre debe tener al menos 3 caracteres.';
    }

    // Validar email
    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      validationErrors.email = 'El email es obligatorio.';
    } else if (!emailRegex.test(email)) {
      validationErrors.email = 'Ingresa un correo electrónico válido.';
    }

    // Validar hospital (opcional pero si se ingresa debe tener al menos 3 caracteres)
    const hospital = formData.hospital.trim();
    if (hospital && hospital.length < 3) {
      validationErrors.hospital = 'El nombre del hospital debe tener al menos 3 caracteres.';
    }

    // Validar especialidad (opcional pero si se ingresa debe tener al menos 3 caracteres)
    const especialidad = formData.especialidad.trim();
    if (especialidad && especialidad.length < 3) {
      validationErrors.especialidad = 'La especialidad debe tener al menos 3 caracteres.';
    }

    // Validar teléfono (opcional pero si se ingresa debe tener formato chileno)
    const telefono = formData.telefono.trim();
    if (telefono) {
      const telefonoRegex = /^(\+?56)?9?\d{8}$/;
      if (!telefonoRegex.test(telefono.replace(/\s|-/g, ''))) {
        validationErrors.telefono = 'Ingresa un teléfono válido de Chile (ej: +56912345678).';
      }
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen no puede pesar más de 5MB",
        variant: "destructive",
      });
      return;
    }
    setImageFile(file);
    setDeleteImage(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    } else {
      toast({
        title: "Error",
        description: "Por favor sube solo archivos de imagen",
        variant: "destructive",
      });
    }
  };

  const handleDeleteImage = () => {
    setImageFile(null);
    setImagePreview("");
    setDeleteImage(true);
  };

  const handleAvatarDoubleClick = () => {
    if (imagePreview) {
      if (imagePreview.startsWith('data:image')) {
        setImageToCrop(imagePreview);
      } else {
        fetch(imagePreview)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              setImageToCrop(reader.result as string);
            };
            reader.readAsDataURL(blob);
          })
          .catch(error => {
            toast({
              title: 'Error',
              description: 'No se pudo cargar la imagen para editar',
              variant: 'destructive',
            });
          });
      }
      setShowCropper(true);
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    fetch(croppedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'profile.png', { type: 'image/png' });
        setImageFile(file);
        setImagePreview(croppedImage);
        setDeleteImage(false);
        toast({
          title: 'Imagen recortada',
          description: 'La imagen se actualizará al guardar los cambios',
        });
      })
      .catch(error => {
        toast({
          title: 'Error',
          description: 'No se pudo procesar la imagen recortada',
          variant: 'destructive',
        });
      });
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor corrige los errores en el formulario',
        variant: 'destructive',
      });
      return;
    }

    if (!userId) return;

    setSaving(true);
    try {
      let imageUrl = usuario?.imagen || null;

      // Eliminar imagen si el usuario lo solicitó
      if (deleteImage && usuario?.imagen) {
        const filePath = `${userId}/profile.${usuario.imagen.split('.').pop()}`;
        await supabase.storage
          .from('profile-images')
          .remove([filePath]);
        imageUrl = null;
      }

      // Subir imagen si hay una nueva
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const timestamp = Date.now();
        const filePath = `${userId}/profile_${timestamp}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(filePath, imageFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
        
        // Limpiar imagen anterior si existe
        if (usuario?.imagen && usuario.imagen !== publicUrl) {
          try {
            const oldFilePath = usuario.imagen.split('/profile-images/')[1];
            if (oldFilePath) {
              await supabase.storage
                .from('profile-images')
                .remove([oldFilePath]);
            }
          } catch (cleanupError) {
            // Error no crítico, continuar
          }
        }
      }

      // Actualizar email en auth si cambió
      if (formData.email !== usuario.email) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No hay sesión activa');

        const response = await fetch(
          `https://kbveluprkmphtuxfvpha.supabase.co/functions/v1/update-user-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              userId: userId,
              newEmail: formData.email 
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al actualizar email');
        }
      }

      // Actualizar datos del usuario
      const { error } = await supabase
        .from('user_roles')
        .update({
          nombre: formData.nombre,
          email: formData.email,
          hospital: formData.hospital || null,
          especialidad: formData.especialidad || null,
          telefono: formData.telefono || null,
          genero: formData.genero,
          role: formData.rol,
          imagen: imageUrl,
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Usuario actualizado',
        description: 'Los cambios se han guardado exitosamente',
      });

      navigate('/admin');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">Cargando usuario...</p>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Usuario no encontrado</p>
            <Button onClick={() => navigate('/admin')} className="mt-4">
              Volver a Administración
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin')}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Editar Usuario</h1>
                <p className="text-sm text-white/80">Modificar datos del usuario</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Tabs defaultValue="informacion" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="informacion" className="gap-2">
                <UserCircle className="w-4 h-4" />
                Información
              </TabsTrigger>
              <TabsTrigger value="estadisticas" className="gap-2" disabled={usuario.rol === 'admin'}>
                <BarChart3 className="w-4 h-4" />
                Estadísticas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="informacion" className="space-y-6">
          {/* Información Personal con Imagen */}
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza los datos del usuario y su imagen de perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Avatar Section */}
                <div className="lg:col-span-1 flex flex-col items-center">
                  <div className="relative mb-4">
                    <Avatar 
                      className="h-32 w-32 cursor-pointer hover:opacity-80 transition-opacity"
                      onDoubleClick={handleAvatarDoubleClick}
                    >
                      <AvatarImage src={imagePreview} alt={formData.nombre} />
                      <AvatarFallback className="text-2xl">
                        {formData.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || <User />}
                      </AvatarFallback>
                    </Avatar>
                    {imagePreview && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                        onClick={handleDeleteImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {imagePreview && (
                    <p className="text-xs text-muted-foreground mb-2 text-center">
                      Haz doble clic en la foto para ajustarla
                    </p>
                  )}
                  <div className="w-full">
                    <Label htmlFor="user-image" className="cursor-pointer">
                      <div 
                        className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg transition-colors ${
                          isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-sm text-center">Arrastra una imagen o haz clic para seleccionar</span>
                      </div>
                      <Input
                        id="user-image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </Label>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre Completo *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => handleFormChange('nombre', e.target.value)}
                        placeholder="Ej: Juan Pérez González"
                        className={errors.nombre ? 'border-destructive' : ''}
                      />
                      {errors.nombre && (
                        <p className="text-sm text-destructive">{errors.nombre}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                        placeholder="Ej: juan.perez@hospital.cl"
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hospital">Hospital</Label>
                      <Input
                        id="hospital"
                        value={formData.hospital}
                        onChange={(e) => handleFormChange('hospital', e.target.value)}
                        placeholder="Ej: Hospital Clínico Universidad de Chile"
                        className={errors.hospital ? 'border-destructive' : ''}
                      />
                      {errors.hospital && (
                        <p className="text-sm text-destructive">{errors.hospital}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="especialidad">Especialidad</Label>
                      <Input
                        id="especialidad"
                        value={formData.especialidad}
                        onChange={(e) => handleFormChange('especialidad', e.target.value)}
                        placeholder="Ej: Cardiología"
                        className={errors.especialidad ? 'border-destructive' : ''}
                      />
                      {errors.especialidad && (
                        <p className="text-sm text-destructive">{errors.especialidad}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono</Label>
                      <Input
                        id="telefono"
                        value={formData.telefono}
                        onChange={(e) => handleFormChange('telefono', e.target.value)}
                        placeholder="Ej: +56912345678"
                        className={errors.telefono ? 'border-destructive' : ''}
                      />
                      {errors.telefono && (
                        <p className="text-sm text-destructive">{errors.telefono}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genero">Género *</Label>
                      <Select
                        value={formData.genero}
                        onValueChange={(value) => handleFormChange('genero', value)}
                      >
                        <SelectTrigger id="genero">
                          <SelectValue placeholder="Selecciona el género" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="femenino">Femenino</SelectItem>
                          <SelectItem value="prefiero_no_responder">Prefiero no responder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rol">Rol *</Label>
                    <Select
                      value={formData.rol}
                      onValueChange={(value: any) => handleFormChange('rol', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="medico">Médico</SelectItem>
                        <SelectItem value="medico_jefe">Médico Jefe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin')}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
            </TabsContent>

            <TabsContent value="estadisticas" className="space-y-6">
              {usuario.rol !== 'admin' ? (
                <MedicoStatsDashboard 
                  medicoId={usuario.id} 
                  medicoRol={usuario.rol}
                  medicoNombre={usuario.nombre}
                  medicoImagen={usuario.imagen}
                />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">
                      Las estadísticas solo están disponibles para médicos y médicos jefe.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Editor de imagen con recorte circular */}
      <ImageCropper
        image={imageToCrop}
        open={showCropper}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}

