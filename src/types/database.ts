export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
          meta: NonNullable<Json>;
          summary: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          meta?: NonNullable<Json>;
          summary: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          meta?: NonNullable<Json>;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcement_comments: {
        Row: {
          announcement_id: string;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
        };
        Insert: {
          announcement_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          announcement_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcement_reactions: {
        Row: {
          announcement_id: string;
          created_at: string;
          emoji: string;
          user_id: string;
        };
        Insert: {
          announcement_id: string;
          created_at?: string;
          emoji: string;
          user_id: string;
        };
        Update: {
          announcement_id?: string;
          created_at?: string;
          emoji?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reactions_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          is_pinned: boolean;
          meeting_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          meeting_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          meeting_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: true;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          admin_email: string | null;
          asset_pack_url: string | null;
          company_name: string;
          contract_template_url: string | null;
          default_accent: string;
          frameio_invite_url: string | null;
          id: number;
          missed_clock_in_grace_minutes: number;
          updated_at: string;
        };
        Insert: {
          admin_email?: string | null;
          asset_pack_url?: string | null;
          company_name?: string;
          contract_template_url?: string | null;
          default_accent?: string;
          frameio_invite_url?: string | null;
          id?: number;
          missed_clock_in_grace_minutes?: number;
          updated_at?: string;
        };
        Update: {
          admin_email?: string | null;
          asset_pack_url?: string | null;
          company_name?: string;
          contract_template_url?: string | null;
          default_accent?: string;
          frameio_invite_url?: string | null;
          id?: number;
          missed_clock_in_grace_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      applicants: {
        Row: {
          admin_notes: string | null;
          availability_notes: string | null;
          created_at: string;
          editor_id: string | null;
          email: string;
          full_name: string;
          hourly_rate: number | null;
          id: string;
          portfolio_url: string | null;
          position: number;
          rating: number | null;
          software: string[];
          specialties: string[];
          stage: Database["public"]["Enums"]["applicant_stage"];
          stage_changed_at: string;
          test_edit_url: string | null;
          test_submission_url: string | null;
          timezone: string | null;
          updated_at: string;
          weekly_hours: number | null;
        };
        Insert: {
          admin_notes?: string | null;
          availability_notes?: string | null;
          created_at?: string;
          editor_id?: string | null;
          email: string;
          full_name: string;
          hourly_rate?: number | null;
          id?: string;
          portfolio_url?: string | null;
          position?: number;
          rating?: number | null;
          software?: string[];
          specialties?: string[];
          stage?: Database["public"]["Enums"]["applicant_stage"];
          stage_changed_at?: string;
          test_edit_url?: string | null;
          test_submission_url?: string | null;
          timezone?: string | null;
          updated_at?: string;
          weekly_hours?: number | null;
        };
        Update: {
          admin_notes?: string | null;
          availability_notes?: string | null;
          created_at?: string;
          editor_id?: string | null;
          email?: string;
          full_name?: string;
          hourly_rate?: number | null;
          id?: string;
          portfolio_url?: string | null;
          position?: number;
          rating?: number | null;
          software?: string[];
          specialties?: string[];
          stage?: Database["public"]["Enums"]["applicant_stage"];
          stage_changed_at?: string;
          test_edit_url?: string | null;
          test_submission_url?: string | null;
          timezone?: string | null;
          updated_at?: string;
          weekly_hours?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "applicants_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
        ];
      };
      client_checklist_items: {
        Row: {
          client_id: string;
          done_at: string | null;
          done_by: string | null;
          id: string;
          is_done: boolean;
          key: string;
          label: string;
          position: number;
        };
        Insert: {
          client_id: string;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          key: string;
          label: string;
          position: number;
        };
        Update: {
          client_id?: string;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          key?: string;
          label?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "client_checklist_items_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "client_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_checklist_items_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_checklist_items_done_by_fkey";
            columns: ["done_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          budget_range: string | null;
          call_notes: string | null;
          company: string | null;
          contact_name: string;
          contract_path: string | null;
          created_at: string;
          deadline: string | null;
          deposit_status: Database["public"]["Enums"]["payment_status"];
          drive_folder_url: string | null;
          email: string | null;
          final_status: Database["public"]["Enums"]["payment_status"];
          id: string;
          lead_id: string | null;
          phone: string | null;
          position: number;
          project_type: string | null;
          stage: Database["public"]["Enums"]["client_stage"];
          stage_changed_at: string;
          updated_at: string;
        };
        Insert: {
          budget_range?: string | null;
          call_notes?: string | null;
          company?: string | null;
          contact_name: string;
          contract_path?: string | null;
          created_at?: string;
          deadline?: string | null;
          deposit_status?: Database["public"]["Enums"]["payment_status"];
          drive_folder_url?: string | null;
          email?: string | null;
          final_status?: Database["public"]["Enums"]["payment_status"];
          id?: string;
          lead_id?: string | null;
          phone?: string | null;
          position?: number;
          project_type?: string | null;
          stage?: Database["public"]["Enums"]["client_stage"];
          stage_changed_at?: string;
          updated_at?: string;
        };
        Update: {
          budget_range?: string | null;
          call_notes?: string | null;
          company?: string | null;
          contact_name?: string;
          contract_path?: string | null;
          created_at?: string;
          deadline?: string | null;
          deposit_status?: Database["public"]["Enums"]["payment_status"];
          drive_folder_url?: string | null;
          email?: string | null;
          final_status?: Database["public"]["Enums"]["payment_status"];
          id?: string;
          lead_id?: string | null;
          phone?: string | null;
          position?: number;
          project_type?: string | null;
          stage?: Database["public"]["Enums"]["client_stage"];
          stage_changed_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: true;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      editor_checklist_items: {
        Row: {
          done_at: string | null;
          editor_id: string;
          id: string;
          is_done: boolean;
          key: string;
          label: string;
          position: number;
        };
        Insert: {
          done_at?: string | null;
          editor_id: string;
          id?: string;
          is_done?: boolean;
          key: string;
          label: string;
          position: number;
        };
        Update: {
          done_at?: string | null;
          editor_id?: string;
          id?: string;
          is_done?: boolean;
          key?: string;
          label?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "editor_checklist_items_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
        ];
      };
      editor_documents: {
        Row: {
          doc_type: string;
          editor_id: string;
          file_name: string;
          id: string;
          storage_path: string;
          uploaded_at: string;
        };
        Insert: {
          doc_type: string;
          editor_id: string;
          file_name: string;
          id?: string;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          doc_type?: string;
          editor_id?: string;
          file_name?: string;
          id?: string;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_documents_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
        ];
      };
      editor_payment_details: {
        Row: {
          details: NonNullable<Json>;
          editor_id: string;
          method: string;
          updated_at: string;
        };
        Insert: {
          details?: NonNullable<Json>;
          editor_id: string;
          method: string;
          updated_at?: string;
        };
        Update: {
          details?: NonNullable<Json>;
          editor_id?: string;
          method?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_payment_details_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: true;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
        ];
      };
      editors: {
        Row: {
          applicant_id: string | null;
          created_at: string;
          current_shift_id: string | null;
          current_task_id: string | null;
          hourly_rate: number | null;
          id: string;
          is_active: boolean;
          onboarding_completed_at: string | null;
          shift_start: string;
          software: string[];
          specialties: string[];
          status_since: string;
          updated_at: string;
          weekly_hours: number | null;
          work_days: number[];
          work_status: Database["public"]["Enums"]["work_status"];
        };
        Insert: {
          applicant_id?: string | null;
          created_at?: string;
          current_shift_id?: string | null;
          current_task_id?: string | null;
          hourly_rate?: number | null;
          id: string;
          is_active?: boolean;
          onboarding_completed_at?: string | null;
          shift_start?: string;
          software?: string[];
          specialties?: string[];
          status_since?: string;
          updated_at?: string;
          weekly_hours?: number | null;
          work_days?: number[];
          work_status?: Database["public"]["Enums"]["work_status"];
        };
        Update: {
          applicant_id?: string | null;
          created_at?: string;
          current_shift_id?: string | null;
          current_task_id?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean;
          onboarding_completed_at?: string | null;
          shift_start?: string;
          software?: string[];
          specialties?: string[];
          status_since?: string;
          updated_at?: string;
          weekly_hours?: number | null;
          work_days?: number[];
          work_status?: Database["public"]["Enums"]["work_status"];
        };
        Relationships: [
          {
            foreignKeyName: "editors_applicant_id_fkey";
            columns: ["applicant_id"];
            isOneToOne: true;
            referencedRelation: "applicants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "editors_current_shift_fkey";
            columns: ["current_shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "editors_current_task_fkey";
            columns: ["current_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "editors_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ideas: {
        Row: {
          author_id: string | null;
          body: string | null;
          created_at: string;
          id: string;
          status: string;
          task_id: string | null;
          title: string;
        };
        Insert: {
          author_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          task_id?: string | null;
          title: string;
        };
        Update: {
          author_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          task_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ideas_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ideas_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          budget_range: string | null;
          company: string | null;
          created_at: string;
          deadline: string | null;
          email: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          project_type: string | null;
          reference_links: string[];
        };
        Insert: {
          budget_range?: string | null;
          company?: string | null;
          created_at?: string;
          deadline?: string | null;
          email: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          project_type?: string | null;
          reference_links?: string[];
        };
        Update: {
          budget_range?: string | null;
          company?: string | null;
          created_at?: string;
          deadline?: string | null;
          email?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          project_type?: string | null;
          reference_links?: string[];
        };
        Relationships: [];
      };
      meeting_rsvps: {
        Row: {
          meeting_id: string;
          responded_at: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          user_id: string;
        };
        Insert: {
          meeting_id: string;
          responded_at?: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          user_id: string;
        };
        Update: {
          meeting_id?: string;
          responded_at?: string;
          status?: Database["public"]["Enums"]["rsvp_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_rsvps_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_rsvps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          agenda: string | null;
          created_at: string;
          created_by: string | null;
          duration_minutes: number;
          id: string;
          meeting_url: string | null;
          reminder_sent_at: string | null;
          starts_at: string;
          title: string;
        };
        Insert: {
          agenda?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number;
          id?: string;
          meeting_url?: string | null;
          reminder_sent_at?: string | null;
          starts_at: string;
          title: string;
        };
        Update: {
          agenda?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number;
          id?: string;
          meeting_url?: string | null;
          reminder_sent_at?: string | null;
          starts_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          emailed_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          emailed_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          emailed_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          accent_color: string | null;
          announcements_seen_at: string;
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          last_seen_at: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          timezone: string;
          tint_background: boolean;
          updated_at: string;
        };
        Insert: {
          accent_color?: string | null;
          announcements_seen_at?: string;
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          last_seen_at?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          timezone?: string;
          tint_background?: boolean;
          updated_at?: string;
        };
        Update: {
          accent_color?: string | null;
          announcements_seen_at?: string;
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          last_seen_at?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          timezone?: string;
          tint_background?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_editors: {
        Row: {
          added_at: string;
          editor_id: string;
          project_id: string;
        };
        Insert: {
          added_at?: string;
          editor_id: string;
          project_id: string;
        };
        Update: {
          added_at?: string;
          editor_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_editors_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_editors_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          deadline: string | null;
          delivered_at: string | null;
          drive_folder_url: string | null;
          frameio_url: string | null;
          id: string;
          name: string;
          spec_aspect_ratio: string | null;
          spec_format: string | null;
          spec_length: string | null;
          spec_notes: string | null;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          deadline?: string | null;
          delivered_at?: string | null;
          drive_folder_url?: string | null;
          frameio_url?: string | null;
          id?: string;
          name: string;
          spec_aspect_ratio?: string | null;
          spec_format?: string | null;
          spec_length?: string | null;
          spec_notes?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          deadline?: string | null;
          delivered_at?: string | null;
          drive_folder_url?: string | null;
          frameio_url?: string | null;
          id?: string;
          name?: string;
          spec_aspect_ratio?: string | null;
          spec_format?: string | null;
          spec_length?: string | null;
          spec_notes?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "client_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shift_reports: {
        Row: {
          blockers: string | null;
          created_at: string;
          editor_id: string;
          id: string;
          progress_pct: number | null;
          shift_id: string;
          task_id: string | null;
          work_done: string;
        };
        Insert: {
          blockers?: string | null;
          created_at?: string;
          editor_id: string;
          id?: string;
          progress_pct?: number | null;
          shift_id: string;
          task_id?: string | null;
          work_done: string;
        };
        Update: {
          blockers?: string | null;
          created_at?: string;
          editor_id?: string;
          id?: string;
          progress_pct?: number | null;
          shift_id?: string;
          task_id?: string | null;
          work_done?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shift_reports_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_reports_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: true;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_reports_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          break_seconds: number;
          clock_in_at: string;
          clock_out_at: string | null;
          created_at: string;
          editor_id: string;
          ended_by: string | null;
          id: string;
          work_date: string;
          work_seconds: number;
        };
        Insert: {
          break_seconds?: number;
          clock_in_at?: string;
          clock_out_at?: string | null;
          created_at?: string;
          editor_id: string;
          ended_by?: string | null;
          id?: string;
          work_date: string;
          work_seconds?: number;
        };
        Update: {
          break_seconds?: number;
          clock_in_at?: string;
          clock_out_at?: string | null;
          created_at?: string;
          editor_id?: string;
          ended_by?: string | null;
          id?: string;
          work_date?: string;
          work_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
        ];
      };
      sop_acknowledgments: {
        Row: {
          acknowledged_at: string;
          editor_id: string;
          sop_id: string;
        };
        Insert: {
          acknowledged_at?: string;
          editor_id: string;
          sop_id: string;
        };
        Update: {
          acknowledged_at?: string;
          editor_id?: string;
          sop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sop_acknowledgments_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sop_acknowledgments_sop_id_fkey";
            columns: ["sop_id"];
            isOneToOne: false;
            referencedRelation: "sops";
            referencedColumns: ["id"];
          },
        ];
      };
      sops: {
        Row: {
          category: Database["public"]["Enums"]["sop_category"];
          content: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          id: string;
          is_published: boolean;
          is_required: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["sop_category"];
          content?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          is_required?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["sop_category"];
          content?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          is_required?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sops_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      status_events: {
        Row: {
          created_at: string;
          editor_id: string;
          id: number;
          reason: string;
          shift_id: string | null;
          status: Database["public"]["Enums"]["work_status"];
          task_id: string | null;
        };
        Insert: {
          created_at?: string;
          editor_id: string;
          id?: never;
          reason: string;
          shift_id?: string | null;
          status: Database["public"]["Enums"]["work_status"];
          task_id?: string | null;
        };
        Update: {
          created_at?: string;
          editor_id?: string;
          id?: never;
          reason?: string;
          shift_id?: string | null;
          status?: Database["public"]["Enums"]["work_status"];
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "status_events_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "status_events_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "status_events_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      subtasks: {
        Row: {
          id: string;
          is_done: boolean;
          position: number;
          task_id: string;
          title: string;
        };
        Insert: {
          id?: string;
          is_done?: boolean;
          position?: number;
          task_id: string;
          title: string;
        };
        Update: {
          id?: string;
          is_done?: boolean;
          position?: number;
          task_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_attachments: {
        Row: {
          added_by: string | null;
          created_at: string;
          id: string;
          kind: string;
          label: string | null;
          storage_path: string | null;
          task_id: string;
          url: string | null;
        };
        Insert: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          label?: string | null;
          storage_path?: string | null;
          task_id: string;
          url?: string | null;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          label?: string | null;
          storage_path?: string | null;
          task_id?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_attachments_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          edited_at: string | null;
          id: string;
          mentions: string[];
          task_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          mentions?: string[];
          task_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          mentions?: string[];
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          idea_id: string | null;
          is_trial: boolean;
          position: number;
          priority: Database["public"]["Enums"]["task_priority"];
          progress_pct: number;
          project_id: string | null;
          revision_count: number;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          idea_id?: string | null;
          is_trial?: boolean;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          progress_pct?: number;
          project_id?: string | null;
          revision_count?: number;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          idea_id?: string | null;
          is_trial?: boolean;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          progress_pct?: number;
          project_id?: string | null;
          revision_count?: number;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_idea_fkey";
            columns: ["idea_id"];
            isOneToOne: false;
            referencedRelation: "ideas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      time_logs: {
        Row: {
          editor_id: string;
          ended_at: string | null;
          id: string;
          seconds: number | null;
          shift_id: string;
          started_at: string;
          task_id: string | null;
        };
        Insert: {
          editor_id: string;
          ended_at?: string | null;
          id?: string;
          seconds?: never;
          shift_id: string;
          started_at?: string;
          task_id?: string | null;
        };
        Update: {
          editor_id?: string;
          ended_at?: string | null;
          id?: string;
          seconds?: never;
          shift_id?: string;
          started_at?: string;
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "time_logs_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_logs_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      client_directory: {
        Row: {
          company: string | null;
          contact_name: string | null;
          id: string | null;
        };
        Insert: {
          company?: string | null;
          contact_name?: string | null;
          id?: string | null;
        };
        Update: {
          company?: string | null;
          contact_name?: string | null;
          id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      applicant_stage_label: {
        Args: { p_stage: Database["public"]["Enums"]["applicant_stage"] };
        Returns: string;
      };
      client_display_name: { Args: { p_company: string; p_contact_name: string }; Returns: string };
      client_stage_label: {
        Args: { p_stage: Database["public"]["Enums"]["client_stage"] };
        Returns: string;
      };
      editor_hours: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          editor_id: string;
          seconds: number;
        }[];
      };
      ensure_client_checklist: { Args: { p_client_id: string }; Returns: undefined };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_project_member: { Args: { p_project_id: string }; Returns: boolean };
      is_task_assignee: { Args: { p_task_id: string }; Returns: boolean };
      link_editor_to_applicant: {
        Args: { p_applicant_id: string; p_editor_id: string };
        Returns: undefined;
      };
      project_status_label: {
        Args: { p_status: Database["public"]["Enums"]["project_status"] };
        Returns: string;
      };
      project_time: {
        Args: { p_project_id: string };
        Returns: {
          editor_id: string;
          seconds: number;
        }[];
      };
      public_branding: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_name: string;
          default_accent: string;
        }[];
      };
      set_onboarding_step: { Args: { p_done: boolean; p_key: string }; Returns: undefined };
      submit_application: {
        Args: {
          p_availability_notes?: string;
          p_email: string;
          p_full_name: string;
          p_hourly_rate?: number;
          p_portfolio_url?: string;
          p_software?: string[];
          p_specialties?: string[];
          p_timezone?: string;
          p_weekly_hours?: number;
        };
        Returns: string;
      };
      submit_intake: {
        Args: {
          p_budget_range?: string;
          p_company?: string;
          p_deadline?: string;
          p_email: string;
          p_name: string;
          p_notes?: string;
          p_phone?: string;
          p_project_type?: string;
          p_reference_links?: string[];
        };
        Returns: string;
      };
      submit_test_edit: { Args: { p_applicant_id: string; p_url: string }; Returns: undefined };
      sync_client_checklist: { Args: { p_client_id: string }; Returns: undefined };
      sync_editor_checklist: { Args: { p_editor_id: string }; Returns: undefined };
      task_status_label: {
        Args: { p_status: Database["public"]["Enums"]["task_status"] };
        Returns: string;
      };
      task_time: {
        Args: { p_task_id: string };
        Returns: {
          editor_id: string;
          seconds: number;
        }[];
      };
      tasks_completed_by_month: {
        Args: { p_months?: number; p_tz?: string };
        Returns: {
          completed: number;
          month: string;
        }[];
      };
      team_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          confirmed_at: string;
          id: string;
          invited_at: string;
          last_sign_in_at: string;
        }[];
      };
      team_hours_by_day: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          day: string;
          seconds: number;
        }[];
      };
      touch_presence: { Args: Record<PropertyKey, never>; Returns: undefined };
      try_uuid: { Args: { p_value: string }; Returns: string };
    };
    Enums: {
      applicant_stage:
        | "applied"
        | "test_edit_sent"
        | "test_submitted"
        | "interview"
        | "approved"
        | "rejected";
      client_stage:
        | "new_lead"
        | "discovery_call"
        | "contract_sent"
        | "contract_signed"
        | "deposit_paid"
        | "kickoff"
        | "active_client"
        | "completed";
      notification_type:
        | "new_lead"
        | "new_applicant"
        | "task_for_review"
        | "task_overdue"
        | "editor_onboarded"
        | "missed_clock_in"
        | "offline_with_overdue"
        | "task_assigned"
        | "task_due_tomorrow"
        | "revision_requested"
        | "new_announcement"
        | "meeting_reminder"
        | "mention";
      payment_status: "unpaid" | "paid";
      project_status:
        | "brief_received"
        | "in_progress"
        | "internal_review"
        | "client_review"
        | "revisions"
        | "delivered";
      rsvp_status: "going" | "maybe" | "declined";
      sop_category:
        | "editing_workflow"
        | "frameio_review"
        | "file_naming_delivery"
        | "communication";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "for_review" | "revisions" | "done";
      user_role: "admin" | "editor";
      work_status: "off" | "working" | "on_break";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      applicant_stage: [
        "applied",
        "test_edit_sent",
        "test_submitted",
        "interview",
        "approved",
        "rejected",
      ],
      client_stage: [
        "new_lead",
        "discovery_call",
        "contract_sent",
        "contract_signed",
        "deposit_paid",
        "kickoff",
        "active_client",
        "completed",
      ],
      notification_type: [
        "new_lead",
        "new_applicant",
        "task_for_review",
        "task_overdue",
        "editor_onboarded",
        "missed_clock_in",
        "offline_with_overdue",
        "task_assigned",
        "task_due_tomorrow",
        "revision_requested",
        "new_announcement",
        "meeting_reminder",
        "mention",
      ],
      payment_status: ["unpaid", "paid"],
      project_status: [
        "brief_received",
        "in_progress",
        "internal_review",
        "client_review",
        "revisions",
        "delivered",
      ],
      rsvp_status: ["going", "maybe", "declined"],
      sop_category: ["editing_workflow", "frameio_review", "file_naming_delivery", "communication"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "for_review", "revisions", "done"],
      user_role: ["admin", "editor"],
      work_status: ["off", "working", "on_break"],
    },
  },
} as const;
