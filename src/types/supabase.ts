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
      charges: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          lease_id: string | null
          notes: string | null
          org_id: string
          period_month: number
          period_year: number
          portfolio_id: string | null
          project_id: string | null
          property_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          lease_id?: string | null
          notes?: string | null
          org_id: string
          period_month: number
          period_year: number
          portfolio_id?: string | null
          project_id?: string | null
          property_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          lease_id?: string | null
          notes?: string | null
          org_id?: string
          period_month?: number
          period_year?: number
          portfolio_id?: string | null
          project_id?: string | null
          property_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          billed_amount: number
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          hst_amount: number
          hst_rate: number
          id: string
          labour_amount: number
          labour_hours: number
          labour_rate: number
          markup_amount: number
          markup_rate: number
          org_id: string
          property_id: string
          source_channel: string
          source_sms_text: string | null
          staff_notes: string | null
          subtotal: number
          supplies_cost: number
          vendor_cost: number
          work_order_id: string | null
        }
        Insert: {
          billed_amount: number
          created_at?: string
          created_by?: string | null
          description: string
          expense_date: string
          hst_amount?: number
          hst_rate?: number
          id?: string
          labour_amount?: number
          labour_hours?: number
          labour_rate?: number
          markup_amount?: number
          markup_rate?: number
          org_id: string
          property_id: string
          source_channel?: string
          source_sms_text?: string | null
          staff_notes?: string | null
          subtotal?: number
          supplies_cost?: number
          vendor_cost: number
          work_order_id?: string | null
        }
        Update: {
          billed_amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          hst_amount?: number
          hst_rate?: number
          id?: string
          labour_amount?: number
          labour_hours?: number
          labour_rate?: number
          markup_amount?: number
          markup_rate?: number
          org_id?: string
          property_id?: string
          source_channel?: string
          source_sms_text?: string | null
          staff_notes?: string | null
          subtotal?: number
          supplies_cost?: number
          vendor_cost?: number
          work_order_id?: string | null
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
      expense_receipts: {
        Row: {
          content_type: string | null
          created_at: string
          draft_id: string | null
          expense_id: string | null
          id: string
          org_id: string
          storage_path: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          draft_id?: string | null
          expense_id?: string | null
          id?: string
          org_id: string
          storage_path: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          draft_id?: string | null
          expense_id?: string | null
          id?: string
          org_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sms_charge_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          listing_id: string | null
          move_in_date: string | null
          name: string
          note: string | null
          org_id: string
          phone: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
          type: Database["public"]["Enums"]["inquiry_type"]
          updated_at: string
          viewing_at: string | null
        }
        Insert: {
          budget?: number | null
          created_at?: string
          email: string
          id?: string
          listing_id?: string | null
          move_in_date?: string | null
          name: string
          note?: string | null
          org_id: string
          phone?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          type?: Database["public"]["Enums"]["inquiry_type"]
          updated_at?: string
          viewing_at?: string | null
        }
        Update: {
          budget?: number | null
          created_at?: string
          email?: string
          id?: string
          listing_id?: string | null
          move_in_date?: string | null
          name?: string
          note?: string | null
          org_id?: string
          phone?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          type?: Database["public"]["Enums"]["inquiry_type"]
          updated_at?: string
          viewing_at?: string | null
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
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          inquiry_id: string
          org_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
          org_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_notes_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_submissions: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          current_step: number
          id: string
          org_id: string
          payload: Json
          promoted_at: string | null
          promoted_to_client_id: string | null
          property_address: string | null
          status: string
          submitted_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          current_step?: number
          id?: string
          org_id: string
          payload?: Json
          promoted_at?: string | null
          promoted_to_client_id?: string | null
          property_address?: string | null
          status?: string
          submitted_at?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          current_step?: number
          id?: string
          org_id?: string
          payload?: Json
          promoted_at?: string | null
          promoted_to_client_id?: string | null
          property_address?: string | null
          status?: string
          submitted_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_alert_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          org_id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          org_id: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          org_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_alert_subscribers_org_id_fkey"
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
          published_at: string | null
          rental_credit: number | null
          rental_credit_expiry: string | null
          slug: string | null
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
          published_at?: string | null
          rental_credit?: number | null
          rental_credit_expiry?: string | null
          slug?: string | null
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
          published_at?: string | null
          rental_credit?: number | null
          rental_credit_expiry?: string | null
          slug?: string | null
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
      listing_social_posts: {
        Row: {
          caption: string | null
          caption_draft: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          listing_id: string | null
          match_method: Database["public"]["Enums"]["social_match_method"] | null
          media_paths: string[]
          meta_object_id: string | null
          org_id: string
          permalink: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          posted_at: string
          source: Database["public"]["Enums"]["social_post_source"]
          surface: Database["public"]["Enums"]["social_surface"]
        }
        Insert: {
          caption?: string | null
          caption_draft?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string | null
          match_method?: Database["public"]["Enums"]["social_match_method"] | null
          media_paths?: string[]
          meta_object_id?: string | null
          org_id: string
          permalink?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          posted_at?: string
          source?: Database["public"]["Enums"]["social_post_source"]
          surface: Database["public"]["Enums"]["social_surface"]
        }
        Update: {
          caption?: string | null
          caption_draft?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string | null
          match_method?: Database["public"]["Enums"]["social_match_method"] | null
          media_paths?: string[]
          meta_object_id?: string | null
          org_id?: string
          permalink?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          posted_at?: string
          source?: Database["public"]["Enums"]["social_post_source"]
          surface?: Database["public"]["Enums"]["social_surface"]
        }
        Relationships: [
          {
            foreignKeyName: "listing_social_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_social_posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_social_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_social_state: {
        Row: {
          changes_acked_at: string | null
          facebook_feed_at: string | null
          facebook_story_at: string | null
          instagram_feed_at: string | null
          instagram_story_at: string | null
          listing_id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          changes_acked_at?: string | null
          facebook_feed_at?: string | null
          facebook_story_at?: string | null
          instagram_feed_at?: string | null
          instagram_story_at?: string | null
          listing_id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          changes_acked_at?: string | null
          facebook_feed_at?: string | null
          facebook_story_at?: string | null
          instagram_feed_at?: string | null
          instagram_story_at?: string | null
          listing_id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_social_state_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_social_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          drive_access_token: string | null
          drive_connected_at: string | null
          drive_refresh_token: string | null
          drive_token_expiry: number | null
          expense_hst_rate: number
          expense_labour_rate: number
          expense_markup_rate: number
          gmail_access_token: string | null
          gmail_connected_at: string | null
          gmail_history_id: string | null
          gmail_last_sync_at: string | null
          gmail_last_sync_error: string | null
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
          tasks_access_token: string | null
          tasks_connected_at: string | null
          tasks_refresh_token: string | null
          tasks_token_expiry: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          drive_access_token?: string | null
          drive_connected_at?: string | null
          drive_refresh_token?: string | null
          drive_token_expiry?: number | null
          expense_hst_rate?: number
          expense_labour_rate?: number
          expense_markup_rate?: number
          gmail_access_token?: string | null
          gmail_connected_at?: string | null
          gmail_history_id?: string | null
          gmail_last_sync_at?: string | null
          gmail_last_sync_error?: string | null
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
          tasks_access_token?: string | null
          tasks_connected_at?: string | null
          tasks_refresh_token?: string | null
          tasks_token_expiry?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          drive_access_token?: string | null
          drive_connected_at?: string | null
          drive_refresh_token?: string | null
          drive_token_expiry?: number | null
          expense_hst_rate?: number
          expense_labour_rate?: number
          expense_markup_rate?: number
          gmail_access_token?: string | null
          gmail_connected_at?: string | null
          gmail_history_id?: string | null
          gmail_last_sync_at?: string | null
          gmail_last_sync_error?: string | null
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
          tasks_access_token?: string | null
          tasks_connected_at?: string | null
          tasks_refresh_token?: string | null
          tasks_token_expiry?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      org_meta_connections: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          facebook_page_id: string | null
          facebook_page_name: string | null
          graph_api_version: string
          instagram_user_id: string | null
          instagram_username: string | null
          last_sync_error: string | null
          last_synced_at: string | null
          org_id: string
          page_access_token: string | null
          system_user_token: string | null
          token_expires_at: string | null
          updated_at: string
          webhook_subscribed: boolean
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          graph_api_version?: string
          instagram_user_id?: string | null
          instagram_username?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          org_id: string
          page_access_token?: string | null
          system_user_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_subscribed?: boolean
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          graph_api_version?: string
          instagram_user_id?: string | null
          instagram_username?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          org_id?: string
          page_access_token?: string | null
          system_user_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_subscribed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "org_meta_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_meta_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tasks: {
        Row: {
          assignee_person_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          google_task_id: string | null
          google_tasklist_id: string | null
          id: string
          org_id: string
          priority: Database["public"]["Enums"]["org_task_priority"]
          project_id: string | null
          property_id: string | null
          source: Database["public"]["Enums"]["org_task_source"]
          status: Database["public"]["Enums"]["org_task_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["org_task_visibility"]
        }
        Insert: {
          assignee_person_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          google_task_id?: string | null
          google_tasklist_id?: string | null
          id?: string
          org_id: string
          priority?: Database["public"]["Enums"]["org_task_priority"]
          project_id?: string | null
          property_id?: string | null
          source?: Database["public"]["Enums"]["org_task_source"]
          status?: Database["public"]["Enums"]["org_task_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["org_task_visibility"]
        }
        Update: {
          assignee_person_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          google_task_id?: string | null
          google_tasklist_id?: string | null
          id?: string
          org_id?: string
          priority?: Database["public"]["Enums"]["org_task_priority"]
          project_id?: string | null
          property_id?: string | null
          source?: Database["public"]["Enums"]["org_task_source"]
          status?: Database["public"]["Enums"]["org_task_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["org_task_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "org_tasks_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      payment_allocations: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          id: string
          org_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          id?: string
          org_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          id?: string
          org_id?: string
          payment_id?: string
        }
        Relationships: []
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
          property_id: string | null
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
          property_id?: string | null
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
          property_id?: string | null
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
      pingram_webhook_events: {
        Row: {
          event_type: string | null
          pingram_id: string
          received_at: string
        }
        Insert: {
          event_type?: string | null
          pingram_id: string
          received_at?: string
        }
        Update: {
          event_type?: string | null
          pingram_id?: string
          received_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          active: boolean
          avatar_path: string | null
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
          avatar_path?: string | null
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
          avatar_path?: string | null
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
      property_media: {
        Row: {
          id: string
          org_id: string
          property_id: string
          storage_path: string
          visibility: string
          sort_order: number
          caption: string | null
          drive_file_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          property_id: string
          storage_path: string
          visibility: string
          sort_order?: number
          caption?: string | null
          drive_file_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          property_id?: string
          storage_path?: string
          visibility?: string
          sort_order?: number
          caption?: string | null
          drive_file_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_onboarding: {
        Row: {
          id: string
          org_id: string
          property_id: string
          path: string | null
          current_step: string
          details_completed_at: string | null
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          property_id: string
          path?: string | null
          current_step?: string
          details_completed_at?: string | null
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          property_id?: string
          path?: string | null
          current_step?: string
          details_completed_at?: string | null
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_onboarding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_onboarding_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_onboarding_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
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
      period_closings: {
        Row: {
          closed_at: string
          closed_by: string | null
          direction: string
          id: string
          net_amount: number
          notes: string | null
          org_id: string
          period_month: number
          period_year: number
          portfolio_id: string
          statement_pdf_path: string | null
          status: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          direction: string
          id?: string
          net_amount?: number
          notes?: string | null
          org_id: string
          period_month: number
          period_year: number
          portfolio_id: string
          statement_pdf_path?: string | null
          status?: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          direction?: string
          id?: string
          net_amount?: number
          notes?: string | null
          org_id?: string
          period_month?: number
          period_year?: number
          portfolio_id?: string
          statement_pdf_path?: string | null
          status?: string
        }
        Relationships: []
      }
      listing_brief_options: {
        Row: {
          options: Json
          org_id: string
          updated_at: string
        }
        Insert: {
          options?: Json
          org_id: string
          updated_at?: string
        }
        Update: {
          options?: Json
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_brief_options_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_knowledge_base: {
        Row: {
          created_at: string
          id: string
          markdown: string
          org_id: string
          property_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          markdown?: string
          org_id: string
          property_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          markdown?: string
          org_id?: string
          property_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hospitable_stays: {
        Row: {
          check_in: string | null
          check_out: string | null
          cleaning_fee: number
          created_at: string
          guest_name: string | null
          gross_amount: number
          id: string
          management_fee: number
          net_to_owner: number
          nights: number | null
          org_id: string
          period_month: number | null
          period_year: number | null
          portfolio_id: string | null
          property_id: string | null
          raw: Json | null
          reservation_code: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          cleaning_fee?: number
          created_at?: string
          guest_name?: string | null
          gross_amount?: number
          id?: string
          management_fee?: number
          net_to_owner?: number
          nights?: number | null
          org_id: string
          period_month?: number | null
          period_year?: number | null
          portfolio_id?: string | null
          property_id?: string | null
          raw?: Json | null
          reservation_code: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          cleaning_fee?: number
          created_at?: string
          guest_name?: string | null
          gross_amount?: number
          id?: string
          management_fee?: number
          net_to_owner?: number
          nights?: number | null
          org_id?: string
          period_month?: number | null
          period_year?: number | null
          portfolio_id?: string | null
          property_id?: string | null
          raw?: Json | null
          reservation_code?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          city: string
          created_at: string | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          drive_last_synced_at: string | null
          id: string
          listing_brief: Json
          management_fee_type: string | null
          management_fee_value: number | null
          org_id: string
          owner_id: string | null
          photo_paths: string[] | null
          portfolio_id: string | null
          postal_code: string | null
          property_type: Database["public"]["Enums"]["property_type_enum"]
          province: string
          slug: string | null
          street_address: string
          updated_at: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_last_synced_at?: string | null
          id?: string
          listing_brief?: Json
          management_fee_type?: string | null
          management_fee_value?: number | null
          org_id: string
          owner_id?: string | null
          photo_paths?: string[] | null
          portfolio_id?: string | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type_enum"]
          province: string
          slug?: string | null
          street_address: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_last_synced_at?: string | null
          id?: string
          listing_brief?: Json
          management_fee_type?: string | null
          management_fee_value?: number | null
          org_id?: string
          owner_id?: string | null
          photo_paths?: string[] | null
          portfolio_id?: string | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type_enum"]
          province?: string
          slug?: string | null
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
      sms_charge_drafts: {
        Row: {
          candidate_properties: Json
          category: string | null
          computed: Json | null
          created_at: string
          expires_at: string
          from_phone: string
          id: string
          labour_hours: number | null
          note: string | null
          org_id: string
          original_text: string
          person_id: string
          pingram_message_id: string | null
          property_id: string | null
          status: string
          supplies_cost: number | null
        }
        Insert: {
          candidate_properties?: Json
          category?: string | null
          computed?: Json | null
          created_at?: string
          expires_at?: string
          from_phone: string
          id?: string
          labour_hours?: number | null
          note?: string | null
          org_id: string
          original_text: string
          person_id: string
          pingram_message_id?: string | null
          property_id?: string | null
          status: string
          supplies_cost?: number | null
        }
        Update: {
          candidate_properties?: Json
          category?: string | null
          computed?: Json | null
          created_at?: string
          expires_at?: string
          from_phone?: string
          id?: string
          labour_hours?: number | null
          note?: string | null
          org_id?: string
          original_text?: string
          person_id?: string
          pingram_message_id?: string | null
          property_id?: string | null
          status?: string
          supplies_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_charge_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_charge_drafts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_charge_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_charge_phrases: {
        Row: {
          category: string | null
          hit_count: number
          id: string
          last_confirmed_at: string | null
          normalized_phrase: string
          org_id: string
          typical_hours: number | null
          typical_supplies_cost: number | null
        }
        Insert: {
          category?: string | null
          hit_count?: number
          id?: string
          last_confirmed_at?: string | null
          normalized_phrase: string
          org_id: string
          typical_hours?: number | null
          typical_supplies_cost?: number | null
        }
        Update: {
          category?: string | null
          hit_count?: number
          id?: string
          last_confirmed_at?: string | null
          normalized_phrase?: string
          org_id?: string
          typical_hours?: number | null
          typical_supplies_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_charge_phrases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          hospitable_widget_property_id: string | null
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
          hospitable_widget_property_id?: string | null
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
          hospitable_widget_property_id?: string | null
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
          appsheet_created_at: string | null
          appsheet_modified_at: string | null
          appsheet_unique_id: string | null
          assigned_vendor_id: string | null
          billed_amount: number | null
          budget: number | null
          completed_date: string | null
          created_at: string
          created_by: string
          deposit: number | null
          description: string
          end_date: string | null
          estimated_cost: number | null
          fire_risk: number | null
          id: string
          liability_risk: number | null
          loss_of_rent_risk: number | null
          notes: string | null
          org_id: string
          owner_approve_token: string | null
          owner_decline_note: string | null
          owner_decline_token: string | null
          portfolio_appsheet_id: string | null
          priority: Database["public"]["Enums"]["work_order_priority"]
          priority_number: number | null
          property_id: string
          services: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          sub_project_id: string | null
          title: string
          unit_id: string | null
          updated_at: string
          vendor_cost: number | null
          vendor_token: string | null
          water_damage_risk: number | null
        }
        Insert: {
          appsheet_created_at?: string | null
          appsheet_modified_at?: string | null
          appsheet_unique_id?: string | null
          assigned_vendor_id?: string | null
          billed_amount?: number | null
          budget?: number | null
          completed_date?: string | null
          created_at?: string
          created_by: string
          deposit?: number | null
          description: string
          end_date?: string | null
          estimated_cost?: number | null
          fire_risk?: number | null
          id?: string
          liability_risk?: number | null
          loss_of_rent_risk?: number | null
          notes?: string | null
          org_id: string
          owner_approve_token?: string | null
          owner_decline_note?: string | null
          owner_decline_token?: string | null
          portfolio_appsheet_id?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          priority_number?: number | null
          property_id: string
          services?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          sub_project_id?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
          vendor_cost?: number | null
          vendor_token?: string | null
          water_damage_risk?: number | null
        }
        Update: {
          appsheet_created_at?: string | null
          appsheet_modified_at?: string | null
          appsheet_unique_id?: string | null
          assigned_vendor_id?: string | null
          billed_amount?: number | null
          budget?: number | null
          completed_date?: string | null
          created_at?: string
          created_by?: string
          deposit?: number | null
          description?: string
          end_date?: string | null
          estimated_cost?: number | null
          fire_risk?: number | null
          id?: string
          liability_risk?: number | null
          loss_of_rent_risk?: number | null
          notes?: string | null
          org_id?: string
          owner_approve_token?: string | null
          owner_decline_note?: string | null
          owner_decline_token?: string | null
          portfolio_appsheet_id?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          priority_number?: number | null
          property_id?: string
          services?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          sub_project_id?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
          vendor_cost?: number | null
          vendor_token?: string | null
          water_damage_risk?: number | null
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
      public_property_id_for_listing: {
        Args: { p_listing_id: string; p_org_id: string }
        Returns: string | null
      }
      public_property_id_for_slug: {
        Args: { p_org_id: string; p_slug: string }
        Returns: string | null
      }
      public_property_is_leased: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      public_property_lease_end: {
        Args: { p_property_id: string }
        Returns: string | null
      }
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
      inquiry_status:
        | "new"
        | "contacted"
        | "viewing"
        | "application_sent"
        | "signed"
        | "closed"
      inquiry_type: "inquiry" | "application"
      listing_status: "draft" | "published" | "unlisted" | "renewal_sent" | "declined"
      social_match_method: "url_in_caption" | "manual" | "published"
      social_platform: "facebook" | "instagram"
      social_post_source: "manual" | "synced" | "published"
      social_surface: "feed" | "story" | "reel"
      property_type_enum:
        | "house"
        | "duplex"
        | "apartment_building"
        | "condo"
        | "townhouse"
        | "other"
      renewal_status_enum: "pending" | "sent" | "accepted" | "declined"
      lease_term_type_enum: "fixed_term" | "month_to_month"
      org_task_priority: "low" | "medium" | "high" | "urgent"
      org_task_source: "manual" | "google"
      org_task_status: "todo" | "doing" | "done"
      org_task_visibility: "org" | "assignees"
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
      inquiry_status: [
        "new",
        "contacted",
        "viewing",
        "application_sent",
        "signed",
        "closed",
      ],
      inquiry_type: ["inquiry", "application"],
      listing_status: ["draft", "published", "unlisted", "renewal_sent", "declined"],
      social_match_method: ["url_in_caption", "manual", "published"],
      social_platform: ["facebook", "instagram"],
      social_post_source: ["manual", "synced", "published"],
      social_surface: ["feed", "story", "reel"],
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
      org_task_priority: ["low", "medium", "high", "urgent"],
      org_task_source: ["manual", "google"],
      org_task_status: ["todo", "doing", "done"],
      org_task_visibility: ["org", "assignees"],
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
