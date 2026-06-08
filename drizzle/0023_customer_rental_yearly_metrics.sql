CREATE TABLE IF NOT EXISTS "customer_rental_yearly_metrics" (
  "year" integer PRIMARY KEY NOT NULL,
  "active_customers" integer DEFAULT 0 NOT NULL,
  "rental_orders" integer DEFAULT 0 NOT NULL,
  "trailers" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
