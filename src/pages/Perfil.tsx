import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Upload, User, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/ImageCropper";

export default function Perfil() {
  const { user, userRoleData, loading, refreshUserRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    hospital: "",
    especialidad: "",
    telefono: "",
    genero: "masculino",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleteImage, setDeleteImage] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
  
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (userRoleData) {
      setFormData({
        nombre: userRoleData.nombre || "",
        email: userRoleData.email || "",
        hospital: userRoleData.hospital || "",
        especialidad: userRoleData.especialidad || "",
        telefono: userRoleData.telefono || "",
        genero: userRoleData.genero || "masculino",
      });
      if (userRoleData.imagen) {
        setImagePreview(userRoleData.imagen);
      }
    }
  }, [userRoleData]);

  const validateForm = () => {
    const validationErrors: Record<string, string> = {};

    const nombre = formData.nombre.trim();
    if (!nombre) {
      validationErrors.nombre = "El nombre es obligatorio.";
    } else if (nombre.length < 3) {
      validationErrors.nombre = "Ingresa al menos 3 caracteres para el nombre.";
    }

    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      validationErrors.email = "Ingresa un correo electrónico válido.";
    }

    const telefono = formData.telefono.trim();
    if (telefono) {
      const telefonoRegex = /^\+?\d{8,15}$/;
      if (!telefonoRegex.test(telefono.replace(/\s|-/g, ""))) {
        validationErrors.telefono = "Ingresa solo números (opcional +) entre 8 y 15 dígitos.";
      }
    }

    return validationErrors;
  };

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
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
      // Si la imagen es un base64 (ya recortada), usarla directamente
      // Si es una URL de Supabase, cargarla primero
      if (imagePreview.startsWith('data:image')) {
        setImageToCrop(imagePreview);
      } else {
        // Es una URL de Supabase, cargar la imagen como base64
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
    // Convertir la imagen recortada a Blob y luego a File
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !userRoleData) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        title: "Revisa los datos ingresados",
        description: "Corrige los campos marcados para continuar.",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const nombreValue = formData.nombre.trim();
      const emailValue = formData.email.trim();
      const hospitalValue = formData.hospital.trim();
      const especialidadValue = formData.especialidad.trim();
      const telefonoValue = formData.telefono.trim().replace(/\s|-/g, "");

      let imageUrl = userRoleData?.imagen || null;

      // Eliminar imagen si el usuario lo solicitó
      if (deleteImage && user && userRoleData?.imagen) {
        const filePath = `${user.id}/profile.${userRoleData.imagen.split('.').pop()}`;
        await supabase.storage
          .from('profile-images')
          .remove([filePath]);
        imageUrl = null;
      }

      // Subir imagen si hay una nueva
      if (imageFile && user) {
        const fileExt = imageFile.name.split('.').pop();
        const timestamp = Date.now();
        // Agregar timestamp para forzar una nueva URL y evitar caché
        const filePath = `${user.id}/profile_${timestamp}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(filePath, imageFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
        
        // Limpiar imagen anterior si existe
        if (userRoleData?.imagen && userRoleData.imagen !== publicUrl) {
          try {
            const oldFilePath = userRoleData.imagen.split('/profile-images/')[1];
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

      // Actualizar datos del perfil
      const { error } = await supabase
        .from("user_roles")
        .update({
          nombre: nombreValue,
          email: emailValue,
          hospital: hospitalValue || null,
          especialidad: especialidadValue || null,
          telefono: telefonoValue || null,
          genero: formData.genero,
          imagen: imageUrl,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Actualizar contraseña si se proporcionó
      if (passwordData.newPassword) {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          toast({
            title: "Error",
            description: "Las contraseñas no coinciden",
            variant: "destructive",
          });
          return;
        }

        if (passwordData.newPassword.length < 6) {
          toast({
            title: "Error",
            description: "La contraseña debe tener al menos 6 caracteres",
            variant: "destructive",
          });
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: passwordData.newPassword,
        });

        if (passwordError) throw passwordError;

        setPasswordData({ newPassword: "", confirmPassword: "" });
      }

      setFormData({
        nombre: nombreValue,
        email: emailValue,
        hospital: hospitalValue,
        especialidad: especialidadValue,
        telefono: telefonoValue,
        genero: formData.genero,
      });

      await refreshUserRole();
      setErrors({});

      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado exitosamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
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
                onClick={() => navigate("/dashboard")}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Mi Perfil</h1>
                <p className="text-sm text-white/80">Edita tu información personal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Información Personal con Imagen */}
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza tus datos personales y de contacto
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
                    <Label htmlFor="image" className="cursor-pointer">
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
                        id="image"
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
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre Completo *</Label>
                        <Input
                          id="nombre"
                          value={formData.nombre}
                          onChange={(e) => handleFormChange("nombre", e.target.value)}
                          placeholder="Ej: Juan Pérez González"
                          className={errors.nombre ? "border-destructive" : ""}
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
                          onChange={(e) => handleFormChange("email", e.target.value)}
                          placeholder="Ej: juan.perez@hospital.cl"
                          className={errors.email ? "border-destructive" : ""}
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
                          onChange={(e) => handleFormChange("hospital", e.target.value)}
                          placeholder="Ej: Hospital Clínico Universidad de Chile"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="especialidad">Especialidad</Label>
                        <Input
                          id="especialidad"
                          value={formData.especialidad}
                          onChange={(e) => handleFormChange("especialidad", e.target.value)}
                          placeholder="Ej: Cardiología"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telefono">Teléfono</Label>
                        <Input
                          id="telefono"
                          value={formData.telefono}
                          onChange={(e) => handleFormChange("telefono", e.target.value)}
                          placeholder="Ej: +56912345678"
                          className={errors.telefono ? "border-destructive" : ""}
                        />
                        {errors.telefono && (
                          <p className="text-sm text-destructive">{errors.telefono}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="genero">Género *</Label>
                        <Select
                          value={formData.genero}
                          onValueChange={(value) => handleFormChange("genero", value)}
                        >
                          <SelectTrigger id="genero">
                            <SelectValue placeholder="Selecciona tu género" />
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
                      <Label>Rol</Label>
                      <Input
                        value={userRoleData?.role === 'medico' ? 'Médico' : userRoleData?.role === 'medico_jefe' ? 'Médico Jefe' : userRoleData?.role || ""}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-sm text-muted-foreground">
                        El rol no puede ser modificado
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cambiar Contraseña */}
          <Card>
            <CardHeader>
              <CardTitle>Cambiar Contraseña</CardTitle>
              <CardDescription>
                Deja estos campos vacíos si no deseas cambiar tu contraseña
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    placeholder="Repite la contraseña"
                    minLength={6}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
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
