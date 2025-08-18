-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action character varying NOT NULL,
  entity_type character varying NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  location_id integer NOT NULL,
  total_rack_count integer NOT NULL DEFAULT 0,
  status USER-DEFINED DEFAULT 'active'::audit_status,
  started_at timestamp with time zone DEFAULT now(),
  started_by uuid,
  completed_at timestamp with time zone,
  completed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notes text,
  shortname character varying NOT NULL,
  CONSTRAINT audit_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT audit_sessions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id),
  CONSTRAINT audit_sessions_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.users(id),
  CONSTRAINT audit_sessions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.locations (
  id integer NOT NULL DEFAULT nextval('locations_id_seq'::regclass),
  name character varying NOT NULL,
  address text,
  city character varying,
  state character varying,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  type character varying DEFAULT 'info'::character varying,
  read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.racks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  audit_session_id uuid NOT NULL,
  rack_number character varying NOT NULL,
  shelf_number character varying,
  location_id integer NOT NULL,
  status USER-DEFINED DEFAULT 'available'::rack_status,
  scanner_id uuid,
  assigned_at timestamp with time zone,
  completed_at timestamp with time zone,
  ready_for_approval boolean DEFAULT false,
  ready_at timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_by uuid,
  rejected_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  barcode character varying,
  CONSTRAINT racks_pkey PRIMARY KEY (id),
  CONSTRAINT racks_scanner_id_fkey FOREIGN KEY (scanner_id) REFERENCES public.users(id),
  CONSTRAINT racks_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id),
  CONSTRAINT racks_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id),
  CONSTRAINT racks_audit_session_id_fkey FOREIGN KEY (audit_session_id) REFERENCES public.audit_sessions(id),
  CONSTRAINT racks_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.scans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  audit_session_id uuid NOT NULL,
  rack_id uuid NOT NULL,
  barcode character varying NOT NULL,
  scanner_id uuid NOT NULL,
  quantity integer DEFAULT 1,
  manual_entry boolean DEFAULT false,
  notes text,
  device_id character varying,
  scanned_at timestamp with time zone DEFAULT now(),
  synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  client_scan_id text UNIQUE,
  CONSTRAINT scans_pkey PRIMARY KEY (id),
  CONSTRAINT scans_rack_id_fkey FOREIGN KEY (rack_id) REFERENCES public.racks(id),
  CONSTRAINT scans_scanner_id_fkey FOREIGN KEY (scanner_id) REFERENCES public.users(id),
  CONSTRAINT scans_audit_session_id_fkey FOREIGN KEY (audit_session_id) REFERENCES public.audit_sessions(id)
);
CREATE TABLE public.sync_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id character varying NOT NULL,
  data_type character varying NOT NULL CHECK (data_type::text = ANY (ARRAY['scan'::character varying, 'rack_update'::character varying, 'user_action'::character varying]::text[])),
  payload jsonb NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  retry_count integer DEFAULT 0,
  error_message text,
  created_at timestamp without time zone DEFAULT now(),
  processed_at timestamp without time zone,
  CONSTRAINT sync_queue_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  full_name character varying NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'scanner'::user_role,
  location_ids ARRAY DEFAULT '{}'::integer[],
  active boolean DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  username character varying NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users_backup_pre_migration (
  id uuid,
  email character varying,
  full_name character varying,
  role character varying,
  location_ids ARRAY,
  device_id character varying,
  active boolean,
  last_login timestamp without time zone,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  username character varying,
  has_password boolean,
  password_hash text
);