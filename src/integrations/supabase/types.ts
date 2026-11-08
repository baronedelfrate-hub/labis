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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      barcode_sectors: {
        Row: {
          code: number
          company_id: string
          created_at: string
          id: string
          sector: string
          updated_at: string
        }
        Insert: {
          code: number
          company_id: string
          created_at?: string
          id?: string
          sector: string
          updated_at?: string
        }
        Update: {
          code?: number
          company_id?: string
          created_at?: string
          id?: string
          sector?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barcode_sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_batch_items: {
        Row: {
          billing_batch_id: string
          created_at: string
          glosa_codigo: string | null
          glosa_reason: string | null
          glosa_value: number
          id: string
          order_id: string
          updated_at: string
          value: number
        }
        Insert: {
          billing_batch_id: string
          created_at?: string
          glosa_codigo?: string | null
          glosa_reason?: string | null
          glosa_value?: number
          id?: string
          order_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          billing_batch_id?: string
          created_at?: string
          glosa_codigo?: string | null
          glosa_reason?: string | null
          glosa_value?: number
          id?: string
          order_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_batch_items_billing_batch_id_fkey"
            columns: ["billing_batch_id"]
            isOneToOne: false
            referencedRelation: "billing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_batch_items_glosa_codigo_fkey"
            columns: ["glosa_codigo"]
            isOneToOne: false
            referencedRelation: "tiss_glosa_codes"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "billing_batch_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_batches: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          id: string
          insurance_plan_id: string
          opened_at: string
          reference_month: string
          status: Database["public"]["Enums"]["billing_batch_status"]
          total_value: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          insurance_plan_id: string
          opened_at?: string
          reference_month: string
          status?: Database["public"]["Enums"]["billing_batch_status"]
          total_value?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          insurance_plan_id?: string
          opened_at?: string
          reference_month?: string
          status?: Database["public"]["Enums"]["billing_batch_status"]
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_batches_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cid10: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          cnpj: string | null
          created_at: string
          id: string
          name: string
          next_order_number: number
          next_patient_code: number
          plan: string
          portal_slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          next_order_number?: number
          next_patient_code?: number
          plan?: string
          portal_slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          next_order_number?: number
          next_patient_code?: number
          plan?: string
          portal_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          cnes: string | null
          cnpj: string | null
          company_id: string
          created_at: string
          email: string | null
          footer_note: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          responsible_tech_council: string | null
          responsible_tech_name: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnes?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          footer_note?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          responsible_tech_council?: string | null
          responsible_tech_name?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnes?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          footer_note?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          responsible_tech_council?: string | null
          responsible_tech_name?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          company_id: string
          created_at: string
          crm: string
          crm_uf: string
          email: string | null
          id: string
          name: string
          phone: string | null
          tiss_cbos: string | null
          tiss_conselho: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          crm: string
          crm_uf: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tiss_cbos?: string | null
          tiss_conselho?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          crm?: string
          crm_uf?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tiss_cbos?: string | null
          tiss_conselho?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_tiss_conselho_fkey"
            columns: ["tiss_conselho"]
            isOneToOne: false
            referencedRelation: "tiss_conselhos_profissionais"
            referencedColumns: ["codigo"]
          },
        ]
      }
      exam_group_items: {
        Row: {
          company_id: string
          created_at: string
          exam_group_id: string
          exam_id: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          exam_group_id: string
          exam_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          exam_group_id?: string
          exam_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_group_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_group_items_exam_group_id_fkey"
            columns: ["exam_group_id"]
            isOneToOne: false
            referencedRelation: "exam_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_group_items_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_groups: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_parameters: {
        Row: {
          code: string | null
          created_at: string
          display_order: number
          exam_id: string
          group_label: string | null
          id: string
          name: string
          unit: string | null
          updated_at: string
          value_type: Database["public"]["Enums"]["exam_value_type"]
          decimals: number | null
          formula: string | null
          counts_as_result: boolean
          extra_line_after: string | null
          extra_line_before: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          display_order?: number
          exam_id: string
          group_label?: string | null
          id?: string
          name: string
          unit?: string | null
          updated_at?: string
          value_type?: Database["public"]["Enums"]["exam_value_type"]
          decimals?: number | null
          formula?: string | null
          counts_as_result?: boolean
          extra_line_after?: string | null
          extra_line_before?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          display_order?: number
          exam_id?: string
          group_label?: string | null
          id?: string
          name?: string
          unit?: string | null
          updated_at?: string
          value_type?: Database["public"]["Enums"]["exam_value_type"]
          decimals?: number | null
          formula?: string | null
          counts_as_result?: boolean
          extra_line_after?: string | null
          extra_line_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_parameters_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          code: string
          company_id: string
          created_at: string
          deadline_days: number
          default_method: string | null
          fasting_hours: number
          id: string
          is_urgent_allowed: boolean
          material: string | null
          name: string
          preparation_instructions: string | null
          price_sector: string | null
          support_lab_id: string | null
          tech_sector: string | null
          sector: string | null
          standard_notes: string | null
          tiss_codigo_procedimento: string | null
          updated_at: string
          is_text: boolean
          labels_per_sample: number
          samples_count: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          deadline_days?: number
          default_method?: string | null
          fasting_hours?: number
          id?: string
          is_urgent_allowed?: boolean
          material?: string | null
          name: string
          preparation_instructions?: string | null
          price_sector?: string | null
          support_lab_id?: string | null
          tech_sector?: string | null
          sector?: string | null
          standard_notes?: string | null
          tiss_codigo_procedimento?: string | null
          updated_at?: string
          is_text?: boolean
          labels_per_sample?: number
          samples_count?: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          deadline_days?: number
          default_method?: string | null
          fasting_hours?: number
          id?: string
          is_urgent_allowed?: boolean
          material?: string | null
          name?: string
          preparation_instructions?: string | null
          price_sector?: string | null
          support_lab_id?: string | null
          tech_sector?: string | null
          sector?: string | null
          standard_notes?: string | null
          tiss_codigo_procedimento?: string | null
          updated_at?: string
          is_text?: boolean
          labels_per_sample?: number
          samples_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_plans: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          id: string
          is_particular: boolean
          name: string
          price_table_id: string
          tiss_codigo_ans: string | null
          tiss_tabela: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_particular?: boolean
          name: string
          price_table_id: string
          tiss_codigo_ans?: string | null
          tiss_tabela?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_particular?: boolean
          name?: string
          price_table_id?: string
          tiss_codigo_ans?: string | null
          tiss_tabela?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_plans_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_plans_tiss_tabela_fkey"
            columns: ["tiss_tabela"]
            isOneToOne: false
            referencedRelation: "tiss_tabelas_referencia"
            referencedColumns: ["codigo"]
          },
        ]
      }
      invitations: {
        Row: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_samples: {
        Row: {
          company_id: string
          order_item_id: string
          sample_id: string
        }
        Insert: {
          company_id: string
          order_item_id: string
          sample_id: string
        }
        Update: {
          company_id?: string
          order_item_id?: string
          sample_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_samples_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_samples_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_samples_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string
          created_at: string
          exam_id: string
          id: string
          order_id: string
          price: number
          sample_id: string | null
          status: Database["public"]["Enums"]["order_item_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          exam_id: string
          id?: string
          order_id: string
          price?: number
          sample_id?: string | null
          status?: Database["public"]["Enums"]["order_item_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          order_id?: string
          price?: number
          sample_id?: string | null
          status?: Database["public"]["Enums"]["order_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_batch_id: string | null
          collection_date: string | null
          company_id: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivered_by: string | null
          delivered_to: string | null
          delivery_date: string | null
          doctor_id: string | null
          id: string
          insurance_plan_id: string | null
          is_urgent: boolean
          notes: string | null
          order_date: string
          order_number: number
          patient_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          total_value: number
          unit_id: string | null
          updated_at: string
          cid10_code: string | null
        }
        Insert: {
          billing_batch_id?: string | null
          collection_date?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivered_to?: string | null
          delivery_date?: string | null
          doctor_id?: string | null
          id?: string
          insurance_plan_id?: string | null
          is_urgent?: boolean
          notes?: string | null
          order_date?: string
          order_number: number
          patient_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_value?: number
          unit_id?: string | null
          updated_at?: string
          cid10_code?: string | null
        }
        Update: {
          billing_batch_id?: string | null
          collection_date?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivered_to?: string | null
          delivery_date?: string | null
          doctor_id?: string | null
          id?: string
          insurance_plan_id?: string | null
          is_urgent?: boolean
          notes?: string | null
          order_date?: string
          order_number?: number
          patient_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_value?: number
          unit_id?: string | null
          updated_at?: string
          cid10_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_billing_batch_id_fkey"
            columns: ["billing_batch_id"]
            isOneToOne: false
            referencedRelation: "billing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          city: string | null
          code: string
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          rg: string | null
          sex: Database["public"]["Enums"]["patient_sex"] | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          code: string
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          rg?: string | null
          sex?: Database["public"]["Enums"]["patient_sex"] | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          code?: string
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          rg?: string | null
          sex?: Database["public"]["Enums"]["patient_sex"] | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          billing_batch_id: string | null
          company_id: string
          created_at: string
          id: string
          installment_number: number
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          order_id: string | null
          paid_at: string
          received_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_batch_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          installment_number?: number
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          received_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_batch_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          installment_number?: number
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          received_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_batch_id_fkey"
            columns: ["billing_batch_id"]
            isOneToOne: false
            referencedRelation: "billing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_access: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          failed_attempts: number
          id: string
          locked_until: string | null
          order_id: string
          pin_hash: string
          public_code: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          order_id: string
          pin_hash: string
          public_code: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          order_id?: string
          pin_hash?: string
          public_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_table_items: {
        Row: {
          company_id: string
          created_at: string
          exam_id: string
          id: string
          price: number
          price_table_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          exam_id: string
          id?: string
          price?: number
          price_table_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          price?: number
          price_table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_table_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_table_items_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_table_items_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tables: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          legacy_code: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          legacy_code?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          legacy_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          full_name: string
          id: string
          professional_council: string | null
          professional_registration: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          full_name?: string
          id: string
          professional_council?: string | null
          professional_registration?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          full_name?: string
          id?: string
          professional_council?: string | null
          professional_registration?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_professional_council_fkey"
            columns: ["professional_council"]
            isOneToOne: false
            referencedRelation: "tiss_conselhos_profissionais"
            referencedColumns: ["codigo"]
          },
        ]
      }
      reference_ranges: {
        Row: {
          age_max_months: number | null
          age_min_months: number | null
          category_label: string | null
          company_id: string
          created_at: string
          display_text: string
          effective_from: string | null
          exam_id: string | null
          exam_parameter_id: string | null
          id: string
          needs_review: boolean
          range_max: number | null
          range_min: number | null
          sex: Database["public"]["Enums"]["sex_type"] | null
          updated_at: string
          panic_max: number | null
          panic_min: number | null
        }
        Insert: {
          age_max_months?: number | null
          age_min_months?: number | null
          category_label?: string | null
          company_id: string
          created_at?: string
          display_text: string
          effective_from?: string | null
          exam_id?: string | null
          exam_parameter_id?: string | null
          id?: string
          needs_review?: boolean
          range_max?: number | null
          range_min?: number | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
          updated_at?: string
          panic_max?: number | null
          panic_min?: number | null
        }
        Update: {
          age_max_months?: number | null
          age_min_months?: number | null
          category_label?: string | null
          company_id?: string
          created_at?: string
          display_text?: string
          effective_from?: string | null
          exam_id?: string | null
          exam_parameter_id?: string | null
          id?: string
          needs_review?: boolean
          range_max?: number | null
          range_min?: number | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
          updated_at?: string
          panic_max?: number | null
          panic_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_ranges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_ranges_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_ranges_exam_parameter_id_fkey"
            columns: ["exam_parameter_id"]
            isOneToOne: false
            referencedRelation: "exam_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      result_values: {
        Row: {
          created_at: string
          exam_parameter_id: string | null
          id: string
          reference_display_text: string | null
          reference_max: number | null
          reference_min: number | null
          result_id: string
          unit: string | null
          value: string
          panic_max: number | null
          panic_min: number | null
          extra_after: string | null
          extra_before: string | null
        }
        Insert: {
          created_at?: string
          exam_parameter_id?: string | null
          id?: string
          reference_display_text?: string | null
          reference_max?: number | null
          reference_min?: number | null
          result_id: string
          unit?: string | null
          value: string
          panic_max?: number | null
          panic_min?: number | null
          extra_after?: string | null
          extra_before?: string | null
        }
        Update: {
          created_at?: string
          exam_parameter_id?: string | null
          id?: string
          reference_display_text?: string | null
          reference_max?: number | null
          reference_min?: number | null
          result_id?: string
          unit?: string | null
          value?: string
          panic_max?: number | null
          panic_min?: number | null
          extra_after?: string | null
          extra_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_values_exam_parameter_id_fkey"
            columns: ["exam_parameter_id"]
            isOneToOne: false
            referencedRelation: "exam_parameters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_values_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
        ]
      }
      result_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          exam_id: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          exam_id?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          exam_id?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_templates_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          company_id: string
          created_at: string
          entered_at: string
          entered_by: string | null
          id: string
          method: string | null
          observation: string | null
          order_item_id: string
          reference_max: number | null
          reference_min: number | null
          released: boolean
          released_at: string | null
          released_by: string | null
          reviewed_by: string | null
          unit: string | null
          updated_at: string
          value: string
          panic_max: number | null
          panic_min: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          id?: string
          method?: string | null
          observation?: string | null
          order_item_id: string
          reference_max?: number | null
          reference_min?: number | null
          released?: boolean
          released_at?: string | null
          released_by?: string | null
          reviewed_by?: string | null
          unit?: string | null
          updated_at?: string
          value: string
          panic_max?: number | null
          panic_min?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          id?: string
          method?: string | null
          observation?: string | null
          order_item_id?: string
          reference_max?: number | null
          reference_min?: number | null
          released?: boolean
          released_at?: string | null
          released_by?: string | null
          reviewed_by?: string | null
          unit?: string | null
          updated_at?: string
          value?: string
          panic_max?: number | null
          panic_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_events: {
        Row: {
          company_id: string
          created_at: string
          event: string
          id: string
          order_id: string
          sample_id: string
          sector: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          event: string
          id?: string
          order_id: string
          sample_id: string
          sector?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          event?: string
          id?: string
          order_id?: string
          sample_id?: string
          sector?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sample_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_events_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      samples: {
        Row: {
          collected_at: string | null
          collected_by: string | null
          company_id: string
          created_at: string
          id: string
          material: string
          order_id: string
          received_at: string | null
          received_by: string | null
          rejection_reason: string | null
          sample_number: number
          sector: string | null
          status: Database["public"]["Enums"]["sample_status"]
          updated_at: string
          material_seq: number
        }
        Insert: {
          collected_at?: string | null
          collected_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          material: string
          order_id: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          sample_number: number
          sector?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          updated_at?: string
          material_seq?: number
        }
        Update: {
          collected_at?: string | null
          collected_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          material?: string
          order_id?: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          sample_number?: number
          sector?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          updated_at?: string
          material_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "samples_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_conselhos_profissionais: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
        }
        Relationships: []
      }
      tiss_glosa_codes: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
        }
        Relationships: []
      }
      tiss_tabelas_referencia: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
        }
        Relationships: []
      }
      support_labs: {
        Row: {
          active: boolean
          company_id: string
          contact: string | null
          created_at: string
          email: string | null
          id: string
          legacy_code: string | null
          name: string
          notes: string | null
          phone: string | null
          turnaround_days: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legacy_code?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          turnaround_days?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legacy_code?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          turnaround_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      support_shipment_items: {
        Row: {
          id: string
          order_item_id: string
          shipment_id: string
        }
        Insert: {
          id?: string
          order_item_id: string
          shipment_id: string
        }
        Update: {
          id?: string
          order_item_id?: string
          shipment_id?: string
        }
        Relationships: []
      }
      support_shipments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          number: number
          sent_at: string
          sent_by: string | null
          support_lab_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          number?: number
          sent_at?: string
          sent_by?: string | null
          support_lab_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          number?: number
          sent_at?: string
          sent_by?: string | null
          support_lab_id?: string
        }
        Relationships: []
      }
      result_corrections: {
        Row: {
          company_id: string
          id: string
          order_item_id: string
          reason: string
          returned_at: string
          returned_by: string | null
          snapshot: Json
        }
        Insert: {
          company_id: string
          id?: string
          order_item_id: string
          reason: string
          returned_at?: string
          returned_by?: string | null
          snapshot: Json
        }
        Update: {
          company_id?: string
          id?: string
          order_item_id?: string
          reason?: string
          returned_at?: string
          returned_by?: string | null
          snapshot?: Json
        }
        Relationships: []
      }
      units: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      xlab_legacy_sectors: {
        Row: {
          code: string
          kind: string
          name: string
        }
        Insert: {
          code: string
          kind: string
          name: string
        }
        Update: {
          code?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      xlab_legacy_exams: {
        Row: {
          amb_code: string | null
          code: string
          days: number | null
          fasting_hours: number | null
          label_group: string | null
          material: string | null
          name: string
          price_sector: string | null
          sector: string | null
          is_text: boolean
        }
        Insert: {
          amb_code?: string | null
          code: string
          days?: number | null
          fasting_hours?: number | null
          label_group?: string | null
          material?: string | null
          name: string
          price_sector?: string | null
          sector?: string | null
          is_text?: boolean
        }
        Update: {
          amb_code?: string | null
          code?: string
          days?: number | null
          fasting_hours?: number | null
          label_group?: string | null
          material?: string | null
          name?: string
          price_sector?: string | null
          sector?: string | null
          is_text?: boolean
        }
        Relationships: []
      }
      xlab_legacy_price_tables: {
        Row: {
          code: string
          name: string
          unit: string
        }
        Insert: {
          code: string
          name: string
          unit: string
        }
        Update: {
          code?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      xlab_legacy_insurances: {
        Row: {
          ans_code: string | null
          code: string
          name: string
          price_factor: number | null
          price_table_code: string | null
          tiss_table: string | null
        }
        Insert: {
          ans_code?: string | null
          code: string
          name: string
          price_factor?: number | null
          price_table_code?: string | null
          tiss_table?: string | null
        }
        Update: {
          ans_code?: string | null
          code?: string
          name?: string
          price_factor?: number | null
          price_table_code?: string | null
          tiss_table?: string | null
        }
        Relationships: []
      }
      xlab_legacy_prices: {
        Row: {
          exam_code: string
          factor: number | null
          price: number | null
          table_code: string
        }
        Insert: {
          exam_code: string
          factor?: number | null
          price?: number | null
          table_code: string
        }
        Update: {
          exam_code?: string
          factor?: number | null
          price?: number | null
          table_code?: string
        }
        Relationships: []
      }
      xlab_legacy_reference_staging: {
        Row: {
          created_at: string
          effective_from: string | null
          exam_code: string
          id: string
          label: string | null
          param_code: string | null
          param_order: number | null
          range_max: number | null
          range_min: number | null
          reference_text: string | null
          sex: string | null
          source: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          exam_code: string
          id?: string
          label?: string | null
          param_code?: string | null
          param_order?: number | null
          range_max?: number | null
          range_min?: number | null
          reference_text?: string | null
          sex?: string | null
          source: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          exam_code?: string
          id?: string
          label?: string | null
          param_code?: string | null
          param_order?: number | null
          range_max?: number | null
          range_min?: number | null
          reference_text?: string | null
          sex?: string | null
          source?: string
          unit?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      return_result_for_correction: { Args: { _reason: string; _result_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      portal_create_access: {
        Args: { _order_id: string }
        Returns: {
          pin: string
          public_code: string
        }[]
      }
      portal_generate_code: { Args: never; Returns: string }
      portal_verify_login: {
        Args: { _code: string; _pin: string }
        Returns: {
          locked_until: string
          order_id: string
          status: string
        }[]
      }
      recompute_order_item_status: {
        Args: { _order_item_id: string }
        Returns: undefined
      }
      recompute_order_payment_status: {
        Args: { _order_id: string }
        Returns: undefined
      }
      recompute_order_status: {
        Args: { _order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "recepcao" | "tecnico" | "bioquimico"
      billing_batch_status:
        | "aberto"
        | "fechado"
        | "enviado"
        | "pago_parcial"
        | "pago"
      exam_value_type: "numeric" | "qualitative" | "text"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      order_item_status: "pendente" | "coletado" | "com_resultado" | "liberado"
      order_status:
        | "aberto"
        | "coletado"
        | "em_analise"
        | "finalizado"
        | "cancelado"
      patient_sex: "M" | "F" | "O"
      payment_method:
        | "dinheiro"
        | "pix"
        | "cartao_debito"
        | "cartao_credito"
        | "boleto"
      payment_status: "pendente" | "parcial" | "pago"
      sample_status: "pendente" | "coletada" | "recebida" | "rejeitada"
      sex_type: "M" | "F"
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
      app_role: ["admin", "recepcao", "tecnico", "bioquimico"],
      billing_batch_status: [
        "aberto",
        "fechado",
        "enviado",
        "pago_parcial",
        "pago",
      ],
      exam_value_type: ["numeric", "qualitative", "text"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      order_item_status: ["pendente", "coletado", "com_resultado", "liberado"],
      order_status: [
        "aberto",
        "coletado",
        "em_analise",
        "finalizado",
        "cancelado",
      ],
      patient_sex: ["M", "F", "O"],
      payment_method: [
        "dinheiro",
        "pix",
        "cartao_debito",
        "cartao_credito",
        "boleto",
      ],
      payment_status: ["pendente", "parcial", "pago"],
      sample_status: ["pendente", "coletada", "recebida", "rejeitada"],
      sex_type: ["M", "F"],
    },
  },
} as const
