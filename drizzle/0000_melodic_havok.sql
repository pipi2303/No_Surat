CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"description" text NOT NULL,
	"before_value_json" text,
	"after_value_json" text,
	"reason" text,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_code" text NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text NOT NULL,
	"npwp_or_reg_number" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "letter_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"letter_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "letter_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"confidentiality_level" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "letter_classifications_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "letter_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"allowed_categories" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "letter_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"letter_code" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"official_number" text,
	"external_original_number" text,
	"letter_type_id" integer NOT NULL,
	"department_id" integer NOT NULL,
	"classification_id" integer NOT NULL,
	"letter_date" text NOT NULL,
	"registration_date" text NOT NULL,
	"subject" text NOT NULL,
	"sender" text NOT NULL,
	"recipient" text NOT NULL,
	"destination" text NOT NULL,
	"summary" text NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"numbering_rule_id" integer,
	"sequence_number" integer,
	"numbering_components_json" text,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_by_uid" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "letters_letter_code_unique" UNIQUE("letter_code"),
	CONSTRAINT "letters_official_number_unique" UNIQUE("official_number")
);
--> statement-breakpoint
CREATE TABLE "numbering_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"counter_key" text NOT NULL,
	"rule_id" integer NOT NULL,
	"scope_key" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "numbering_counters_counter_key_unique" UNIQUE("counter_key")
);
--> statement-breakpoint
CREATE TABLE "numbering_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"format_template" text NOT NULL,
	"scope_type" text NOT NULL,
	"reset_period" text NOT NULL,
	"digit_padding" integer DEFAULT 3 NOT NULL,
	"separator" text DEFAULT '/' NOT NULL,
	"date_source" text DEFAULT 'LETTER_DATE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"module" text NOT NULL,
	"role_codes" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"role_code" text DEFAULT 'STAFF' NOT NULL,
	"department_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
