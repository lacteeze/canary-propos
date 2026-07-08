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
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          org_id: string
          property_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          org_id: string
          property_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          property_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          org_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          thread_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          thread_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_members: {
        Row: {
          joined_at: string
          person_id: string
          thread_id: string
        }
        Insert: {
          joined_at?: string
          person_id: string
          thread_id: string
        }
        Update: {
          joined_at?: string
          person_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          org_id: string
          property_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["chat_thread_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          org_id: string
          property_id?: string | null
          title?: string | null
          type: Database["public"]["Enums"]["chat_thread_type"]
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          org_id?: string
          property_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["chat_thread_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          checklist_id: string
          id: string
          label: string
          note: string | null
          position: number
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checklist_id: string
          id?: string
          label: string
          note?: string | null
          position?: number
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checklist_id?: string
          id?: string
          label?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lease_id: string
          org_id: string
          submitted_at: string | null
          submitted_by: string | null
          title: string
          type: Database["public"]["Enums"]["checklist_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lease_id: string
          org_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          type: Database["public"]["Enums"]["checklist_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lease_id?: string
          org_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          type?: Database["public"]["Enums"]["checklist_type"]
        }
        Relationships: [
          {
            foreignKeyName: "checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          billed_amount: number
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          org_id: string
          property_id: string
          vendor_cost: number
        }
        Insert: {
          billed_amount: number
          created_at?: string
          created_by?: string | null
          description: string
          expense_date: string
          id?: string
          org_id: string
          property_id: string
          vendor_cost: number
        }
        Update: {
          billed_amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          org_id?: string
          property_id?: string
          vendor_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          budget: number | null
          created_at: string
          email: string
          id: string
          listing_id: string
          move_in_date: string | null
          name: string
          note: string | null
          org_id: string
          phone: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
          type: Database["public"]["Enums"]["inquiry_type"]
        }
        Insert: {
          budget?: number | null
          created_at?: string
          email: string
          id?: string
          listing_id: string
          move_in_date?: string | null
          name: string
          note?: string | null
          org_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          type?: Database["public"]["Enums"]["inquiry_type"]
        }
        Update: {
          budget?: number | null
          created_at?: string
          email?: string
          id?: string
          listing_id?: string
          move_in_date?: string | null
          name?: string
          note?: string | null
          org_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          type?: Database["public"]["Enums"]["inquiry_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          appsheet_created_at: string | null
          appsheet_modified_at: string | null
          appsheet_tenant_ids: string[] | null
          appsheet_unique_id: string | null
          appsheet_viewer_ids: string[] | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          days_occupied: number | null
          deposit_amount: number
          document_path: string | null
          documents: string | null
          end_date: string | null
          folder_id: string | null
          id: string
          insurance_confirmed: boolean
          insurance_details: string | null
          insurance_required: boolean
          lease_months: number | null
          lease_term_type: Database["public"]["Enums"]["lease_term_type_enum"]
          leasing_fee_percent: number | null
          management_end_date: string | null
          management_fee_percent: number | null
          management_start_date: string | null
          monthly_rent: number
          notes: string | null
          org_id: string
          parking_spots: number | null
          pets_policy: string | null
          policy_expires: string | null
          portfolio_appsheet_id: string | null
          previous_lease_appsheet_id: string | null
          previous_lease_id: string | null
          proposed_rent: number | null
          renewal_status:
            | Database["public"]["Enums"]["renewal_status_enum"]
            | null
          rent_due_day: number
          rental_credit: number | null
          rental_credit_expiry: string | null
          start_date: string
          status: string
          tenant_contacts_raw: string | null
          tenant_id: string | null
          termination_reason: string | null
          unit_id: string
          updated_at: string | null
          utilities_included: string | null
        }
        Insert: {
          appsheet_created_at?: string | null
          appsheet_modified_at?: string | null
          appsheet_tenant_ids?: string[] | null
          appsheet_unique_id?: string | null
          appsheet_viewer_ids?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          days_occupied?: number | null
          deposit_amount: number
          document_path?: string | null
          documents?: string | null
          end_date?: string | null
          folder_id?: string | null
          id?: string
          insurance_confirmed?: boolean
          insurance_details?: string | null
          insurance_required?: boolean
          lease_months?: number | null
          lease_term_type?: Database["public"]["Enums"]["lease_term_type_enum"]
          leasing_fee_percent?: number | null
          management_end_date?: string | null
          management_fee_percent?: number | null
          management_start_date?: string | null
          monthly_rent: number
          notes?: string | null
          org_id: string
          parking_spots?: number | null
          pets_policy?: string | null
          policy_expires?: string | null
          portfolio_appsheet_id?: string | null
          previous_lease_appsheet_id?: string | null
          previous_lease_id?: string | null
          proposed_rent?: number | null
          renewal_status?:
            | Database["public"]["Enums"]["renewal_status_enum"]
            | null
          rent_due_day?: number
          rental_credit?: number | null
          rental_credit_expiry?: string | null
          start_date: string
          status?: string
          tenant_contacts_raw?: string | null
          tenant_id?: string | null
          termination_reason?: string | null
          unit_id: string
          updated_at?: string | null
          utilities_included?: string | null
        }
        Update: {
          appsheet_created_at?: string | null
          appsheet_modified_at?: string | null
          appsheet_tenant_ids?: string[] | null
          appsheet_unique_id?: string | null
          appsheet_viewer_ids?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          days_occupied?: number | null
          deposit_amount?: number
          document_path?: string | null
          documents?: string | null
          end_date?: string | null
          folder_id?: string | null
          id?: string
          insurance_confirmed?: boolean
          insurance_details?: string | null
          insurance_required?: boolean
          lease_months?: number | null
          lease_term_type?: Database["public"]["Enums"]["lease_term_type_enum"]
          leasing_fee_percent?: number | null
          management_end_date?: string | null
          management_fee_percent?: number | null
          management_start_date?: string | null
          monthly_rent?: number
          notes?: string | null
          org_id?: string
          parking_spots?: number | null
          pets_policy?: string | null
          policy_expires?: string | null
          portfolio_appsheet_id?: string | null
          previous_lease_appsheet_id?: string | null
          previous_lease_id?: string | null
          proposed_rent?: number | null
          renewal_status?:
            | Database["public"]["Enums"]["renewal_status_enum"]
            | null
          rent_due_day?: number
          rental_credit?: number | null
          rental_credit_expiry?: string | null
          start_date?: string
          status?: string
          tenant_contacts_raw?: string | null
          tenant_id?: string
          termination_reason?: string | null
          unit_id?: string
          updated_at?: string | null
          utilities_included?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_previous_lease_id_fkey"
            columns: ["previous_lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          available_from: string | null
          created_at: string
          display_rent: number | null
          highlights: string[] | null
          id: string
          listing_description: string | null
          listing_title: string
          org_id: string
          status: Database["public"]["Enums"]["listing_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          created_at?: string
          display_rent?: number | null
          highlights?: string[] | null
          id?: string
          listing_description?: string | null
          listing_title: string
          org_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          created_at?: string
          display_rent?: number | null
          highlights?: string[] | null
          id?: string
          listing_description?: string | null
          listing_title?: string
          org_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          gmail_access_token: string | null
          gmail_connected_at: string | null
          gmail_refresh_token: string | null
          gmail_token_expiry: number | null
          id: string
          logo_path: string | null
          name: string
          plan_type: string
          plan_unit_limit: number
          province: string
          setup_completed_at: string | null
          slug: string
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gmail_access_token?: string | null
          gmail_connected_at?: string | null
          gmail_refresh_token?: string | null
          gmail_token_expiry?: number | null
          id?: string
          logo_path?: string | null
          name: string
          plan_type?: string
          plan_unit_limit?: number
          province: string
          setup_completed_at?: string | null
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gmail_access_token?: string | null
          gmail_connected_at?: string | null
          gmail_refresh_token?: string | null
          gmail_token_expiry?: number | null
          id?: string
          logo_path?: string | null
          name?: string
          plan_type?: string
          plan_unit_limit?: number
          province?: string
          setup_completed_at?: string | null
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      owner_statements: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          management_fee: number
          net_to_owner: number
          org_id: string
          pdf_path: string
          period_month: number
          period_year: number
          property_id: string
          rent_collected: number
          total_expenses: number
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          management_fee?: number
          net_to_owner?: number
          org_id: string
          pdf_path: string
          period_month: number
          period_year: number
          property_id: string
          rent_collected?: number
          total_expenses?: number
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          management_fee?: number
          net_to_owner?: number
          org_id?: string
          pdf_path?: string
          period_month?: number
          period_year?: number
          property_id?: string
          rent_collected?: number
          total_expenses?: number
        }
        Relationships: [
          {
            foreignKeyName: "owner_statements_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string
          disbursable_after: string | null
          id: string
          lease_id: string
          method: string
          notes: string | null
          org_id: string
          recorded_by: string | null
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string
          disbursable_after?: string | null
          id?: string
          lease_id: string
          method: string
          notes?: string | null
          org_id: string
          recorded_by?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string
          disbursable_after?: string | null
          id?: string
          lease_id?: string
          method?: string
          notes?: string | null
          org_id?: string
          recorded_by?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          active: boolean
          company: string | null
          created_at: string | null
          deactivated_at: string | null
          email: string
          first_name: string | null
          id: string
          invite_accepted_at: string | null
          invite_sent_at: string | null
          invite_token: string | null
          last_name: string | null
          last_seen_announcements_at: string | null
          lease_type: string | null
          mailing_address: string | null
          max_price: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_parking: number | null
          move_in_date: string | null
          notes: string | null
          org_id: string
          pet_preference: string | null
          phone: string | null
          rating: number | null
          role: string[]
          services: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          company?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          last_name?: string | null
          last_seen_announcements_at?: string | null
          lease_type?: string | null
          mailing_address?: string | null
          max_price?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          move_in_date?: string | null
          notes?: string | null
          org_id: string
          pet_preference?: string | null
          phone?: string | null
          rating?: number | null
          role: string[]
          services?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          company?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          last_name?: string | null
          last_seen_announcements_at?: string | null
          lease_type?: string | null
          mailing_address?: string | null
          max_price?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_parking?: number | null
          move_in_date?: string | null
          notes?: string | null
          org_id?: string
          pet_preference?: string | null
          phone?: string | null
          rating?: number | null
          role?: string[]
          services?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string
          owner_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          city: string
          created_at: string | null
          id: string
          management_fee_type: string | null
          management_fee_value: number | null
          org_id: string
          owner_id: string | null
          photo_paths: string[] | null
          portfolio_id: string | null
          postal_code: string | null
          property_type: Database["public"]["Enums"]["property_type_enum"]
          province: string
          street_address: string
          updated_at: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: string
          management_fee_type?: string | null
          management_fee_value?: number | null
          org_id: string
          owner_id?: string | null
          photo_paths?: string[] | null
          portfolio_id?: string | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type_enum"]
          province: string
          street_address: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          management_fee_type?: string | null
          management_fee_value?: number | null
          org_id?: string
          owner_id?: string | null
          photo_paths?: string[] | null
          portfolio_id?: string | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type_enum"]
          province?: string
          street_address?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          amenities: string[] | null
          archived_at: string | null
          asking_rent: number | null
          bathrooms: number
          bedrooms: number
          created_at: string | null
          floor: number | null
          hospitable_property_id: string | null
          id: string
          org_id: string
          property_id: string | null
          sq_footage: number | null
          status: string
          unit_number: string | null
          updated_at: string | null
        }
        Insert: {
          amenities?: string[] | null
          archived_at?: string | null
          asking_rent?: number | null
          bathrooms?: number
          bedrooms?: number
          created_at?: string | null
          floor?: number | null
          hospitable_property_id?: string | null
          id?: string
          org_id: string
          property_id?: string | null
          sq_footage?: number | null
          status?: string
          unit_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amenities?: string[] | null
          archived_at?: string | null
          asking_rent?: number | null
          bathrooms?: number
          bedrooms?: number
          created_at?: string | null
          floor?: number | null
          hospitable_property_id?: string | null
          id?: string
          org_id?: string
          property_id?: string | null
          sq_footage?: number | null
          status?: string
          unit_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_vendor_id: string | null
          billed_amount: number | null
          budget: number | null
          category: string | null
          completed_date: string | null
          created_at: string
          created_by: string
          deposit: number | null
          description: string
          end_date: string | null
          estimated_cost: number | null
          external_ref: string | null
          id: string
          notes: string | null
          org_id: string
          owner_approve_token: string | null
          owner_decline_note: string | null
          owner_decline_token: string | null
          priority: Database["public"]["Enums"]["work_order_priority"]
          property_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          title: string
          unit_id: string | null
          updated_at: string
          vendor_cost: number | null
          vendor_token: string | null
        }
        Insert: {
          assigned_vendor_id?: string | null
          billed_amount?: number | null
          budget?: number | null
          category?: string | null
          completed_date?: string | null
          created_at?: string
          created_by: string
          deposit?: number | null
          description: string
          end_date?: string | null
          estimated_cost?: number | null
          external_ref?: string | null
          id?: string
          notes?: string | null
          org_id: string
          owner_approve_token?: string | null
          owner_decline_note?: string | null
          owner_decline_token?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          property_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          title: string
          unit_id?: string | null
          updated_at?: string
          vendor_cost?: number | null
          vendor_token?: string | null
        }
        Update: {
          assigned_vendor_id?: string | null
          billed_amount?: number | null
          budget?: number | null
          category?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string
          deposit?: number | null
          description?: string
          end_date?: string | null
          estimated_cost?: number | null
          external_ref?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          owner_approve_token?: string | null
          owner_decline_note?: string | null
          owner_decline_token?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          property_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          title?: string
          unit_id?: string | null
          updated_at?: string
          vendor_cost?: number | null
          vendor_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      org_id: { Args: never; Returns: string }
      person_id: { Args: never; Returns: string }
      tables_without_rls: {
        Args: never
        Returns: {
          tablename: string
        }[]
      }
      user_role: { Args: never; Returns: string }
    }
    Enums: {
      chat_thread_type: "property" | "direct"
      checklist_type: "move_in" | "move_out"
      inquiry_status: "new" | "contacted" | "closed"
      inquiry_type: "inquiry" | "application"
      listing_status: "draft" | "published" | "unlisted" | "renewal_sent"
      property_type_enum:
        | "house"
        | "duplex"
        | "apartment_building"
        | "condo"
        | "townhouse"
        | "other"
      renewal_status_enum: "pending" | "sent" | "accepted" | "declined"
      lease_term_type_enum: "fixed_term" | "month_to_month"
      work_order_priority: "low" | "medium" | "high" | "urgent"
      work_order_status:
        | "draft"
        | "submitted"
        | "assigned"
        | "in_progress"
        | "pending_approval"
        | "approved"
        | "completed"
        | "closed"
        | "postponed"
        | "cancelled"
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
      chat_thread_type: ["property", "direct"],
      checklist_type: ["move_in", "move_out"],
      inquiry_status: ["new", "contacted", "closed"],
      inquiry_type: ["inquiry", "application"],
      listing_status: ["draft", "published", "unlisted", "renewal_sent"],
      property_type_enum: [
        "house",
        "duplex",
        "apartment_building",
        "condo",
        "townhouse",
        "other",
      ],
      renewal_status_enum: ["pending", "sent", "accepted", "declined"],
      lease_term_type_enum: ["fixed_term", "month_to_month"],
      work_order_priority: ["low", "medium", "high", "urgent"],
      work_order_status: [
        "draft",
        "submitted",
        "assigned",
        "in_progress",
        "pending_approval",
        "approved",
        "completed",
        "closed",
        "postponed",
        "cancelled",
      ],
    },
  },
} as const
