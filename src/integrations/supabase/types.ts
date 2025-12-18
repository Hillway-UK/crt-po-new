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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_workflow_steps: {
        Row: {
          approver_role: Database["public"]["Enums"]["user_role"]
          created_at: string | null
          id: string
          is_required: boolean | null
          max_amount: number | null
          min_amount: number | null
          requires_previous_approval: boolean | null
          skip_if_below_amount: number | null
          step_order: number
          workflow_id: string | null
        }
        Insert: {
          approver_role: Database["public"]["Enums"]["user_role"]
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_amount?: number | null
          min_amount?: number | null
          requires_previous_approval?: boolean | null
          skip_if_below_amount?: number | null
          step_order: number
          workflow_id?: string | null
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["user_role"]
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_amount?: number | null
          min_amount?: number | null
          requires_previous_approval?: boolean | null
          skip_if_below_amount?: number | null
          step_order?: number
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organisation_id: string | null
          updated_at: string | null
          workflow_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organisation_id?: string | null
          updated_at?: string | null
          workflow_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organisation_id?: string | null
          updated_at?: string | null
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          default_payment_terms: number | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organisation_id: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          default_payment_terms?: number | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          default_payment_terms?: number | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_approval_logs: {
        Row: {
          action: Database["public"]["Enums"]["invoice_action"]
          action_by_user_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["invoice_action"]
          action_by_user_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["invoice_action"]
          action_by_user_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_approval_logs_action_by_user_id_fkey"
            columns: ["action_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_approval_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_ex_vat: number
          amount_inc_vat: number | null
          approved_by_user_id: string | null
          contractor_id: string | null
          created_at: string | null
          file_url: string | null
          id: string
          invoice_date: string
          invoice_number: string
          mismatch_notes: string | null
          organisation_id: string | null
          original_filename: string | null
          payment_date: string | null
          payment_reference: string | null
          po_id: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          updated_at: string | null
          uploaded_by_user_id: string | null
          vat_rate: number | null
        }
        Insert: {
          amount_ex_vat: number
          amount_inc_vat?: number | null
          approved_by_user_id?: string | null
          contractor_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          mismatch_notes?: string | null
          organisation_id?: string | null
          original_filename?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          po_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          updated_at?: string | null
          uploaded_by_user_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          amount_ex_vat?: number
          amount_inc_vat?: number | null
          approved_by_user_id?: string | null
          contractor_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          mismatch_notes?: string | null
          organisation_id?: string | null
          original_filename?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          po_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          updated_at?: string | null
          uploaded_by_user_id?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          organisation_id: string
          related_invoice_id: string | null
          related_po_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          organisation_id: string
          related_invoice_id?: string | null
          related_po_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          organisation_id?: string
          related_invoice_id?: string | null
          related_po_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_po_id_fkey"
            columns: ["related_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          accounts_email: string
          address: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          accounts_email: string
          address?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          accounts_email?: string
          address?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      po_approval_logs: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          action_by_user_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          po_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          action_by_user_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          po_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          action_by_user_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          po_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_approval_logs_action_by_user_id_fkey"
            columns: ["action_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_approval_logs_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organisation_id: string | null
          reference_code: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organisation_id?: string | null
          reference_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organisation_id?: string | null
          reference_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount_ex_vat: number
          amount_inc_vat: number | null
          approval_date: string | null
          approved_by_user_id: string | null
          contractor_id: string
          created_at: string | null
          created_by_user_id: string | null
          description: string
          id: string
          notes: string | null
          organisation_id: string | null
          pdf_url: string | null
          po_number: string
          property_id: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          amount_ex_vat: number
          amount_inc_vat?: number | null
          approval_date?: string | null
          approved_by_user_id?: string | null
          contractor_id: string
          created_at?: string | null
          created_by_user_id?: string | null
          description: string
          id?: string
          notes?: string | null
          organisation_id?: string | null
          pdf_url?: string | null
          po_number: string
          property_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          amount_ex_vat?: number
          amount_inc_vat?: number | null
          approval_date?: string | null
          approved_by_user_id?: string | null
          contractor_id?: string
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string
          id?: string
          notes?: string | null
          organisation_id?: string | null
          pdf_url?: string | null
          po_number?: string
          property_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          auto_approve_below_amount: number | null
          contractor_email: string | null
          created_at: string | null
          default_vat_rate: number | null
          id: string
          next_po_number: number | null
          notify_accounts_email: string | null
          notify_md_email: string | null
          notify_pm_email: string | null
          organisation_id: string | null
          payment_terms_text: string | null
          po_prefix: string | null
          require_ceo_above_amount: number | null
          updated_at: string | null
          use_custom_workflows: boolean | null
        }
        Insert: {
          auto_approve_below_amount?: number | null
          contractor_email?: string | null
          created_at?: string | null
          default_vat_rate?: number | null
          id?: string
          next_po_number?: number | null
          notify_accounts_email?: string | null
          notify_md_email?: string | null
          notify_pm_email?: string | null
          organisation_id?: string | null
          payment_terms_text?: string | null
          po_prefix?: string | null
          require_ceo_above_amount?: number | null
          updated_at?: string | null
          use_custom_workflows?: boolean | null
        }
        Update: {
          auto_approve_below_amount?: number | null
          contractor_email?: string | null
          created_at?: string | null
          default_vat_rate?: number | null
          id?: string
          next_po_number?: number | null
          notify_accounts_email?: string | null
          notify_md_email?: string | null
          notify_pm_email?: string | null
          organisation_id?: string | null
          payment_terms_text?: string | null
          po_prefix?: string | null
          require_ceo_above_amount?: number | null
          updated_at?: string | null
          use_custom_workflows?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by_user_id: string
          organisation_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by_user_id: string
          organisation_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by_user_id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          organisation_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_po_number: { Args: { org_id: string }; Returns: string }
      get_accounts_dashboard_stats: { Args: { org_id: string }; Returns: Json }
      get_admin_dashboard_stats: { Args: { org_id: string }; Returns: Json }
      get_md_dashboard_stats: { Args: { org_id: string }; Returns: Json }
      get_pm_dashboard_stats: { Args: { user_id: string }; Returns: Json }
      get_user_organisation_id: { Args: never; Returns: string }
    }
    Enums: {
      approval_action: "SENT_FOR_APPROVAL" | "APPROVED" | "REJECTED"
      invoice_action:
        | "UPLOADED"
        | "MATCHED"
        | "SENT_FOR_MD_APPROVAL"
        | "APPROVED"
        | "REJECTED"
        | "MARKED_PAID"
      invoice_status:
        | "UPLOADED"
        | "MATCHED"
        | "PENDING_MD_APPROVAL"
        | "APPROVED_FOR_PAYMENT"
        | "PAID"
        | "REJECTED"
      po_status:
        | "DRAFT"
        | "PENDING_PM_APPROVAL"
        | "PENDING_MD_APPROVAL"
        | "PENDING_CEO_APPROVAL"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
      user_role: "PROPERTY_MANAGER" | "MD" | "ACCOUNTS" | "ADMIN" | "CEO"
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
      approval_action: ["SENT_FOR_APPROVAL", "APPROVED", "REJECTED"],
      invoice_action: [
        "UPLOADED",
        "MATCHED",
        "SENT_FOR_MD_APPROVAL",
        "APPROVED",
        "REJECTED",
        "MARKED_PAID",
      ],
      invoice_status: [
        "UPLOADED",
        "MATCHED",
        "PENDING_MD_APPROVAL",
        "APPROVED_FOR_PAYMENT",
        "PAID",
        "REJECTED",
      ],
      po_status: [
        "DRAFT",
        "PENDING_PM_APPROVAL",
        "PENDING_MD_APPROVAL",
        "PENDING_CEO_APPROVAL",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
      ],
      user_role: ["PROPERTY_MANAGER", "MD", "ACCOUNTS", "ADMIN", "CEO"],
    },
  },
} as const
