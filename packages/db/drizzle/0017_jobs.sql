CREATE TYPE "public"."job_status" AS ENUM('open', 'done', 'declined');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "job_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "work_records" ADD COLUMN "job_id" uuid;--> statement-breakpoint
-- Each paid WorkRecord becomes a done Job, with its Visit.
WITH paid AS MATERIALIZED (
	SELECT w.id AS work_record_id, w.visit_id, gen_random_uuid() AS job_id, w.professional_id, w.customer_id,
		coalesce(w.title, 'Serviço') AS title, w.created_at, max(c.paid_at) AS paid_at
	FROM work_records w
	JOIN charges c ON c.work_record_id = w.id AND c.status = 'paid'
	WHERE w.customer_id IS NOT NULL
	GROUP BY w.id
), inserted AS (
	INSERT INTO jobs (id, professional_id, customer_id, title, status, opened_at, closed_at)
	SELECT job_id, professional_id, customer_id, title, 'done', created_at, coalesce(paid_at, created_at) FROM paid
)
UPDATE work_records w SET job_id = paid.job_id FROM paid WHERE w.id = paid.work_record_id;--> statement-breakpoint
-- The unpaid WorkRecords of a Customer share one open Job, titled after the newest.
INSERT INTO jobs (professional_id, customer_id, title, opened_at)
SELECT DISTINCT ON (customer_id) professional_id, customer_id, coalesce(title, 'Serviço'),
	min(created_at) OVER (PARTITION BY customer_id)
FROM work_records
WHERE customer_id IS NOT NULL AND job_id IS NULL
ORDER BY customer_id, created_at DESC;--> statement-breakpoint
UPDATE work_records w SET job_id = j.id
FROM jobs j
WHERE j.customer_id = w.customer_id AND j.status = 'open' AND w.job_id IS NULL;--> statement-breakpoint
UPDATE visits v SET job_id = w.job_id FROM work_records w WHERE w.visit_id = v.id AND w.job_id IS NOT NULL;--> statement-breakpoint
-- Loose Visits and Quotes go into the Customer's open Job, or a new one per Customer.
INSERT INTO jobs (professional_id, customer_id, title, opened_at)
SELECT loose.professional_id, loose.customer_id,
	coalesce(
		(SELECT qi.description FROM quotes q JOIN quote_items qi ON qi.quote_id = q.id
			WHERE q.customer_id = loose.customer_id ORDER BY q.created_at DESC, qi.position LIMIT 1),
		'Visita'
	),
	min(loose.created_at)
FROM (
	SELECT professional_id, customer_id, created_at FROM visits WHERE job_id IS NULL
	UNION ALL
	SELECT professional_id, customer_id, created_at FROM quotes
) loose
WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.customer_id = loose.customer_id AND j.status = 'open')
GROUP BY loose.professional_id, loose.customer_id;--> statement-breakpoint
UPDATE visits v SET job_id = j.id
FROM jobs j
WHERE j.customer_id = v.customer_id AND j.status = 'open' AND v.job_id IS NULL;--> statement-breakpoint
UPDATE quotes q SET job_id = j.id
FROM jobs j
WHERE j.customer_id = q.customer_id AND j.status = 'open';--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "job_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "job_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_professional_id_customer_id_index" ON "jobs" USING btree ("professional_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_one_open_per_customer" ON "jobs" USING btree ("customer_id") WHERE "jobs"."status" = 'open';--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_records" ADD CONSTRAINT "work_records_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
