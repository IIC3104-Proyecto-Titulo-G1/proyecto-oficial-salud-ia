import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";

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

      // Actualizar datos del perfil
      const { error } = await supabase
        .from("user_roles")
        .update({
          nombre: nombreValue,
          email: emailValue,
          hospital: hospitalValue || null,
          especialidad: especialidadValue || null,
          telefono: telefonoValue || null,
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
