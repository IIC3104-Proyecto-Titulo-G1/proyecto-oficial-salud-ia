import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Upload, User, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleteImage, setDeleteImage] = useState(false);
  
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
        const filePath = `${user.id}/profile.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Mi Perfil</h1>
            <p className="text-muted-foreground">
              Edita tu información personal
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Imagen de Perfil</CardTitle>
            <CardDescription>
              Sube una foto de perfil (máximo 5MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-32 w-32">
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
            <div className="w-full">
              <Label htmlFor="image" className="cursor-pointer">
                <div 
                  className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg transition-colors ${
                    isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-5 w-5" />
                  <span>Arrastra una imagen o haz clic para seleccionar</span>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>
              Actualiza tus datos. El rol no puede ser modificado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleFormChange("nombre", e.target.value)}
                  required
                  className={errors.nombre ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  required
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hospital">Hospital</Label>
                <Input
                  id="hospital"
                  value={formData.hospital}
                  onChange={(e) => handleFormChange("hospital", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="especialidad">Especialidad</Label>
                <Input
                  id="especialidad"
                  value={formData.especialidad}
                  onChange={(e) => handleFormChange("especialidad", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => handleFormChange("telefono", e.target.value)}
                  className={errors.telefono ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
                {errors.telefono && (
                  <p className="text-sm text-destructive">{errors.telefono}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Input
                  value={userRoleData?.role || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  El rol no puede ser modificado por el usuario
                </p>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cambiar Contraseña</CardTitle>
            <CardDescription>
              Actualiza tu contraseña. Debe tener al menos 6 caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
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
                  minLength={6}
                />
              </div>

              <Button 
                type="submit" 
                disabled={saving || !passwordData.newPassword} 
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
