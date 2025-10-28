export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      casos: {
        Row: {
          descripcion_adicional: string | null
          diagnostico_principal: string
          edad_paciente: number
          email_paciente: string
          estado: Database["public"]["Enums"]["estado_caso"] | null
          fecha_actualizacion: string | null
          fecha_analisis_ia: string | null
          fecha_creacion: string | null
          frecuencia_cardiaca: number | null
          frecuencia_respiratoria: number | null
          historia_clinica: string | null
          id: string
          medico_jefe_id: string | null
          medico_tratante_id: string
          nombre_paciente: string
          presion_arterial: string | null
          saturacion_oxigeno: number | null
          sexo_paciente: string
          sintomas: string | null
          temperatura: number | null
        }
        Insert: {
          descripcion_adicional?: string | null
          diagnostico_principal: string
          edad_paciente: number
          email_paciente: string
          estado?: Database["public"]["Enums"]["estado_caso"] | null
          fecha_actualizacion?: string | null
          fecha_analisis_ia?: string | null
          fecha_creacion?: string | null
          frecuencia_cardiaca?: number | null
          frecuencia_respiratoria?: number | null
          historia_clinica?: string | null
          id?: string
          medico_jefe_id?: string | null
          medico_tratante_id: string
          nombre_paciente: string
          presion_arterial?: string | null
          saturacion_oxigeno?: number | null
          sexo_paciente: string
          sintomas?: string | null
          temperatura?: number | null
        }
        Update: {
          descripcion_adicional?: string | null
          diagnostico_principal?: string
          edad_paciente?: number
          email_paciente?: string
          estado?: Database["public"]["Enums"]["estado_caso"] | null
          fecha_actualizacion?: string | null
          fecha_analisis_ia?: string | null
          fecha_creacion?: string | null
          frecuencia_cardiaca?: number | null
          frecuencia_respiratoria?: number | null
          historia_clinica?: string | null
          id?: string
          medico_jefe_id?: string | null
          medico_tratante_id?: string
          nombre_paciente?: string
          presion_arterial?: string | null
          saturacion_oxigeno?: number | null
          sexo_paciente?: string
          sintomas?: string | null
          temperatura?: number | null
        }
        Relationships: []
      }
      comunicaciones_paciente: {
        Row: {
          caso_id: string | null
          enviada: boolean | null
          explicacion: string
          fecha_creacion: string | null
          fecha_envio: string | null
          id: string
          resultado: Database["public"]["Enums"]["resultado_comunicacion"]
        }
        Insert: {
          caso_id?: string | null
          enviada?: boolean | null
          explicacion: string
          fecha_creacion?: string | null
          fecha_envio?: string | null
          id?: string
          resultado: Database["public"]["Enums"]["resultado_comunicacion"]
        }
        Update: {
          caso_id?: string | null
          enviada?: boolean | null
          explicacion?: string
          fecha_creacion?: string | null
          fecha_envio?: string | null
          id?: string
          resultado?: Database["public"]["Enums"]["resultado_comunicacion"]
        }
        Relationships: [
          {
            foreignKeyName: "comunicaciones_paciente_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          caso_id: string | null
          fecha_creacion: string | null
          fecha_lectura: string | null
          id: string
          leido: boolean | null
          mensaje: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"] | null
          titulo: string | null
          usuario_id: string | null
        }
        Insert: {
          caso_id?: string | null
          fecha_creacion?: string | null
          fecha_lectura?: string | null
          id?: string
          leido?: boolean | null
          mensaje?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"] | null
          titulo?: string | null
          usuario_id?: string | null
        }
        Update: {
          caso_id?: string | null
          fecha_creacion?: string | null
          fecha_lectura?: string | null
          id?: string
          leido?: boolean | null
          mensaje?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"] | null
          titulo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      resolucion_caso: {
        Row: {
          caso_id: string
          comentario_final: string | null
          comentario_medico: string | null
          decision_final:
            | Database["public"]["Enums"]["resultado_comunicacion"]
            | null
          decision_medico: Database["public"]["Enums"]["decision_tipo"] | null
          fecha_decision_medico: string | null
          fecha_decision_medico_jefe: string | null
          id: string
        }
        Insert: {
          caso_id: string
          comentario_final?: string | null
          comentario_medico?: string | null
          decision_final?:
            | Database["public"]["Enums"]["resultado_comunicacion"]
            | null
          decision_medico?: Database["public"]["Enums"]["decision_tipo"] | null
          fecha_decision_medico?: string | null
          fecha_decision_medico_jefe?: string | null
          id?: string
        }
        Update: {
          caso_id?: string
          comentario_final?: string | null
          comentario_medico?: string | null
          decision_final?:
            | Database["public"]["Enums"]["resultado_comunicacion"]
            | null
          decision_medico?: Database["public"]["Enums"]["decision_tipo"] | null
          fecha_decision_medico?: string | null
          fecha_decision_medico_jefe?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolucion_caso_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      sugerencia_ia: {
        Row: {
          caso_id: string
          confianza: number | null
          explicacion: string | null
          fecha_procesamiento: string | null
          id: string
          sugerencia: Database["public"]["Enums"]["sugerencia_tipo"]
        }
        Insert: {
          caso_id: string
          confianza?: number | null
          explicacion?: string | null
          fecha_procesamiento?: string | null
          id?: string
          sugerencia: Database["public"]["Enums"]["sugerencia_tipo"]
        }
        Update: {
          caso_id?: string
          confianza?: number | null
          explicacion?: string | null
          fecha_procesamiento?: string | null
          id?: string
          sugerencia?: Database["public"]["Enums"]["sugerencia_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "sugerencia_ia_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          email: string
          especialidad: string | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          hospital: string | null
          id: string
          imagen: string | null
          nombre: string
          role: Database["public"]["Enums"]["app_role"]
          telefono: string | null
          ultimo_acceso: string | null
          user_id: string
        }
        Insert: {
          email: string
          especialidad?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          hospital?: string | null
          id?: string
          imagen?: string | null
          nombre: string
          role: Database["public"]["Enums"]["app_role"]
          telefono?: string | null
          ultimo_acceso?: string | null
          user_id: string
        }
        Update: {
          email?: string
          especialidad?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          hospital?: string | null
          id?: string
          imagen?: string | null
          nombre?: string
          role?: Database["public"]["Enums"]["app_role"]
          telefono?: string | null
          ultimo_acceso?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_ley_metricas_doctor: {
        Row: {
          ley_aplicada: number | null
          ley_no_aplicada: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "medico" | "medico_jefe"
      decision_tipo: "aceptado" | "rechazado" | "deriva"
      estado_caso: "pendiente" | "aceptado" | "rechazado" | "derivado"
      resultado_comunicacion: "aceptado" | "rechazado"
      sugerencia_tipo: "aceptar" | "rechazar" | "incierto"
      tipo_notificacion: "caso_derivado" | "caso_resuelto"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "medico", "medico_jefe"],
      decision_tipo: ["aceptado", "rechazado", "deriva"],
      estado_caso: ["pendiente", "aceptado", "rechazado", "derivado"],
      resultado_comunicacion: ["aceptado", "rechazado"],
      sugerencia_tipo: ["aceptar", "rechazar", "incierto"],
      tipo_notificacion: ["caso_derivado", "caso_resuelto"],
    },
  },
} as const
