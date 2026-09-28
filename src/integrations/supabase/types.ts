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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed: boolean | null
          created_at: string
          end_date: string
          entity_id: string | null
          fiscal_year_id: string | null
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
        }
        Insert: {
          closed?: boolean | null
          created_at?: string
          end_date: string
          entity_id?: string | null
          fiscal_year_id?: string | null
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
        }
        Update: {
          closed?: boolean | null
          created_at?: string
          end_date?: string
          entity_id?: string | null
          fiscal_year_id?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
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
          currency_code: string | null
          entity_id: string | null
          id: string
          is_group: boolean | null
          name: string
          parent_id: string | null
          requires_business_unit: boolean | null
          requires_cost_center: boolean | null
          updated_at: string
        }
        Insert: {
          account_type: string
          active?: boolean | null
          code: string
          created_at?: string
          currency_code?: string | null
          entity_id?: string | null
          id?: string
          is_group?: boolean | null
          name: string
          parent_id?: string | null
          requires_business_unit?: boolean | null
          requires_cost_center?: boolean | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          active?: boolean | null
          code?: string
          created_at?: string
          currency_code?: string | null
          entity_id?: string | null
          id?: string
          is_group?: boolean | null
          name?: string
          parent_id?: string | null
          requires_business_unit?: boolean | null
          requires_cost_center?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
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
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
          id?: string
          is_primary?: boolean | null
          party_id?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          is_active: boolean
          item_id: string
          name: string
          notes: string | null
          output_qty: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          is_active?: boolean
          item_id: string
          name: string
          notes?: string | null
          output_qty?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean
          item_id?: string
          name?: string
          notes?: string | null
          output_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          bom_id: string
          component_item_id: string
          created_at: string
          id: string
          qty_required: number
        }
        Insert: {
          bom_id: string
          component_item_id: string
          created_at?: string
          id?: string
          qty_required: number
        }
        Update: {
          bom_id?: string
          component_item_id?: string
          created_at?: string
          id?: string
          qty_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "items"
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
      business_units: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          entity_id: string
          id: string
          is_group: boolean | null
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          entity_id: string
          id?: string
          is_group?: boolean | null
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_group?: boolean | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_units_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      company_default_accounts: {
        Row: {
          cogs_account_id: string | null
          entity_id: string
          input_tax_account_id: string | null
          inventory_account_id: string | null
          output_tax_account_id: string | null
          payable_account_id: string | null
          purchase_expense_account_id: string | null
          realized_exchange_gain_account_id: string | null
          realized_exchange_loss_account_id: string | null
          receivable_account_id: string | null
          sales_income_account_id: string | null
          unrealized_exchange_gain_account_id: string | null
          unrealized_exchange_loss_account_id: string | null
          updated_at: string
        }
        Insert: {
          cogs_account_id?: string | null
          entity_id: string
          input_tax_account_id?: string | null
          inventory_account_id?: string | null
          output_tax_account_id?: string | null
          payable_account_id?: string | null
          purchase_expense_account_id?: string | null
          realized_exchange_gain_account_id?: string | null
          realized_exchange_loss_account_id?: string | null
          receivable_account_id?: string | null
          sales_income_account_id?: string | null
          unrealized_exchange_gain_account_id?: string | null
          unrealized_exchange_loss_account_id?: string | null
          updated_at?: string
        }
        Update: {
          cogs_account_id?: string | null
          entity_id?: string
          input_tax_account_id?: string | null
          inventory_account_id?: string | null
          output_tax_account_id?: string | null
          payable_account_id?: string | null
          purchase_expense_account_id?: string | null
          realized_exchange_gain_account_id?: string | null
          realized_exchange_loss_account_id?: string | null
          receivable_account_id?: string | null
          sales_income_account_id?: string | null
          unrealized_exchange_gain_account_id?: string | null
          unrealized_exchange_loss_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_default_accounts_cogs_account_id_fkey"
            columns: ["cogs_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_input_tax_account_id_fkey"
            columns: ["input_tax_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_inventory_account_id_fkey"
            columns: ["inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_output_tax_account_id_fkey"
            columns: ["output_tax_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_payable_account_id_fkey"
            columns: ["payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_purchase_expense_account_id_fkey"
            columns: ["purchase_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_realized_exchange_gain_account_id_fkey"
            columns: ["realized_exchange_gain_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_realized_exchange_loss_account_id_fkey"
            columns: ["realized_exchange_loss_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_receivable_account_id_fkey"
            columns: ["receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_sales_income_account_id_fkey"
            columns: ["sales_income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_unrealized_exchange_gain_account__fkey"
            columns: ["unrealized_exchange_gain_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_default_accounts_unrealized_exchange_loss_account__fkey"
            columns: ["unrealized_exchange_loss_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          is_default: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          is_default?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          is_default?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_entity_id_fkey"
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
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
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
            foreignKeyName: "contacts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          entity_id: string
          id: string
          is_group: boolean | null
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          entity_id: string
          id?: string
          is_group?: boolean | null
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_group?: boolean | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
          symbol: string | null
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
          symbol?: string | null
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
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_note_lines: {
        Row: {
          dispatch_note_id: string
          id: string
          item_id: string
          qty: number
          unit_value: number | null
          uom: string | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          dispatch_note_id: string
          id?: string
          item_id: string
          qty: number
          unit_value?: number | null
          uom?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          dispatch_note_id?: string
          id?: string
          item_id?: string
          qty?: number
          unit_value?: number | null
          uom?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_note_lines_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_notes: {
        Row: {
          arrival_at: string | null
          carrier_name: string
          carrier_tax_id: string
          courier_name: string | null
          courier_status: string | null
          courier_tracking_number: string | null
          created_at: string
          created_by: string | null
          departure_at: string
          destination_address: string
          dispatch_number: string | null
          entity_id: string
          id: string
          notes: string | null
          origin_address: string
          party_id: string
          status: Database["public"]["Enums"]["dispatch_status"]
          transfer_type: Database["public"]["Enums"]["dispatch_transfer_type"]
          updated_at: string
          vehicle_plate: string
          warehouse_id: string
        }
        Insert: {
          arrival_at?: string | null
          carrier_name: string
          carrier_tax_id: string
          courier_name?: string | null
          courier_status?: string | null
          courier_tracking_number?: string | null
          created_at?: string
          created_by?: string | null
          departure_at: string
          destination_address: string
          dispatch_number?: string | null
          entity_id: string
          id?: string
          notes?: string | null
          origin_address: string
          party_id: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          transfer_type: Database["public"]["Enums"]["dispatch_transfer_type"]
          updated_at?: string
          vehicle_plate: string
          warehouse_id: string
        }
        Update: {
          arrival_at?: string | null
          carrier_name?: string
          carrier_tax_id?: string
          courier_name?: string | null
          courier_status?: string | null
          courier_tracking_number?: string | null
          created_at?: string
          created_by?: string | null
          departure_at?: string
          destination_address?: string
          dispatch_number?: string | null
          entity_id?: string
          id?: string
          notes?: string | null
          origin_address?: string
          party_id?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          transfer_type?: Database["public"]["Enums"]["dispatch_transfer_type"]
          updated_at?: string
          vehicle_plate?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_notes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_definitions: {
        Row: {
          active: boolean
          created_at: string
          dj_code: string
          field_schema: Json
          id: string
          name: string
          periodicity: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dj_code: string
          field_schema?: Json
          id?: string
          name: string
          periodicity?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dj_code?: string
          field_schema?: Json
          id?: string
          name?: string
          periodicity?: string
        }
        Relationships: []
      }
      dj_field_mappings: {
        Row: {
          created_at: string
          description: string | null
          dj_definition_id: string
          entity_id: string
          field_key: string
          id: string
          source_account_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          dj_definition_id: string
          entity_id: string
          field_key: string
          id?: string
          source_account_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          dj_definition_id?: string
          entity_id?: string
          field_key?: string
          id?: string
          source_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_field_mappings_dj_definition_id_fkey"
            columns: ["dj_definition_id"]
            isOneToOne: false
            referencedRelation: "dj_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_field_mappings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_field_mappings_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_generations: {
        Row: {
          created_at: string
          created_by: string | null
          dj_definition_id: string
          entity_id: string
          filed_at: string | null
          generated_values: Json
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["dj_generation_status"]
          tax_year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dj_definition_id: string
          entity_id: string
          filed_at?: string | null
          generated_values?: Json
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["dj_generation_status"]
          tax_year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dj_definition_id?: string
          entity_id?: string
          filed_at?: string | null
          generated_values?: Json
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["dj_generation_status"]
          tax_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "dj_generations_dj_definition_id_fkey"
            columns: ["dj_definition_id"]
            isOneToOne: false
            referencedRelation: "dj_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_generations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          active: boolean | null
          base_currency_code: string | null
          code: string
          created_at: string
          currency: string
          default_book_id: string | null
          id: string
          name: string
          ppm_rate: number
          tax_id: string | null
          tax_regime: Database["public"]["Enums"]["tax_regime_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          base_currency_code?: string | null
          code: string
          created_at?: string
          currency: string
          default_book_id?: string | null
          id?: string
          name: string
          ppm_rate?: number
          tax_id?: string | null
          tax_regime?: Database["public"]["Enums"]["tax_regime_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          base_currency_code?: string | null
          code?: string
          created_at?: string
          currency?: string
          default_book_id?: string | null
          id?: string
          name?: string
          ppm_rate?: number
          tax_id?: string | null
          tax_regime?: Database["public"]["Enums"]["tax_regime_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_base_currency_code_fkey"
            columns: ["base_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
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
      exchange_revaluation_items: {
        Row: {
          account_id: string
          adjustment_amount: number
          balance_account_currency: number
          book_balance: number
          closing_rate: number
          created_at: string
          exchange_revaluation_id: string
          id: string
          revalued_balance: number
        }
        Insert: {
          account_id: string
          adjustment_amount: number
          balance_account_currency: number
          book_balance: number
          closing_rate: number
          created_at?: string
          exchange_revaluation_id: string
          id?: string
          revalued_balance: number
        }
        Update: {
          account_id?: string
          adjustment_amount?: number
          balance_account_currency?: number
          book_balance?: number
          closing_rate?: number
          created_at?: string
          exchange_revaluation_id?: string
          id?: string
          revalued_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "exchange_revaluation_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_revaluation_items_exchange_revaluation_id_fkey"
            columns: ["exchange_revaluation_id"]
            isOneToOne: false
            referencedRelation: "exchange_revaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_revaluations: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          journal_entry_id: string | null
          revaluation_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          journal_entry_id?: string | null
          revaluation_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          journal_entry_id?: string | null
          revaluation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_revaluations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
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
      fixed_asset_depreciation_entries: {
        Row: {
          amount: number
          created_at: string
          fixed_asset_id: string
          id: string
          journal_entry_id: string | null
          period_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          fixed_asset_id: string
          id?: string
          journal_entry_id?: string | null
          period_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          fixed_asset_id?: string
          id?: string
          journal_entry_id?: string | null
          period_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_asset_depreciation_entries_fixed_asset_id_fkey"
            columns: ["fixed_asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_depreciation_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          accumulated_depreciation_account_id: string
          acquisition_date: string
          acquisition_value: number
          asset_account_id: string
          asset_code: string
          business_unit_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          depreciation_expense_account_id: string
          depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          disposal_date: string | null
          disposal_journal_entry_id: string | null
          disposal_value: number | null
          entity_id: string
          id: string
          memo: string | null
          name: string
          residual_value: number
          status: Database["public"]["Enums"]["asset_status"]
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id: string
          acquisition_date: string
          acquisition_value: number
          asset_account_id: string
          asset_code: string
          business_unit_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          depreciation_expense_account_id: string
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          disposal_date?: string | null
          disposal_journal_entry_id?: string | null
          disposal_value?: number | null
          entity_id: string
          id?: string
          memo?: string | null
          name: string
          residual_value?: number
          status?: Database["public"]["Enums"]["asset_status"]
          useful_life_months: number
        }
        Update: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string
          acquisition_date?: string
          acquisition_value?: number
          asset_account_id?: string
          asset_code?: string
          business_unit_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          depreciation_expense_account_id?: string
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          disposal_date?: string | null
          disposal_journal_entry_id?: string | null
          disposal_value?: number | null
          entity_id?: string
          id?: string
          memo?: string | null
          name?: string
          residual_value?: number
          status?: Database["public"]["Enums"]["asset_status"]
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_disposal_journal_entry_id_fkey"
            columns: ["disposal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      foreign_trade_certificates: {
        Row: {
          certificate_number: string | null
          certificate_type: string
          created_at: string
          id: string
          issued_by: string | null
          operation_id: string
          valid_until: string | null
        }
        Insert: {
          certificate_number?: string | null
          certificate_type: string
          created_at?: string
          id?: string
          issued_by?: string | null
          operation_id: string
          valid_until?: string | null
        }
        Update: {
          certificate_number?: string | null
          certificate_type?: string
          created_at?: string
          id?: string
          issued_by?: string | null
          operation_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foreign_trade_certificates_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "foreign_trade_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      foreign_trade_operations: {
        Row: {
          booking_number: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          customs_status: Database["public"]["Enums"]["ft_customs_status"]
          dispatch_note_id: string | null
          dus_number: string | null
          entity_id: string
          id: string
          notes: string | null
          operation_type: Database["public"]["Enums"]["ft_operation_type"]
          party_id: string
          updated_at: string
        }
        Insert: {
          booking_number?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          customs_status?: Database["public"]["Enums"]["ft_customs_status"]
          dispatch_note_id?: string | null
          dus_number?: string | null
          entity_id: string
          id?: string
          notes?: string | null
          operation_type: Database["public"]["Enums"]["ft_operation_type"]
          party_id: string
          updated_at?: string
        }
        Update: {
          booking_number?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          customs_status?: Database["public"]["Enums"]["ft_customs_status"]
          dispatch_note_id?: string | null
          dus_number?: string | null
          entity_id?: string
          id?: string
          notes?: string | null
          operation_type?: Database["public"]["Enums"]["ft_operation_type"]
          party_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foreign_trade_operations_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foreign_trade_operations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foreign_trade_operations_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
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
      invoice_payments: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          entity_id: string
          id: string
          journal_entry_id: string | null
          memo: string | null
          payment_date: string
          purchase_invoice_id: string | null
          sales_invoice_id: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          entity_id: string
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          payment_date: string
          purchase_invoice_id?: string | null
          sales_invoice_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          entity_id?: string
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          payment_date?: string
          purchase_invoice_id?: string | null
          sales_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invoice_payments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoice_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
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
          sku: string | null
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
          sku?: string | null
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
          sku?: string | null
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
      journal_entries: {
        Row: {
          accounting_period_id: string | null
          book_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entry_number: string | null
          fiscal_year_id: string | null
          id: string
          memo: string | null
          naming_series_id: string | null
          posting_date: string
          reversal_of: string | null
          status: Database["public"]["Enums"]["journal_entry_status"]
          updated_at: string
          voucher_type: string
        }
        Insert: {
          accounting_period_id?: string | null
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entry_number?: string | null
          fiscal_year_id?: string | null
          id?: string
          memo?: string | null
          naming_series_id?: string | null
          posting_date: string
          reversal_of?: string | null
          status?: Database["public"]["Enums"]["journal_entry_status"]
          updated_at?: string
          voucher_type?: string
        }
        Update: {
          accounting_period_id?: string | null
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entry_number?: string | null
          fiscal_year_id?: string | null
          id?: string
          memo?: string | null
          naming_series_id?: string | null
          posting_date?: string
          reversal_of?: string | null
          status?: Database["public"]["Enums"]["journal_entry_status"]
          updated_at?: string
          voucher_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_naming_series_id_fkey"
            columns: ["naming_series_id"]
            isOneToOne: false
            referencedRelation: "naming_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          business_unit_id: string | null
          cost_center_id: string | null
          credit: number
          credit_account_currency: number | null
          currency_code: string | null
          debit: number
          debit_account_currency: number | null
          exchange_rate: number | null
          id: string
          journal_entry_id: string
          line_no: number
          memo: string | null
          party_id: string | null
          skip_currency_resolution: boolean
        }
        Insert: {
          account_id: string
          business_unit_id?: string | null
          cost_center_id?: string | null
          credit?: number
          credit_account_currency?: number | null
          currency_code?: string | null
          debit?: number
          debit_account_currency?: number | null
          exchange_rate?: number | null
          id?: string
          journal_entry_id: string
          line_no?: number
          memo?: string | null
          party_id?: string | null
          skip_currency_resolution?: boolean
        }
        Update: {
          account_id?: string
          business_unit_id?: string | null
          cost_center_id?: string | null
          credit?: number
          credit_account_currency?: number | null
          currency_code?: string | null
          debit?: number
          debit_account_currency?: number | null
          exchange_rate?: number | null
          id?: string
          journal_entry_id?: string
          line_no?: number
          memo?: string | null
          party_id?: string | null
          skip_currency_resolution?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          active: boolean | null
          created_at: string
          group_name: string | null
          group_sort_order: number
          id: string
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          group_name?: string | null
          group_sort_order?: number
          id?: string
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean | null
          created_at?: string
          group_name?: string | null
          group_sort_order?: number
          id?: string
          label?: string
          name?: string
          sort_order?: number
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
          is_3pl_client: boolean | null
          name: string
          party_type: string | null
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
          is_3pl_client?: boolean | null
          name: string
          party_type?: string | null
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
          is_3pl_client?: boolean | null
          name?: string
          party_type?: string | null
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
      party_warehouses: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          party_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          party_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          party_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_warehouses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_warehouses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_warehouses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      party_warehouses: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          party_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          party_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          party_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_warehouses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_warehouses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_warehouses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      period_close_checks: {
        Row: {
          accounting_period_id: string
          check_name: string
          checked_at: string | null
          checked_by: string | null
          id: string
          passed: boolean
        }
        Insert: {
          accounting_period_id: string
          check_name: string
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          passed?: boolean
        }
        Update: {
          accounting_period_id?: string
          check_name?: string
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "period_close_checks_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_payment_lines: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["pos_payment_method"]
          reference_number: string | null
          sales_invoice_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["pos_payment_method"]
          reference_number?: string | null
          sales_invoice_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["pos_payment_method"]
          reference_number?: string | null
          sales_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_payment_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_payment_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          business_unit_id: string | null
          cash_difference: number | null
          closed_at: string | null
          closing_amount: number | null
          entity_id: string
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: Database["public"]["Enums"]["pos_session_status"]
          warehouse_id: string
        }
        Insert: {
          business_unit_id?: string | null
          cash_difference?: number | null
          closed_at?: string | null
          closing_amount?: number | null
          entity_id: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["pos_session_status"]
          warehouse_id: string
        }
        Update: {
          business_unit_id?: string | null
          cash_difference?: number | null
          closed_at?: string | null
          closing_amount?: number | null
          entity_id?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["pos_session_status"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          bom_id: string
          business_unit_id: string | null
          completed_date: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          item_id: string
          notes: string | null
          order_number: string
          planned_date: string
          qty_planned: number
          qty_produced: number
          source_warehouse_id: string
          status: Database["public"]["Enums"]["production_order_status"]
          target_warehouse_id: string
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          bom_id: string
          business_unit_id?: string | null
          completed_date?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          item_id: string
          notes?: string | null
          order_number: string
          planned_date: string
          qty_planned: number
          qty_produced?: number
          source_warehouse_id: string
          status?: Database["public"]["Enums"]["production_order_status"]
          target_warehouse_id: string
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          bom_id?: string
          business_unit_id?: string | null
          completed_date?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          order_number?: string
          planned_date?: string
          qty_planned?: number
          qty_produced?: number
          source_warehouse_id?: string
          status?: Database["public"]["Enums"]["production_order_status"]
          target_warehouse_id?: string
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_target_warehouse_id_fkey"
            columns: ["target_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          active_entity_id: string | null
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
          active_entity_id?: string | null
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
          active_entity_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_active_entity_id_fkey"
            columns: ["active_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          item_id: string | null
          line_total: number
          purchase_invoice_id: string
          qty: number
          tax_rate: number
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_id?: string | null
          line_total?: number
          purchase_invoice_id: string
          qty?: number
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_id?: string | null
          line_total?: number
          purchase_invoice_id?: string
          qty?: number
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoice_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          business_unit_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          due_date: string | null
          entity_id: string
          exchange_rate: number
          id: string
          invoice_number: string | null
          issue_date: string
          journal_entry_id: string | null
          memo: string | null
          party_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          warehouse_id: string | null
        }
        Insert: {
          business_unit_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_date?: string | null
          entity_id: string
          exchange_rate?: number
          id?: string
          invoice_number?: string | null
          issue_date: string
          journal_entry_id?: string | null
          memo?: string | null
          party_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          warehouse_id?: string | null
        }
        Update: {
          business_unit_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_date?: string | null
          entity_id?: string
          exchange_rate?: number
          id?: string
          invoice_number?: string | null
          issue_date?: string
          journal_entry_id?: string | null
          memo?: string | null
          party_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "purchase_invoices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      rcv_reconciliation_items: {
        Row: {
          amount_in_easyerp: number | null
          amount_in_rcv: number | null
          difference: number | null
          document_number: string
          document_type: string
          id: string
          issue_date: string | null
          matched: boolean
          operation_type: string
          party_name: string | null
          party_tax_id: string
          rcv_reconciliation_run_id: string
          status: string
        }
        Insert: {
          amount_in_easyerp?: number | null
          amount_in_rcv?: number | null
          difference?: number | null
          document_number: string
          document_type: string
          id?: string
          issue_date?: string | null
          matched?: boolean
          operation_type: string
          party_name?: string | null
          party_tax_id: string
          rcv_reconciliation_run_id: string
          status?: string
        }
        Update: {
          amount_in_easyerp?: number | null
          amount_in_rcv?: number | null
          difference?: number | null
          document_number?: string
          document_type?: string
          id?: string
          issue_date?: string | null
          matched?: boolean
          operation_type?: string
          party_name?: string | null
          party_tax_id?: string
          rcv_reconciliation_run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rcv_reconciliation_items_rcv_reconciliation_run_id_fkey"
            columns: ["rcv_reconciliation_run_id"]
            isOneToOne: false
            referencedRelation: "rcv_reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      rcv_reconciliation_runs: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          file_name: string | null
          id: string
          matched_items: number
          period_end: string
          period_start: string
          total_items: number
          unmatched_items: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          file_name?: string | null
          id?: string
          matched_items?: number
          period_end: string
          period_start: string
          total_items?: number
          unmatched_items?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          file_name?: string | null
          id?: string
          matched_items?: number
          period_end?: string
          period_start?: string
          total_items?: number
          unmatched_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "rcv_reconciliation_runs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
          description: string | null
          id: string
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          item_id: string | null
          line_total: number
          qty: number
          sales_invoice_id: string
          tax_rate: number
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_id?: string | null
          line_total?: number
          qty?: number
          sales_invoice_id: string
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_id?: string | null
          line_total?: number
          qty?: number
          sales_invoice_id?: string
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          business_unit_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          due_date: string | null
          entity_id: string
          exchange_rate: number
          id: string
          invoice_number: string | null
          issue_date: string
          journal_entry_id: string | null
          memo: string | null
          party_id: string
          pos_session_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          warehouse_id: string | null
        }
        Insert: {
          business_unit_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_date?: string | null
          entity_id: string
          exchange_rate?: number
          id?: string
          invoice_number?: string | null
          issue_date: string
          journal_entry_id?: string | null
          memo?: string | null
          party_id: string
          pos_session_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          warehouse_id?: string | null
        }
        Update: {
          business_unit_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_date?: string | null
          entity_id?: string
          exchange_rate?: number
          id?: string
          invoice_number?: string | null
          issue_date?: string
          journal_entry_id?: string | null
          memo?: string | null
          party_id?: string
          pos_session_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_invoices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sii_api_connections: {
        Row: {
          active: boolean
          company_token: string
          created_at: string
          entity_id: string
          id: string
          last_synced_at: string | null
          provider: string
        }
        Insert: {
          active?: boolean
          company_token: string
          created_at?: string
          entity_id: string
          id?: string
          last_synced_at?: string | null
          provider?: string
        }
        Update: {
          active?: boolean
          company_token?: string
          created_at?: string
          entity_id?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "sii_api_connections_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sii_boletas_summary: {
        Row: {
          cantidad_documentos: number | null
          entity_id: string
          extracted_at: string | null
          id: string
          monto_exento: number | null
          monto_iva: number | null
          monto_neto: number | null
          monto_total: number | null
          period: string
          synced_at: string
        }
        Insert: {
          cantidad_documentos?: number | null
          entity_id: string
          extracted_at?: string | null
          id?: string
          monto_exento?: number | null
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number | null
          period: string
          synced_at?: string
        }
        Update: {
          cantidad_documentos?: number | null
          entity_id?: string
          extracted_at?: string | null
          id?: string
          monto_exento?: number | null
          monto_iva?: number | null
          monto_neto?: number | null
          monto_total?: number | null
          period?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sii_boletas_summary_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sii_book_exports: {
        Row: {
          book_type: Database["public"]["Enums"]["sii_book_type"]
          entity_id: string
          file_content: string | null
          file_format: string
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          record_count: number
          total_credit: number
          total_debit: number
        }
        Insert: {
          book_type: Database["public"]["Enums"]["sii_book_type"]
          entity_id: string
          file_content?: string | null
          file_format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          record_count?: number
          total_credit?: number
          total_debit?: number
        }
        Update: {
          book_type?: Database["public"]["Enums"]["sii_book_type"]
          entity_id?: string
          file_content?: string | null
          file_format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          record_count?: number
          total_credit?: number
          total_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "sii_book_exports_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sii_sync_jobs: {
        Row: {
          apipyme_task_id: string | null
          completed_at: string | null
          entity_id: string
          error_message: string | null
          id: string
          module: string
          period: string
          requested_at: string
          rows_extracted: number | null
          status: Database["public"]["Enums"]["sii_sync_status"]
        }
        Insert: {
          apipyme_task_id?: string | null
          completed_at?: string | null
          entity_id: string
          error_message?: string | null
          id?: string
          module: string
          period: string
          requested_at?: string
          rows_extracted?: number | null
          status?: Database["public"]["Enums"]["sii_sync_status"]
        }
        Update: {
          apipyme_task_id?: string | null
          completed_at?: string | null
          entity_id?: string
          error_message?: string | null
          id?: string
          module?: string
          period?: string
          requested_at?: string
          rows_extracted?: number | null
          status?: Database["public"]["Enums"]["sii_sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sii_sync_jobs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sii_synced_documents: {
        Row: {
          document_type: Database["public"]["Enums"]["sii_document_type"]
          entity_id: string
          exempt_amount: number | null
          extracted_at: string | null
          folio: string | null
          id: string
          issue_date: string | null
          net_amount: number | null
          party_name: string | null
          party_tax_id: string | null
          period: string
          raw_payload: Json
          sii_doc_type: string | null
          synced_at: string
          tax_amount: number | null
          total_amount: number | null
        }
        Insert: {
          document_type: Database["public"]["Enums"]["sii_document_type"]
          entity_id: string
          exempt_amount?: number | null
          extracted_at?: string | null
          folio?: string | null
          id?: string
          issue_date?: string | null
          net_amount?: number | null
          party_name?: string | null
          party_tax_id?: string | null
          period: string
          raw_payload?: Json
          sii_doc_type?: string | null
          synced_at?: string
          tax_amount?: number | null
          total_amount?: number | null
        }
        Update: {
          document_type?: Database["public"]["Enums"]["sii_document_type"]
          entity_id?: string
          exempt_amount?: number | null
          extracted_at?: string | null
          folio?: string | null
          id?: string
          issue_date?: string | null
          net_amount?: number | null
          party_name?: string | null
          party_tax_id?: string | null
          period?: string
          raw_payload?: Json
          sii_doc_type?: string | null
          synced_at?: string
          tax_amount?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sii_synced_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          item_id: string
          location_id: string | null
          lot_number: string | null
          memo: string | null
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          party_id: string | null
          posting_date: string
          qc_notes: string | null
          qty_change: number
          transfer_pair_id: string | null
          valuation_rate: number
          voucher_id: string | null
          voucher_type: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          item_id: string
          location_id?: string | null
          lot_number?: string | null
          memo?: string | null
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          party_id?: string | null
          posting_date: string
          qc_notes?: string | null
          qty_change: number
          transfer_pair_id?: string | null
          valuation_rate?: number
          voucher_id?: string | null
          voucher_type?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          item_id?: string
          location_id?: string | null
          lot_number?: string | null
          memo?: string | null
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          party_id?: string | null
          posting_date?: string
          qc_notes?: string | null
          qty_change?: number
          transfer_pair_id?: string | null
          valuation_rate?: number
          voucher_id?: string | null
          voucher_type?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_valuation_layers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          qty_remaining: number
          rate: number
          stock_ledger_entry_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          qty_remaining: number
          rate: number
          stock_ledger_entry_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          qty_remaining?: number
          rate?: number
          stock_ledger_entry_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_valuation_layers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_valuation_layers_stock_ledger_entry_id_fkey"
            columns: ["stock_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "stock_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_valuation_layers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          description: string
          entity_id: string
          id: string
          tax_calculation_run_id: string | null
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          description: string
          entity_id: string
          id?: string
          tax_calculation_run_id?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          description?: string
          entity_id?: string
          id?: string
          tax_calculation_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_adjustments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_adjustments_tax_calculation_run_id_fkey"
            columns: ["tax_calculation_run_id"]
            isOneToOne: false
            referencedRelation: "tax_calculation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_calculation_runs: {
        Row: {
          calculated_values: Json
          created_at: string
          created_by: string | null
          entity_id: string
          filed_at: string | null
          form_type: Database["public"]["Enums"]["tax_form_type"]
          id: string
          notes: string | null
          period_end: string
          period_start: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["tax_calculation_status"]
        }
        Insert: {
          calculated_values?: Json
          created_at?: string
          created_by?: string | null
          entity_id: string
          filed_at?: string | null
          form_type: Database["public"]["Enums"]["tax_form_type"]
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tax_calculation_status"]
        }
        Update: {
          calculated_values?: Json
          created_at?: string
          created_by?: string | null
          entity_id?: string
          filed_at?: string | null
          form_type?: Database["public"]["Enums"]["tax_form_type"]
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tax_calculation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tax_calculation_runs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_active?: boolean
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
      warehouse_locations: {
        Row: {
          code: string
          created_at: string
          entity_id: string
          id: string
          is_active: boolean
          name: string | null
          warehouse_id: string
        }
        Insert: {
          code: string
          created_at?: string
          entity_id: string
          id?: string
          is_active?: boolean
          name?: string | null
          warehouse_id: string
        }
        Update: {
          code?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          name?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      purchase_invoice_balances: {
        Row: {
          balance_due: number | null
          currency_code: string | null
          due_date: string | null
          entity_id: string | null
          id: string | null
          invoice_number: string | null
          issue_date: string | null
          paid_amount: number | null
          party_id: string | null
          party_name: string | null
          party_tax_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "purchase_invoices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_balances: {
        Row: {
          balance_due: number | null
          currency_code: string | null
          due_date: string | null
          entity_id: string | null
          id: string | null
          invoice_number: string | null
          issue_date: string | null
          paid_amount: number | null
          party_id: string | null
          party_name: string | null
          party_tax_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_invoices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          code: string
          created_at: string
          entity_id: string
          id: string
          is_active: boolean
          name: string | null
          warehouse_id: string
        }
        Insert: {
          code: string
          created_at?: string
          entity_id: string
          id?: string
          is_active?: boolean
          name?: string | null
          warehouse_id: string
        }
        Update: {
          code?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          name?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      party_warehouses: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          party_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          party_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          party_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_warehouses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_warehouses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_warehouses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_notes: {
        Row: {
          arrival_at: string | null
          carrier_name: string
          carrier_tax_id: string
          created_at: string
          created_by: string | null
          departure_at: string
          destination_address: string
          dispatch_number: string | null
          entity_id: string
          id: string
          notes: string | null
          origin_address: string
          party_id: string
          status: Database["public"]["Enums"]["dispatch_status"]
          transfer_type: Database["public"]["Enums"]["dispatch_transfer_type"]
          updated_at: string
          vehicle_plate: string
          warehouse_id: string
        }
        Insert: {
          arrival_at?: string | null
          carrier_name: string
          carrier_tax_id: string
          created_at?: string
          created_by?: string | null
          departure_at: string
          destination_address: string
          dispatch_number?: string | null
          entity_id: string
          id?: string
          notes?: string | null
          origin_address: string
          party_id: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          transfer_type: Database["public"]["Enums"]["dispatch_transfer_type"]
          updated_at?: string
          vehicle_plate: string
          warehouse_id: string
        }
        Update: {
          arrival_at?: string | null
          carrier_name?: string
          carrier_tax_id?: string
          created_at?: string
          created_by?: string | null
          departure_at?: string
          destination_address?: string
          dispatch_number?: string | null
          entity_id?: string
          id?: string
          notes?: string | null
          origin_address?: string
          party_id?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          transfer_type?: Database["public"]["Enums"]["dispatch_transfer_type"]
          updated_at?: string
          vehicle_plate?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_notes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_note_lines: {
        Row: {
          dispatch_note_id: string
          id: string
          item_id: string
          location_id: string | null
          lot_number: string | null
          packed: boolean
          packed_at: string | null
          picked: boolean
          picked_at: string | null
          qty: number
          unit_value: number | null
          uom: string | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          dispatch_note_id: string
          id?: string
          item_id: string
          location_id?: string | null
          lot_number?: string | null
          packed?: boolean
          packed_at?: string | null
          picked?: boolean
          picked_at?: string | null
          qty: number
          unit_value?: number | null
          uom?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          dispatch_note_id?: string
          id?: string
          item_id?: string
          location_id?: string | null
          lot_number?: string | null
          packed?: boolean
          packed_at?: string | null
          picked?: boolean
          picked_at?: string | null
          qty?: number
          unit_value?: number | null
          uom?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_note_lines_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_note_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      foreign_trade_operations: {
        Row: {
          booking_number: string | null
          country_code: string | null
          created_at: string
          customs_status: Database["public"]["Enums"]["ft_customs_status"]
          dispatch_note_id: string | null
          dus_number: string | null
          entity_id: string
          id: string
          notes: string | null
          operation_type: Database["public"]["Enums"]["ft_operation_type"]
          party_id: string
          updated_at: string
        }
        Insert: {
          booking_number?: string | null
          country_code?: string | null
          created_at?: string
          customs_status?: Database["public"]["Enums"]["ft_customs_status"]
          dispatch_note_id?: string | null
          dus_number?: string | null
          entity_id: string
          id?: string
          notes?: string | null
          operation_type: Database["public"]["Enums"]["ft_operation_type"]
          party_id: string
          updated_at?: string
        }
        Update: {
          booking_number?: string | null
          country_code?: string | null
          created_at?: string
          customs_status?: Database["public"]["Enums"]["ft_customs_status"]
          dispatch_note_id?: string | null
          dus_number?: string | null
          entity_id?: string
          id?: string
          notes?: string | null
          operation_type?: Database["public"]["Enums"]["ft_operation_type"]
          party_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foreign_trade_operations_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foreign_trade_operations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foreign_trade_operations_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      foreign_trade_certificates: {
        Row: {
          certificate_number: string | null
          certificate_type: string
          created_at: string
          id: string
          issued_by: string | null
          operation_id: string
          valid_until: string | null
        }
        Insert: {
          certificate_number?: string | null
          certificate_type: string
          created_at?: string
          id?: string
          issued_by?: string | null
          operation_id: string
          valid_until?: string | null
        }
        Update: {
          certificate_number?: string | null
          certificate_type?: string
          created_at?: string
          id?: string
          issued_by?: string | null
          operation_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foreign_trade_certificates_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "foreign_trade_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          avg_rate: number | null
          entity_id: string | null
          item_code: string | null
          item_id: string | null
          item_name: string | null
          location_code: string | null
          location_id: string | null
          location_name: string | null
          party_id: string | null
          party_name: string | null
          party_tax_id: string | null
          qty_on_hand: number | null
          value_on_hand: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_entries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          capacity_kg: number | null
          capacity_m3: number | null
          created_at: string
          entity_id: string
          id: string
          plate: string
          vehicle_type: string | null
        }
        Insert: {
          active?: boolean
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          entity_id: string
          id?: string
          plate: string
          vehicle_type?: string | null
        }
        Update: {
          active?: boolean
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          entity_id?: string
          id?: string
          plate?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          driver_name: string | null
          entity_id: string
          id: string
          name: string | null
          notes: string | null
          route_date: string
          status: Database["public"]["Enums"]["route_status"]
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          driver_name?: string | null
          entity_id: string
          id?: string
          name?: string | null
          notes?: string | null
          route_date: string
          status?: Database["public"]["Enums"]["route_status"]
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          driver_name?: string | null
          entity_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          route_date?: string
          status?: Database["public"]["Enums"]["route_status"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          arrived_at: string | null
          created_at: string
          delivery_notes: string | null
          delivery_status: Database["public"]["Enums"]["stop_delivery_status"]
          dispatch_note_id: string
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          received_by: string | null
          route_id: string
          stop_order: number
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_status?: Database["public"]["Enums"]["stop_delivery_status"]
          dispatch_note_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          received_by?: string | null
          route_id: string
          stop_order: number
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_status?: Database["public"]["Enums"]["stop_delivery_status"]
          dispatch_note_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          received_by?: string | null
          route_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      party_portal_users: {
        Row: {
          created_at: string
          id: string
          party_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          party_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_portal_users_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_webhook_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          party_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          party_id: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          party_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_webhook_tokens_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          external_sku: string | null
          id: string
          item_id: string | null
          qty: number
          sales_order_id: string
        }
        Insert: {
          external_sku?: string | null
          id?: string
          item_id?: string | null
          qty: number
          sales_order_id: string
        }
        Update: {
          external_sku?: string | null
          id?: string
          item_id?: string | null
          qty?: number
          sales_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          channel: string
          created_at: string
          destination_address: string | null
          dispatch_note_id: string | null
          entity_id: string
          external_order_id: string | null
          id: string
          notes: string | null
          party_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          destination_address?: string | null
          dispatch_note_id?: string | null
          entity_id: string
          external_order_id?: string | null
          id?: string
          notes?: string | null
          party_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          destination_address?: string | null
          dispatch_note_id?: string | null
          entity_id?: string
          external_order_id?: string | null
          id?: string
          notes?: string | null
          party_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_party_portal_user: {
        Args: {
          p_email: string
          p_party_id: string
        }
        Returns: Json
      }
      calculate_f22: {
        Args: { _entity_id: string; _period_end: string; _period_start: string }
        Returns: Json
      }
      calculate_f29: {
        Args: { _entity_id: string; _period_end: string; _period_start: string }
        Returns: Json
      }
      close_accounting_period: { Args: { _period_id: string }; Returns: Json }
      close_pos_session: {
        Args: { _counted_amount: number; _session_id: string }
        Returns: Json
      }
      complete_production_order: { Args: { _order_id: string }; Returns: Json }
      create_pos_sale: {
        Args: {
          _items: Json
          _party_id: string
          _payments: Json
          _session_id: string
        }
        Returns: Json
      }
      create_warehouse_transfer: {
        Args: {
          _entity_id: string
          _from_warehouse: string
          _item_id: string
          _memo?: string
          _posting_date: string
          _qty: number
          _to_warehouse: string
        }
        Returns: Json
      }
      dispose_fixed_asset: {
        Args: {
          _asset_id: string
          _bank_account_id?: string
          _disposal_date: string
          _disposal_value: number
          _gain_loss_account_id: string
        }
        Returns: Json
      }
      generate_dj: {
        Args: {
          _dj_definition_id: string
          _entity_id: string
          _tax_year: number
        }
        Returns: Json
      }
      get_party_portal_users: {
        Args: {
          p_party_id: string
        }
        Returns: {
          created_at: string
          email: string
          id: string
          party_id: string
          user_id: string
        }[]
      }
      get_exchange_rate: {
        Args: { _date: string; _destination: string; _origin: string }
        Returns: number
      }
      get_next_entry_number: {
        Args: { _entity_id: string; _prefix?: string }
        Returns: string
      }
      get_sii_book_data: {
        Args: {
          _book_type: Database["public"]["Enums"]["sii_book_type"]
          _end_date: string
          _entity_id: string
          _start_date: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ingest_oms_order: {
        Args: {
          p_channel?: string
          p_destination_address?: string
          p_external_order_id: string
          p_lines: Json
          p_notes?: string
          p_token: string
        }
        Returns: Json
      }
      post_journal_entry: { Args: { _journal_entry_id: string }; Returns: Json }
      post_purchase_invoice: { Args: { _invoice_id: string }; Returns: Json }
      post_sales_invoice: { Args: { _invoice_id: string }; Returns: Json }
      reconcile_rcv_batch: {
        Args: {
          _entity_id: string
          _file_name: string
          _period_end: string
          _period_start: string
          _rcv_rows: Json
        }
        Returns: Json
      }
      reverse_journal_entry: {
        Args: { _journal_entry_id: string }
        Returns: string
      }
      run_exchange_revaluation: {
        Args: { _entity_id: string; _revaluation_date: string }
        Returns: Json
      }
      run_monthly_depreciation: {
        Args: { _entity_id: string; _period_date: string }
        Returns: Json
      }
      update_dj_status: {
        Args: {
          _generation_id: string
          _new_status: Database["public"]["Enums"]["dj_generation_status"]
        }
        Returns: Json
      }
      update_tax_run_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["tax_calculation_status"]
          _notes?: string
          _run_id: string
        }
        Returns: Json
      }
      user_has_company_access: {
        Args: { _entity_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_party_access: {
        Args: { check_party_id: string }
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
      asset_status: "active" | "fully_depreciated" | "disposed"
      depreciation_method: "linea_recta" | "acelerada"
      dispatch_status: "draft" | "issued" | "cancelled"
      dispatch_transfer_type:
        | "venta"
        | "traslado_interno"
        | "consignacion"
        | "exportacion"
        | "otro"
      dj_generation_status: "draft" | "reviewed" | "filed"
      ft_customs_status: "pendiente" | "tramitando" | "autorizado" | "rechazado"
      ft_operation_type: "exportacion" | "importacion"
      invoice_status:
        | "draft"
        | "confirmed"
        | "partially_paid"
        | "paid"
        | "cancelled"
      journal_entry_status: "draft" | "posted" | "reversed"
      order_status: "pendiente" | "procesado" | "cancelado"
      period_status: "open" | "closed"
      pos_payment_method:
        | "efectivo"
        | "tarjeta_debito"
        | "tarjeta_credito"
        | "transferencia"
        | "otro"
      pos_session_status: "open" | "closed"
      production_order_status:
        | "planned"
        | "in_progress"
        | "completed"
        | "cancelled"
      route_status: "planificada" | "en_curso" | "finalizada" | "cancelada"
      stop_delivery_status:
        | "pendiente"
        | "en_ruta"
        | "entregado"
        | "no_entregado"
      sii_book_type:
        | "libro_diario"
        | "libro_mayor"
        | "balance_tributario_8_columnas"
        | "libro_compras"
        | "libro_ventas"
      sii_document_type: "venta" | "compra"
      sii_sync_status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED"
      stock_movement_type:
        | "receipt"
        | "issue"
        | "transfer_out"
        | "transfer_in"
        | "adjustment"
      tax_calculation_status: "draft" | "reviewed" | "filed"
      tax_form_type: "f29" | "f22"
      tax_regime_type:
        | "14A_general"
        | "14D3_pro_pyme_general"
        | "14D8_pro_pyme_transparente"
        | "renta_presunta"
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
      app_role: [
        "admin",
        "accountant",
        "sales",
        "purchasing",
        "inventory",
        "viewer",
      ],
      asset_status: ["active", "fully_depreciated", "disposed"],
      depreciation_method: ["linea_recta", "acelerada"],
      dispatch_status: ["draft", "issued", "cancelled"],
      dispatch_transfer_type: [
        "venta",
        "traslado_interno",
        "consignacion",
        "exportacion",
        "otro",
      ],
      dj_generation_status: ["draft", "reviewed", "filed"],
      ft_customs_status: [
        "pendiente",
        "tramitando",
        "autorizado",
        "rechazado",
      ],
      ft_operation_type: ["exportacion", "importacion"],
      invoice_status: [
        "draft",
        "confirmed",
        "partially_paid",
        "paid",
        "cancelled",
      ],
      journal_entry_status: ["draft", "posted", "reversed"],
      order_status: ["pendiente", "procesado", "cancelado"],
      period_status: ["open", "closed"],
      pos_payment_method: [
        "efectivo",
        "tarjeta_debito",
        "tarjeta_credito",
        "transferencia",
        "otro",
      ],
      pos_session_status: ["open", "closed"],
      production_order_status: [
        "planned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      route_status: ["planificada", "en_curso", "finalizada", "cancelada"],
      stop_delivery_status: [
        "pendiente",
        "en_ruta",
        "entregado",
        "no_entregado",
      ],
      sii_book_type: [
        "libro_diario",
        "libro_mayor",
        "balance_tributario_8_columnas",
        "libro_compras",
        "libro_ventas",
      ],
      sii_document_type: ["venta", "compra"],
      sii_sync_status: ["PENDING", "RUNNING", "SUCCESS", "FAILED"],
      stock_movement_type: [
        "receipt",
        "issue",
        "transfer_out",
        "transfer_in",
        "adjustment",
      ],
      tax_calculation_status: ["draft", "reviewed", "filed"],
      tax_form_type: ["f29", "f22"],
      tax_regime_type: [
        "14A_general",
        "14D3_pro_pyme_general",
        "14D8_pro_pyme_transparente",
        "renta_presunta",
      ],
    },
  },
} as const
