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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string
          actor_id: string
          actor_name: string
          created_at: string
          id: string
          target_id: string
          target_name: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name: string
          created_at?: string
          id?: string
          target_id: string
          target_name: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string
          created_at?: string
          id?: string
          target_id?: string
          target_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          default_priority: Database["public"]["Enums"]["ticket_priority"]
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          id?: string
          name?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read: boolean
          ticket_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          ticket_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          ticket_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_after: string | null
          active: boolean
          created_at: string
          department: string | null
          full_name: string
          id: string
          must_change_password: boolean
          registration: string | null
          username: string
        }
        Insert: {
          access_after?: string | null
          active?: boolean
          created_at?: string
          department?: string | null
          full_name?: string
          id: string
          must_change_password?: boolean
          registration?: string | null
          username: string
        }
        Update: {
          access_after?: string | null
          active?: boolean
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          must_change_password?: boolean
          registration?: string | null
          username?: string
        }
        Relationships: []
      }
      routing_rules: {
        Row: {
          active: boolean
          created_at: string
          department: string
          id: string
          involves_safety: boolean
          notes: string | null
          topic: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department: string
          id?: string
          involves_safety?: boolean
          notes?: string | null
          topic: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string
          id?: string
          involves_safety?: boolean
          notes?: string | null
          topic?: string
        }
        Relationships: []
      }
      sla_settings: {
        Row: {
          hours: number
          priority: Database["public"]["Enums"]["ticket_priority"]
        }
        Insert: {
          hours: number
          priority: Database["public"]["Enums"]["ticket_priority"]
        }
        Update: {
          hours?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          event_type: string
          from_priority: Database["public"]["Enums"]["ticket_priority"] | null
          from_status: Database["public"]["Enums"]["ticket_status"] | null
          id: string
          note: string | null
          ticket_id: string
          to_priority: Database["public"]["Enums"]["ticket_priority"] | null
          to_status: Database["public"]["Enums"]["ticket_status"] | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type: string
          from_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          note?: string | null
          ticket_id: string
          to_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          to_status?: Database["public"]["Enums"]["ticket_status"] | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type?: string
          from_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          note?: string | null
          ticket_id?: string
          to_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          to_status?: Database["public"]["Enums"]["ticket_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          ai_is_safety: boolean | null
          ai_redirected: boolean
          ai_suggested_department: string | null
          ai_suggested_priority:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          ai_summary: string | null
          assignee_id: string | null
          assignee_name: string | null
          category: string
          closed_at: string | null
          created_at: string
          department: string
          description: string
          due_at: string | null
          id: string
          location: string
          number: number
          observations: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          protocol: string | null
          received_at: string | null
          registration: string
          requester_id: string
          requester_name: string
          solution: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          ai_is_safety?: boolean | null
          ai_redirected?: boolean
          ai_suggested_department?: string | null
          ai_suggested_priority?:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          ai_summary?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          department: string
          description: string
          due_at?: string | null
          id?: string
          location: string
          number?: number
          observations?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          protocol?: string | null
          received_at?: string | null
          registration: string
          requester_id: string
          requester_name: string
          solution?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          ai_is_safety?: boolean | null
          ai_redirected?: boolean
          ai_suggested_department?: string | null
          ai_suggested_priority?:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          ai_summary?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          department?: string
          description?: string
          due_at?: string | null
          id?: string
          location?: string
          number?: number
          observations?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          protocol?: string | null
          received_at?: string | null
          registration?: string
          requester_id?: string
          requester_name?: string
          solution?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_ready: { Args: { _user_id: string }; Returns: boolean }
      actor_name: { Args: never; Returns: string }
      delete_closed_ticket: { Args: { _ticket: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      notify_staff: {
        Args: { _body: string; _kind: string; _ticket: string; _title: string }
        Returns: undefined
      }
      replace_app_user_role: {
        Args: {
          _actor_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _target_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "developer" | "requester"
      ticket_priority: "critica" | "alta" | "media" | "baixa"
      ticket_status:
        | "enviado"
        | "recebido"
        | "em_analise"
        | "em_andamento"
        | "concluido"
        | "aguardando_info"
        | "encaminhado"
        | "cancelado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "developer", "requester"],
      ticket_priority: ["critica", "alta", "media", "baixa"],
      ticket_status: [
        "enviado",
        "recebido",
        "em_analise",
        "em_andamento",
        "concluido",
        "aguardando_info",
        "encaminhado",
        "cancelado",
      ],
    },
  },
} as const
