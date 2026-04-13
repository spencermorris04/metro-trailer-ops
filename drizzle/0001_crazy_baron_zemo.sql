CREATE TYPE "public"."asset_allocation_type" AS ENUM('reservation', 'on_rent', 'maintenance_hold', 'inspection_hold', 'swap_out', 'swap_in');--> statement-breakpoint
CREATE TYPE "public"."collection_activity_type" AS ENUM('email', 'call', 'note', 'promise_to_pay', 'dispute', 'escalation', 'telematics_recovery');--> statement-breakpoint
CREATE TYPE "public"."contract_amendment_type" AS ENUM('extension', 'asset_swap', 'partial_return', 'rate_adjustment', 'cancellation', 'note');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('internal_esign', 'record360_sync', 'invoice_generation', 'portal_upload', 'internal');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'ready_for_signature', 'signature_in_progress', 'signed', 'evidence_locked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'internal');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."outbox_job_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_type" AS ENUM('payment_intent', 'charge', 'refund', 'credit_memo', 'payment_application');--> statement-breakpoint
CREATE TYPE "public"."retention_mode" AS ENUM('governance', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."role_scope_type" AS ENUM('global', 'branch', 'customer');--> statement-breakpoint
CREATE TYPE "public"."signature_access_token_purpose" AS ENUM('sign', 'otp');--> statement-breakpoint
CREATE TYPE "public"."signature_request_status" AS ENUM('sent', 'in_progress', 'partially_signed', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."signature_signer_status" AS ENUM('pending', 'viewed', 'signed', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('inline', 's3');--> statement-breakpoint
CREATE TYPE "public"."webhook_processing_status" AS ENUM('received', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "asset_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"contract_id" text,
	"contract_line_id" text,
	"dispatch_task_id" text,
	"allocation_type" "asset_allocation_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"source_event" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_case_id" text NOT NULL,
	"activity_type" "collection_activity_type" NOT NULL,
	"performed_by_user_id" text,
	"note" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_amendments" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"amendment_type" "contract_amendment_type" NOT NULL,
	"requested_by_user_id" text,
	"approved_by_user_id" text,
	"effective_at" timestamp with time zone,
	"notes" text,
	"delta_payload" jsonb,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text,
	"customer_id" text,
	"document_type" text NOT NULL,
	"status" "document_status" NOT NULL,
	"filename" text NOT NULL,
	"source" "document_source" NOT NULL,
	"hash" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_provider" "storage_provider" NOT NULL,
	"storage_bucket" text,
	"storage_key" text,
	"storage_version_id" text,
	"storage_e_tag" text,
	"object_locked" boolean DEFAULT false NOT NULL,
	"retention_mode" "retention_mode",
	"retention_until" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"related_signature_request_id" text,
	"supersedes_document_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_entity_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"entity_type" text NOT NULL,
	"internal_id" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"request_path" text NOT NULL,
	"request_method" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"to_address" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"provider_message_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "outbox_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"status" "outbox_job_status" DEFAULT 'pending' NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"provider" "integration_provider",
	"idempotency_key" text,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text,
	"customer_id" text,
	"payment_method_id" text,
	"provider" "integration_provider" DEFAULT 'stripe' NOT NULL,
	"transaction_type" "payment_transaction_type" NOT NULL,
	"status" "payment_transaction_status" NOT NULL,
	"external_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"payload" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"location_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promised_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_case_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"promised_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"signature_request_id" text NOT NULL,
	"signer_id" text NOT NULL,
	"purpose" "signature_access_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"otp_code_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_events" (
	"id" text PRIMARY KEY NOT NULL,
	"signature_request_id" text NOT NULL,
	"signer_id" text,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"provider" text DEFAULT 'Metro Trailer' NOT NULL,
	"status" "signature_request_status" NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"consent_text_version" text NOT NULL,
	"certification_text" text NOT NULL,
	"document_id" text,
	"final_document_id" text,
	"certificate_document_id" text,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"evidence_hash" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_signers" (
	"id" text PRIMARY KEY NOT NULL,
	"signature_request_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"title" text,
	"routing_order" integer NOT NULL,
	"status" "signature_signer_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"signature_text" text,
	"intent_accepted_at" timestamp with time zone,
	"consent_accepted_at" timestamp with time zone,
	"certification_accepted_at" timestamp with time zone,
	"otp_verified_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"evidence_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_branch_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"scope_type" "role_scope_type" DEFAULT 'global' NOT NULL,
	"branch_id" text,
	"customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"signature" text,
	"external_event_id" text,
	"headers" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_processing_status" DEFAULT 'received' NOT NULL,
	"processing_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_order_labor_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"technician_user_id" text,
	"hours" numeric(8, 2) NOT NULL,
	"hourly_rate" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_part_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"part_number" text,
	"description" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"unit_cost" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "portal_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "branch_coverage" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_contract_line_id_contract_lines_id_fk" FOREIGN KEY ("contract_line_id") REFERENCES "public"."contract_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_dispatch_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("dispatch_task_id") REFERENCES "public"."dispatch_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_two_factors" ADD CONSTRAINT "auth_two_factors_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_activities" ADD CONSTRAINT "collection_activities_collection_case_id_collection_cases_id_fk" FOREIGN KEY ("collection_case_id") REFERENCES "public"."collection_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_activities" ADD CONSTRAINT "collection_activities_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accounts" ADD CONSTRAINT "portal_accounts_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accounts" ADD CONSTRAINT "portal_accounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promised_payments" ADD CONSTRAINT "promised_payments_collection_case_id_collection_cases_id_fk" FOREIGN KEY ("collection_case_id") REFERENCES "public"."collection_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_access_tokens" ADD CONSTRAINT "signature_access_tokens_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_access_tokens" ADD CONSTRAINT "signature_access_tokens_signer_id_signature_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signature_signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_signer_id_signature_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signature_signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_final_document_id_documents_id_fk" FOREIGN KEY ("final_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_certificate_document_id_documents_id_fk" FOREIGN KEY ("certificate_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_memberships" ADD CONSTRAINT "user_branch_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_memberships" ADD CONSTRAINT "user_branch_memberships_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_labor_entries" ADD CONSTRAINT "work_order_labor_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_labor_entries" ADD CONSTRAINT "work_order_labor_entries_technician_user_id_users_id_fk" FOREIGN KEY ("technician_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_part_entries" ADD CONSTRAINT "work_order_part_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_allocations_asset_window_idx" ON "asset_allocations" USING btree ("asset_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "asset_allocations_contract_id_idx" ON "asset_allocations" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_account_unique" ON "auth_accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_unique" ON "auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_two_factors_user_id_unique" ON "auth_two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_unique" ON "auth_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "collection_activities_collection_case_id_idx" ON "collection_activities" USING btree ("collection_case_id");--> statement-breakpoint
CREATE INDEX "contract_amendments_contract_id_idx" ON "contract_amendments" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "documents_contract_id_idx" ON "documents" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "documents_customer_id_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "documents_related_signature_request_id_idx" ON "documents" USING btree ("related_signature_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_entity_mappings_provider_entity_unique" ON "external_entity_mappings" USING btree ("provider","entity_type","internal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_entity_mappings_external_lookup_unique" ON "external_entity_mappings" USING btree ("provider","entity_type","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_key_unique" ON "idempotency_keys" USING btree ("key","request_method","request_path");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "outbox_jobs_status_available_at_idx" ON "outbox_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_jobs_aggregate_idx" ON "outbox_jobs" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_invoice_id_idx" ON "payment_transactions" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_external_id_unique" ON "payment_transactions" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_resource_action_unique" ON "permissions" USING btree ("resource","action");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_accounts_auth_user_id_unique" ON "portal_accounts" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "portal_accounts_customer_id_idx" ON "portal_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "promised_payments_collection_case_id_idx" ON "promised_payments" USING btree ("collection_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_unique" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_unique" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "signature_access_tokens_signer_purpose_idx" ON "signature_access_tokens" USING btree ("signer_id","purpose");--> statement-breakpoint
CREATE INDEX "signature_events_signature_request_id_idx" ON "signature_events" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "signature_requests_contract_id_idx" ON "signature_requests" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "signature_requests_customer_id_idx" ON "signature_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "signature_requests_status_idx" ON "signature_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_signers_request_order_unique" ON "signature_signers" USING btree ("signature_request_id","routing_order");--> statement-breakpoint
CREATE INDEX "signature_signers_signature_request_id_idx" ON "signature_signers" USING btree ("signature_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_branch_memberships_user_branch_unique" ON "user_branch_memberships" USING btree ("user_id","branch_id");--> statement-breakpoint
CREATE INDEX "user_role_assignments_user_scope_idx" ON "user_role_assignments" USING btree ("user_id","scope_type","branch_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_receipts_provider_event_unique" ON "webhook_receipts" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "work_order_labor_entries_work_order_id_idx" ON "work_order_labor_entries" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_part_entries_work_order_id_idx" ON "work_order_part_entries" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_unique" ON "users" USING btree ("auth_user_id");