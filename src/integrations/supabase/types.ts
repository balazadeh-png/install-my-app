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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed: boolean | null
          created_at: string
          end_date: string
          fiscal_year_id: string | null
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          closed?: boolean | null
          created_at?: string
          end_date: string
          fiscal_year_id?: string | null
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          closed?: boolean | null
          created_at?: string
          end_date?: string
          fiscal_year_id?: string | null
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: string
          active: boolean | null
          code: string
          created_at: string
          entity_id: string | null
          id: string
          is_group: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          active?: boolean | null
          code: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_group?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          active?: boolean | null
          code?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_group?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          party_id: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          party_id: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          party_id?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          entity_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          entity_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_primary: boolean | null
          last_name: string | null
          party_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          party_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_name?: string | null
          party_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          decimals: number | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          decimals?: number | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          decimals?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          currency: string
          default_book_id: string | null
          id: string
          name: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          currency: string
          default_book_id?: string | null
          id?: string
          name: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          currency?: string
          default_book_id?: string | null
          id?: string
          name?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          date: string
          destination: string
          id: string
          origin: string
          rate: number
        }
        Insert: {
          created_at?: string
          date: string
          destination: string
          id?: string
          origin: string
          rate: number
        }
        Update: {
          created_at?: string
          date?: string
          destination?: string
          id?: string
          origin?: string
          rate?: number
        }
        Relationships: []
      }
      fiscal_years: {
        Row: {
          closed: boolean | null
          created_at: string
          end_date: string
          entity_id: string | null
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          closed?: boolean | null
          created_at?: string
          end_date: string
          entity_id?: string | null
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          closed?: boolean | null
          created_at?: string
          end_date?: string
          entity_id?: string | null
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_years_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_entries: {
        Row: {
          account_id: string
          book_id: string | null
          created_at: string
          credit: number | null
          currency: string | null
          debit: number | null
          entity_id: string | null
          entry_number: string | null
          exchange_rate: number | null
          id: string
          is_reversal: boolean | null
          memo: string | null
          party_id: string | null
          posting_date: string
          reversal_of: string | null
          updated_at: string
          voucher_id: string | null
          voucher_type: string | null
        }
        Insert: {
          account_id: string
          book_id?: string | null
          created_at?: string
          credit?: number | null
          currency?: string | null
          debit?: number | null
          entity_id?: string | null
          entry_number?: string | null
          exchange_rate?: number | null
          id?: string
          is_reversal?: boolean | null
          memo?: string | null
          party_id?: string | null
          posting_date: string
          reversal_of?: string | null
          updated_at?: string
          voucher_id?: string | null
          voucher_type?: string | null
        }
        Update: {
          account_id?: string
          book_id?: string | null
          created_at?: string
          credit?: number | null
          currency?: string | null
          debit?: number | null
          entity_id?: string | null
          entry_number?: string | null
          exchange_rate?: number | null
          id?: string
          is_reversal?: boolean | null
          memo?: string | null
          party_id?: string | null
          posting_date?: string
          reversal_of?: string | null
          updated_at?: string
          voucher_id?: string | null
          voucher_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_entries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          active: boolean | null
          category_id: string | null
          code: string
          created_at: string
          default_warehouse_id: string | null
          entity_id: string | null
          id: string
          is_stock_item: boolean | null
          name: string
          uom_id: string | null
          updated_at: string
          valuation_method: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          code: string
          created_at?: string
          default_warehouse_id?: string | null
          entity_id?: string | null
          id?: string
          is_stock_item?: boolean | null
          name: string
          uom_id?: string | null
          updated_at?: string
          valuation_method?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          code?: string
          created_at?: string
          default_warehouse_id?: string | null
          entity_id?: string | null
          id?: string
          is_stock_item?: boolean | null
          name?: string
          uom_id?: string | null
          updated_at?: string
          valuation_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          label: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          label: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      naming_series: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          name: string
          next_number: number | null
          prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          name: string
          next_number?: number | null
          prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          name?: string
          next_number?: number | null
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "naming_series_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          classification: string
          commercial_name: string | null
          created_at: string
          enabled: boolean | null
          entity_id: string | null
          group_id: string | null
          id: string
          name: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          classification: string
          commercial_name?: string | null
          created_at?: string
          enabled?: boolean | null
          entity_id?: string | null
          group_id?: string | null
          id?: string
          name: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          classification?: string
          commercial_name?: string | null
          created_at?: string
          enabled?: boolean | null
          entity_id?: string | null
          group_id?: string | null
          id?: string
          name?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      party_groups: {
        Row: {
          classification: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          classification: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          timezone: string | null
          updated_at: string
          user_name: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          timezone?: string | null
          updated_at?: string
          user_name: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          timezone?: string | null
          updated_at?: string
          user_name?: string
        }
        Relationships: []
      }
      role_modules: {
        Row: {
          can_access: boolean | null
          can_approve: boolean | null
          can_close: boolean | null
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_import: boolean | null
          can_report: boolean | null
          can_setup: boolean | null
          can_view: boolean | null
          id: string
          module_id: string
          role_id: string
        }
        Insert: {
          can_access?: boolean | null
          can_approve?: boolean | null
          can_close?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_import?: boolean | null
          can_report?: boolean | null
          can_setup?: boolean | null
          can_view?: boolean | null
          id?: string
          module_id: string
          role_id: string
        }
        Update: {
          can_access?: boolean | null
          can_approve?: boolean | null
          can_close?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_import?: boolean | null
          can_report?: boolean | null
          can_setup?: boolean | null
          can_view?: boolean | null
          id?: string
          module_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_modules_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uom: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
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
      warehouses: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          entity_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          entity_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      app_role:
        | "admin"
        | "accountant"
        | "sales"
        | "purchasing"
        | "inventory"
        | "viewer"
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
      app_role: [
        "admin",
        "accountant",
        "sales",
        "purchasing",
        "inventory",
        "viewer",
      ],
    },
  },
} as const
