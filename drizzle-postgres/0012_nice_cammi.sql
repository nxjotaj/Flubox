CREATE TABLE "assistant_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "assistant_knowledge_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources_json" text DEFAULT '[]' NOT NULL,
	"feedback" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"daily_limit" integer,
	"retention_days" integer DEFAULT 90 NOT NULL,
	"updated_by" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"tools_json" text DEFAULT '[]' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"category" text NOT NULL,
	"priority" text NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"recommendation" text NOT NULL,
	"source_reference" text NOT NULL,
	"action_href" text,
	"expires_at" text NOT NULL,
	"dismissed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_usage" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"usage_date" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "assistant_usage_organization_id_user_id_usage_date_pk" PRIMARY KEY("organization_id","user_id","usage_date")
);
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_knowledge_documents" ADD CONSTRAINT "assistant_knowledge_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_organization_settings" ADD CONSTRAINT "assistant_organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_organization_settings" ADD CONSTRAINT "assistant_organization_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_suggestions" ADD CONSTRAINT "assistant_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_suggestions" ADD CONSTRAINT "assistant_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assistant_conversations_owner" ON "assistant_conversations" USING btree ("organization_id","user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_assistant_knowledge_active" ON "assistant_knowledge_documents" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_assistant_messages_conversation" ON "assistant_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_assistant_runs_org_created" ON "assistant_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_assistant_suggestions_org_active" ON "assistant_suggestions" USING btree ("organization_id","dismissed_at","expires_at");--> statement-breakpoint
CREATE INDEX "idx_assistant_usage_org_date" ON "assistant_usage" USING btree ("organization_id","usage_date");
--> statement-breakpoint
INSERT INTO "assistant_knowledge_documents" ("id","title","category","content","version","active","created_at","updated_at") VALUES
('assistant-help-orders','Como acompanhar pedidos','operacao','A página Pedidos reúne o fluxo operacional. Abra um pedido para conferir pagamento, documentos, separação, envio e rastreamento. O Assistente Flubox apenas consulta e explica essas informações; ações continuam sendo feitas pelo usuário nas páginas próprias.',1,true,NOW()::text,NOW()::text),
('assistant-help-inventory','Como acompanhar o estoque','operacao','Fornecedores acompanham produtos, variantes e saldo na página Estoque. Revendedores acompanham o saldo publicável e os anúncios vinculados na página Integrações. Confirme o saldo antes de tomar decisões de reposição.',1,true,NOW()::text,NOW()::text),
('assistant-help-integrations','Integrações com marketplaces','integracoes','A página Integrações permite ao revendedor conectar suas próprias contas, acompanhar anúncios e verificar sincronizações. Tokens e credenciais nunca são exibidos ao assistente ou ao navegador.',1,true,NOW()::text,NOW()::text),
('assistant-help-privacy','Privacidade do Assistente Flubox','privacidade','Cada conversa pertence ao usuário e à organização ativa. O assistente recebe somente informações necessárias e autorizadas. Administradores acompanham métricas e falhas, sem leitura livre do conteúdo das conversas.',1,true,NOW()::text,NOW()::text)
ON CONFLICT ("id") DO NOTHING;
