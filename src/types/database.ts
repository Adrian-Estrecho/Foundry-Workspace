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
          workspace_id: string;
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
          workspace_id: string;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_log: {
        Row: {
          created_at: string;
          for_date: string;
          kind: string;
          subject_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          for_date: string;
          kind: string;
          subject_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          for_date?: string;
          kind?: string;
          subject_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_log_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          announcement_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          workspace_id?: string;
        };
        Update: {
          announcement_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          workspace_id?: string;
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
          {
            foreignKeyName: "announcement_comments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          announcement_id: string;
          created_at?: string;
          emoji: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          announcement_id?: string;
          created_at?: string;
          emoji?: string;
          user_id?: string;
          workspace_id?: string;
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
          {
            foreignKeyName: "announcement_reactions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
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
          {
            foreignKeyName: "announcements_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      applicants: {
        Row: {
          admin_notes: string | null;
          answers: NonNullable<Json>;
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
          timezone: string | null;
          updated_at: string;
          weekly_hours: number | null;
          workspace_id: string;
        };
        Insert: {
          admin_notes?: string | null;
          answers?: NonNullable<Json>;
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
          timezone?: string | null;
          updated_at?: string;
          weekly_hours?: number | null;
          workspace_id?: string;
        };
        Update: {
          admin_notes?: string | null;
          answers?: NonNullable<Json>;
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
          timezone?: string | null;
          updated_at?: string;
          weekly_hours?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applicants_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "applicants_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      clickup_connections: {
        Row: {
          account_email: string | null;
          account_name: string;
          connected_at: string;
          connected_by: string | null;
          last_error: string | null;
          last_error_at: string | null;
          last_event_at: string | null;
          team_id: string;
          team_name: string;
          timezone: string;
          webhook_id: string | null;
          workspace_id: string;
        };
        Insert: {
          account_email?: string | null;
          account_name: string;
          connected_at?: string;
          connected_by?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          last_event_at?: string | null;
          team_id: string;
          team_name: string;
          timezone?: string;
          webhook_id?: string | null;
          workspace_id?: string;
        };
        Update: {
          account_email?: string | null;
          account_name?: string;
          connected_at?: string;
          connected_by?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          last_event_at?: string | null;
          team_id?: string;
          team_name?: string;
          timezone?: string;
          webhook_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clickup_connections_connected_by_fkey";
            columns: ["connected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clickup_connections_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      clickup_outbox: {
        Row: {
          attempts: number;
          last_error: string | null;
          next_attempt_at: string;
          queued_at: string;
          status_id: string;
          task_id: string;
          workspace_id: string;
        };
        Insert: {
          attempts?: number;
          last_error?: string | null;
          next_attempt_at?: string;
          queued_at?: string;
          status_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          attempts?: number;
          last_error?: string | null;
          next_attempt_at?: string;
          queued_at?: string;
          status_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clickup_outbox_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clickup_outbox_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      clickup_pipelines: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          last_synced_at: string | null;
          list_id: string;
          list_name: string;
          project_id: string;
          start_status: string;
          statuses: NonNullable<Json>;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_synced_at?: string | null;
          list_id: string;
          list_name: string;
          project_id: string;
          start_status: string;
          statuses?: NonNullable<Json>;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_synced_at?: string | null;
          list_id?: string;
          list_name?: string;
          project_id?: string;
          start_status?: string;
          statuses?: NonNullable<Json>;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clickup_pipelines_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clickup_pipelines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clickup_pipelines_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "clickup_connections";
            referencedColumns: ["workspace_id"];
          },
        ];
      };
      clickup_secrets: {
        Row: {
          api_token: string;
          webhook_secret: string | null;
          workspace_id: string;
        };
        Insert: {
          api_token: string;
          webhook_secret?: string | null;
          workspace_id: string;
        };
        Update: {
          api_token?: string;
          webhook_secret?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clickup_secrets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "clickup_connections";
            referencedColumns: ["workspace_id"];
          },
        ];
      };
      clickup_status_map: {
        Row: {
          clickup_status: string;
          needs_review: boolean;
          status_id: string;
          workspace_id: string;
        };
        Insert: {
          clickup_status: string;
          needs_review?: boolean;
          status_id: string;
          workspace_id?: string;
        };
        Update: {
          clickup_status?: string;
          needs_review?: boolean;
          status_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clickup_status_map_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "clickup_connections";
            referencedColumns: ["workspace_id"];
          },
          {
            foreignKeyName: "clickup_status_map_workspace_id_status_id_fkey";
            columns: ["workspace_id", "status_id"];
            isOneToOne: false;
            referencedRelation: "task_statuses";
            referencedColumns: ["workspace_id", "id"];
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
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
          {
            foreignKeyName: "client_checklist_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      client_portals: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          last_viewed_at: string | null;
          token: string;
          workspace_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          last_viewed_at?: string | null;
          token: string;
          workspace_id?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          last_viewed_at?: string | null;
          token?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_portals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "client_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_portals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_portals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_portals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: true;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          done_at?: string | null;
          editor_id: string;
          id?: string;
          is_done?: boolean;
          key: string;
          label: string;
          position: number;
          workspace_id?: string;
        };
        Update: {
          done_at?: string | null;
          editor_id?: string;
          id?: string;
          is_done?: boolean;
          key?: string;
          label?: string;
          position?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_checklist_items_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "editor_checklist_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          doc_type: string;
          editor_id: string;
          file_name: string;
          id?: string;
          storage_path: string;
          uploaded_at?: string;
          workspace_id?: string;
        };
        Update: {
          doc_type?: string;
          editor_id?: string;
          file_name?: string;
          id?: string;
          storage_path?: string;
          uploaded_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_documents_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "editor_documents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      editor_interviews: {
        Row: {
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          duration_minutes: number;
          editor_id: string;
          id: string;
          meeting_url: string | null;
          note_to_editor: string | null;
          outcome: Database["public"]["Enums"]["interview_outcome"];
          scheduled_at: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          duration_minutes?: number;
          editor_id: string;
          id?: string;
          meeting_url?: string | null;
          note_to_editor?: string | null;
          outcome?: Database["public"]["Enums"]["interview_outcome"];
          scheduled_at: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          duration_minutes?: number;
          editor_id?: string;
          id?: string;
          meeting_url?: string | null;
          note_to_editor?: string | null;
          outcome?: Database["public"]["Enums"]["interview_outcome"];
          scheduled_at?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_interviews_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "editor_interviews_workspace_id_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "editor_interviews_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      editor_notes: {
        Row: {
          body: string;
          editor_id: string;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          body?: string;
          editor_id: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Update: {
          body?: string;
          editor_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_notes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "editor_notes_workspace_id_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: true;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "editor_notes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          details?: NonNullable<Json>;
          editor_id: string;
          method: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          details?: NonNullable<Json>;
          editor_id?: string;
          method?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editor_payment_details_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "editor_payment_details_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
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
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "editors_member_fkey";
            columns: ["workspace_id", "id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
          {
            foreignKeyName: "editors_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          author_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          task_id?: string | null;
          title: string;
          workspace_id?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          task_id?: string | null;
          title?: string;
          workspace_id?: string;
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
          {
            foreignKeyName: "ideas_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      invitation_attempts: {
        Row: {
          attempted_at: string;
          user_id: string;
        };
        Insert: {
          attempted_at?: string;
          user_id: string;
        };
        Update: {
          attempted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          answers: NonNullable<Json>;
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
          workspace_id: string;
        };
        Insert: {
          answers?: NonNullable<Json>;
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
          workspace_id?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_rsvps: {
        Row: {
          meeting_id: string;
          responded_at: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          meeting_id: string;
          responded_at?: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          meeting_id?: string;
          responded_at?: string;
          status?: Database["public"]["Enums"]["rsvp_status"];
          user_id?: string;
          workspace_id?: string;
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
          {
            foreignKeyName: "meeting_rsvps_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reads: {
        Row: {
          last_read_at: string;
          thread_id: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          last_read_at?: string;
          thread_id: string;
          user_id: string;
          workspace_id?: string;
        };
        Update: {
          last_read_at?: string;
          thread_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reads_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reads_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      message_threads: {
        Row: {
          client_emailed_at: string | null;
          client_id: string | null;
          client_last_read_at: string | null;
          created_at: string;
          editor_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_thread_kind"];
          last_message_at: string | null;
          last_message_preview: string | null;
          last_sender: Database["public"]["Enums"]["message_sender"] | null;
          workspace_id: string;
        };
        Insert: {
          client_emailed_at?: string | null;
          client_id?: string | null;
          client_last_read_at?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["message_thread_kind"];
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_sender?: Database["public"]["Enums"]["message_sender"] | null;
          workspace_id?: string;
        };
        Update: {
          client_emailed_at?: string | null;
          client_id?: string | null;
          client_last_read_at?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["message_thread_kind"];
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_sender?: Database["public"]["Enums"]["message_sender"] | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_threads_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "client_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_workspace_id_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "message_threads_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          sender: Database["public"]["Enums"]["message_sender"];
          thread_id: string;
          workspace_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          sender: Database["public"]["Enums"]["message_sender"];
          thread_id: string;
          workspace_id?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          sender?: Database["public"]["Enums"]["message_sender"];
          thread_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          meta: NonNullable<Json>;
          read_at: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          emailed_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          link?: string | null;
          meta?: NonNullable<Json>;
          read_at?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          emailed_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          link?: string | null;
          meta?: NonNullable<Json>;
          read_at?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          accent_color: string | null;
          active_workspace_id: string | null;
          avatar_url: string | null;
          created_at: string;
          email: string;
          email_muted: string[];
          full_name: string;
          id: string;
          last_seen_at: string | null;
          phone: string | null;
          timezone: string;
          tint_background: boolean;
          updated_at: string;
        };
        Insert: {
          accent_color?: string | null;
          active_workspace_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          email_muted?: string[];
          full_name?: string;
          id: string;
          last_seen_at?: string | null;
          phone?: string | null;
          timezone?: string;
          tint_background?: boolean;
          updated_at?: string;
        };
        Update: {
          accent_color?: string | null;
          active_workspace_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          email_muted?: string[];
          full_name?: string;
          id?: string;
          last_seen_at?: string | null;
          phone?: string | null;
          timezone?: string;
          tint_background?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_workspace_id_fkey";
            columns: ["active_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      project_editors: {
        Row: {
          added_at: string;
          editor_id: string;
          project_id: string;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          editor_id: string;
          project_id: string;
          workspace_id?: string;
        };
        Update: {
          added_at?: string;
          editor_id?: string;
          project_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_editors_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "project_editors_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_editors_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      project_statuses: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          position: number;
          stage: Database["public"]["Enums"]["project_status"];
          workspace_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          position?: number;
          stage: Database["public"]["Enums"]["project_status"];
          workspace_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          stage?: Database["public"]["Enums"]["project_status"];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_statuses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          status_id: string | null;
          updated_at: string;
          workspace_id: string;
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
          status_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
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
          status_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
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
          {
            foreignKeyName: "projects_status_id_fkey";
            columns: ["workspace_id", "status_id"];
            isOneToOne: false;
            referencedRelation: "project_statuses";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shift_reports_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
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
          {
            foreignKeyName: "shift_reports_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "shifts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      sop_acknowledgments: {
        Row: {
          acknowledged_at: string;
          editor_id: string;
          sop_id: string;
          workspace_id: string;
        };
        Insert: {
          acknowledged_at?: string;
          editor_id: string;
          sop_id: string;
          workspace_id?: string;
        };
        Update: {
          acknowledged_at?: string;
          editor_id?: string;
          sop_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sop_acknowledgments_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "sop_acknowledgments_sop_id_fkey";
            columns: ["sop_id"];
            isOneToOne: false;
            referencedRelation: "sops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sop_acknowledgments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sops_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sops_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          editor_id: string;
          id?: never;
          reason: string;
          shift_id?: string | null;
          status: Database["public"]["Enums"]["work_status"];
          task_id?: string | null;
          workspace_id?: string;
        };
        Update: {
          created_at?: string;
          editor_id?: string;
          id?: never;
          reason?: string;
          shift_id?: string | null;
          status?: Database["public"]["Enums"]["work_status"];
          task_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "status_events_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
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
          {
            foreignKeyName: "status_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          id?: string;
          is_done?: boolean;
          position?: number;
          task_id: string;
          title: string;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          is_done?: boolean;
          position?: number;
          task_id?: string;
          title?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subtasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
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
          workspace_id?: string;
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
          workspace_id?: string;
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
          {
            foreignKeyName: "task_attachments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          mentions?: string[];
          task_id: string;
          workspace_id?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          mentions?: string[];
          task_id?: string;
          workspace_id?: string;
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
          {
            foreignKeyName: "task_comments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      task_statuses: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          position: number;
          stage: Database["public"]["Enums"]["task_status"];
          workspace_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          position?: number;
          stage: Database["public"]["Enums"]["task_status"];
          workspace_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          stage?: Database["public"]["Enums"]["task_status"];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_statuses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assigned_at: string | null;
          assignee_id: string | null;
          clickup_task_id: string | null;
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
          start_reminded_at: string | null;
          start_reminders: number;
          status: Database["public"]["Enums"]["task_status"];
          status_id: string | null;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assigned_at?: string | null;
          assignee_id?: string | null;
          clickup_task_id?: string | null;
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
          start_reminded_at?: string | null;
          start_reminders?: number;
          status?: Database["public"]["Enums"]["task_status"];
          status_id?: string | null;
          title: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          assigned_at?: string | null;
          assignee_id?: string | null;
          clickup_task_id?: string | null;
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
          start_reminded_at?: string | null;
          start_reminders?: number;
          status?: Database["public"]["Enums"]["task_status"];
          status_id?: string | null;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["workspace_id", "assignee_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
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
          {
            foreignKeyName: "tasks_status_id_fkey";
            columns: ["workspace_id", "status_id"];
            isOneToOne: false;
            referencedRelation: "task_statuses";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
          workspace_id: string;
        };
        Insert: {
          editor_id: string;
          ended_at?: string | null;
          id?: string;
          seconds?: never;
          shift_id: string;
          started_at?: string;
          task_id?: string | null;
          workspace_id?: string;
        };
        Update: {
          editor_id?: string;
          ended_at?: string | null;
          id?: string;
          seconds?: never;
          shift_id?: string;
          started_at?: string;
          task_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_logs_editor_id_fkey";
            columns: ["workspace_id", "editor_id"];
            isOneToOne: false;
            referencedRelation: "editors";
            referencedColumns: ["workspace_id", "id"];
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
          {
            foreignKeyName: "time_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_forms: {
        Row: {
          fields: NonNullable<Json>;
          kind: string;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          fields: NonNullable<Json>;
          kind: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Update: {
          fields?: NonNullable<Json>;
          kind?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_forms_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_forms_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          applicant_id: string | null;
          code: string;
          created_at: string;
          email: string | null;
          expires_at: string;
          full_name: string | null;
          id: string;
          invited_by: string | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["member_role"];
          sent_at: string | null;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          applicant_id?: string | null;
          code?: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          sent_at?: string | null;
          workspace_id?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          applicant_id?: string | null;
          code?: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          sent_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_applicant_id_fkey";
            columns: ["applicant_id"];
            isOneToOne: false;
            referencedRelation: "applicants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          announcements_seen_at: string;
          approved_at: string | null;
          approved_by: string | null;
          joined_at: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          announcements_seen_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          joined_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          announcements_seen_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          joined_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_settings: {
        Row: {
          test_asset_url: string | null;
          test_brief: string | null;
          test_due_days: number;
          test_title: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          test_asset_url?: string | null;
          test_brief?: string | null;
          test_due_days?: number;
          test_title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          test_asset_url?: string | null;
          test_brief?: string | null;
          test_due_days?: number;
          test_title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          accepting_applications: boolean;
          asset_pack_url: string | null;
          contract_template_url: string | null;
          created_at: string;
          created_by: string | null;
          default_accent: string;
          frameio_invite_url: string | null;
          id: string;
          logo_path: string | null;
          missed_clock_in_grace_minutes: number;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          accepting_applications?: boolean;
          asset_pack_url?: string | null;
          contract_template_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_accent?: string;
          frameio_invite_url?: string | null;
          id?: string;
          logo_path?: string | null;
          missed_clock_in_grace_minutes?: number;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          accepting_applications?: boolean;
          asset_pack_url?: string | null;
          contract_template_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_accent?: string;
          frameio_invite_url?: string | null;
          id?: string;
          logo_path?: string | null;
          missed_clock_in_grace_minutes?: number;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      accept_invitation: {
        Args: { p_code: string };
        Returns: {
          status: string;
          workspace_id: string;
        }[];
      };
      add_editor_member: {
        Args: { p_applicant_id: string; p_user_id: string; p_workspace_id: string };
        Returns: undefined;
      };
      applicant_stage_label: {
        Args: { p_stage: Database["public"]["Enums"]["applicant_stage"] };
        Returns: string;
      };
      approve_member: { Args: { p_user_id: string }; Returns: undefined };
      attendance_hours: {
        Args: { p_from: string; p_to: string };
        Returns: {
          editor_id: string;
          seconds: number;
          task_id: string;
        }[];
      };
      attendance_shifts: {
        Args: { p_from: string; p_to: string };
        Returns: {
          blockers: string;
          break_seconds: number;
          clock_in_at: string;
          clock_out_at: string;
          editor_id: string;
          ended_by: string;
          id: string;
          progress_pct: number;
          report_task_id: string;
          work_date: string;
          work_done: string;
          work_seconds: number;
        }[];
      };
      can_see_profile: { Args: { p_user_id: string }; Returns: boolean };
      claim_notification_emails: {
        Args: { p_limit?: number };
        Returns: {
          accent: string;
          body: string;
          created_at: string;
          email: string;
          entity_id: string;
          entity_type: string;
          full_name: string;
          id: string;
          link: string;
          meta: Json;
          role: Database["public"]["Enums"]["member_role"];
          timezone: string;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
          workspace_id: string;
          workspace_name: string;
        }[];
      };
      clickup_status_for: { Args: { p_project_id: string; p_status_id: string }; Returns: string };
      client_display_name: { Args: { p_company: string; p_contact_name: string }; Returns: string };
      client_stage_label: {
        Args: { p_stage: Database["public"]["Enums"]["client_stage"] };
        Returns: string;
      };
      close_shift: {
        Args: { p_end: string; p_ended_by: string; p_shift_id: string };
        Returns: number;
      };
      create_workspace: { Args: { p_name: string; p_slug: string }; Returns: string };
      current_workspace_id: { Args: Record<PropertyKey, never>; Returns: string };
      delete_project_status: {
        Args: { p_move_to?: string; p_status_id: string };
        Returns: undefined;
      };
      delete_task_status: { Args: { p_move_to?: string; p_status_id: string }; Returns: undefined };
      due_clickup_pushes: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          clickup_status: string;
          clickup_task_id: string;
          list_name: string;
          status_id: string;
          task_id: string;
          title: string;
          workspace_id: string;
        }[];
      };
      editor_hours: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          editor_id: string;
          seconds: number;
        }[];
      };
      editor_working_minutes: {
        Args: { p_editor_id: string; p_from: string; p_to: string; p_workspace_id: string };
        Returns: number;
      };
      end_shift_for: { Args: { p_editor_id: string; p_ended_at?: string }; Returns: number };
      ensure_client_checklist: { Args: { p_client_id: string }; Returns: undefined };
      format_duration: { Args: { p_seconds: number }; Returns: string };
      invitation_throttled: { Args: { p_user_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin_of: { Args: { p_workspace_id: string }; Returns: boolean };
      is_full_member: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_member_of: { Args: { p_workspace_id: string }; Returns: boolean };
      is_own_thread: { Args: { p_thread_id: string }; Returns: boolean };
      is_own_trial_task: { Args: { p_task_id: string }; Returns: boolean };
      is_project_member: { Args: { p_project_id: string }; Returns: boolean };
      is_reserved_slug: { Args: { p_slug: string }; Returns: boolean };
      is_task_assignee: { Args: { p_task_id: string }; Returns: boolean };
      mark_announcements_seen: { Args: Record<PropertyKey, never>; Returns: undefined };
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined };
      my_editor_for_update: {
        Args: Record<PropertyKey, never>;
        Returns: {
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
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "editors";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      new_invite_code: { Args: Record<PropertyKey, never>; Returns: string };
      normalize_invite_code: { Args: { p_code: string }; Returns: string };
      notification_email_category: {
        Args: { p_type: Database["public"]["Enums"]["notification_type"] };
        Returns: string;
      };
      notify_message: {
        Args: {
          p_body: string;
          p_from: string;
          p_link: string;
          p_thread_id: string;
          p_user_ids: string[];
          p_workspace_id: string;
        };
        Returns: undefined;
      };
      pending_notification_emails: { Args: { p_limit?: number }; Returns: string[] };
      post_client_message: { Args: { p_body: string; p_token: string }; Returns: string };
      post_message: {
        Args: {
          p_body: string;
          p_kind: Database["public"]["Enums"]["message_thread_kind"];
          p_subject_id: string;
        };
        Returns: string;
      };
      preview_invitation: {
        Args: { p_code: string };
        Returns: {
          email: string;
          expires_at: string;
          invited_by_name: string;
          status: string;
          workspace_name: string;
        }[];
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
        Args: { p_slug: string };
        Returns: {
          accepting_applications: boolean;
          default_accent: string;
          logo_path: string | null;
          name: string;
          workspace_id: string;
        }[];
      };
      reject_member: { Args: { p_user_id: string }; Returns: undefined };
      reorder_statuses: { Args: { p_ids: string[]; p_kind: string }; Returns: undefined };
      request_clickup_push: { Args: Record<PropertyKey, never>; Returns: undefined };
      request_notification_emails: { Args: Record<PropertyKey, never>; Returns: undefined };
      resume_work: { Args: { p_keep_task?: boolean; p_task_id?: string }; Returns: undefined };
      run_scheduled_alerts: { Args: Record<PropertyKey, never>; Returns: undefined };
      run_task_start_reminders: { Args: Record<PropertyKey, never>; Returns: undefined };
      set_active_workspace: { Args: { p_workspace_id: string }; Returns: undefined };
      set_onboarding_step: { Args: { p_done: boolean; p_key: string }; Returns: undefined };
      start_work: { Args: { p_task_id?: string }; Returns: undefined };
      stop_work: {
        Args: {
          p_blockers?: string;
          p_ended_at?: string;
          p_progress?: number;
          p_task_id?: string;
          p_work_done: string;
        };
        Returns: number;
      };
      submit_application: {
        Args: {
          p_answers?: Json;
          p_availability_notes?: string;
          p_email: string;
          p_full_name: string;
          p_hourly_rate?: number;
          p_portfolio_url?: string;
          p_software?: string[];
          p_specialties?: string[];
          p_timezone?: string;
          p_weekly_hours?: number;
          p_workspace_id: string;
        };
        Returns: string;
      };
      submit_intake: {
        Args: {
          p_answers?: Json;
          p_budget_range?: string;
          p_company?: string;
          p_deadline?: string;
          p_email: string;
          p_name: string;
          p_notes?: string;
          p_phone?: string;
          p_project_type?: string;
          p_reference_links?: string[];
          p_workspace_id: string;
        };
        Returns: string;
      };
      switch_task: { Args: { p_task_id?: string }; Returns: undefined };
      sync_client_checklist: { Args: { p_client_id: string }; Returns: undefined };
      sync_editor_checklist: {
        Args: { p_editor_id: string; p_workspace_id: string };
        Returns: undefined;
      };
      take_break: { Args: Record<PropertyKey, never>; Returns: undefined };
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
      team_hours_by_day: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          day: string;
          seconds: number;
        }[];
      };
      thread_for: {
        Args: {
          p_kind: Database["public"]["Enums"]["message_thread_kind"];
          p_subject_id: string;
          p_workspace_id: string;
        };
        Returns: {
          client_emailed_at: string | null;
          client_id: string | null;
          client_last_read_at: string | null;
          created_at: string;
          editor_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_thread_kind"];
          last_message_at: string | null;
          last_message_preview: string | null;
          last_sender: Database["public"]["Enums"]["message_sender"] | null;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "message_threads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      touch_presence: { Args: Record<PropertyKey, never>; Returns: undefined };
      try_uuid: { Args: { p_value: string }; Returns: string };
      unread_threads: {
        Args: Record<PropertyKey, never>;
        Returns: {
          kind: Database["public"]["Enums"]["message_thread_kind"];
          thread_id: string;
        }[];
      };
      work_task_title: {
        Args: { p_editor_id: string; p_task_id: string; p_workspace_id: string };
        Returns: string;
      };
      workspace_admin_ids: { Args: { p_workspace_id: string }; Returns: string[] };
    };
    Enums: {
      applicant_stage: "applied" | "shortlisted" | "invited" | "joined" | "rejected";
      client_stage:
        | "new_lead"
        | "discovery_call"
        | "contract_sent"
        | "contract_signed"
        | "deposit_paid"
        | "kickoff"
        | "active_client"
        | "completed";
      interview_outcome: "scheduled" | "passed" | "failed" | "cancelled";
      member_role: "owner" | "admin" | "editor";
      member_status: "onboarding" | "active" | "rejected" | "left";
      message_sender: "admin" | "editor" | "client";
      message_thread_kind: "editor" | "client";
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
        | "mention"
        | "member_joined"
        | "onboarding_ready"
        | "interview_scheduled"
        | "onboarding_approved"
        | "onboarding_rejected"
        | "shift_ended"
        | "blocker_reported"
        | "new_message"
        | "task_start_reminder"
        | "task_not_started"
        | "task_due_today"
        | "task_approved";
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
      applicant_stage: ["applied", "shortlisted", "invited", "joined", "rejected"],
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
      interview_outcome: ["scheduled", "passed", "failed", "cancelled"],
      member_role: ["owner", "admin", "editor"],
      member_status: ["onboarding", "active", "rejected", "left"],
      message_sender: ["admin", "editor", "client"],
      message_thread_kind: ["editor", "client"],
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
        "member_joined",
        "onboarding_ready",
        "interview_scheduled",
        "onboarding_approved",
        "onboarding_rejected",
        "shift_ended",
        "blocker_reported",
        "new_message",
        "task_start_reminder",
        "task_not_started",
        "task_due_today",
        "task_approved",
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
      work_status: ["off", "working", "on_break"],
    },
  },
} as const;
