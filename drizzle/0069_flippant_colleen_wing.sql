CREATE INDEX "attendances_person_idx" ON "attendances" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "events_team_idx" ON "events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "memberships_team_idx" ON "memberships" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "person_documents_person_idx" ON "person_documents" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_guardians_guardian_idx" ON "person_guardians" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "person_injury_reports_person_idx" ON "person_injury_reports" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_medical_checkups_person_idx" ON "person_medical_checkups" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_notes_person_idx" ON "person_notes" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_qualifications_person_idx" ON "person_qualifications" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "persons_name_idx" ON "persons" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "registrations_kind_status_idx" ON "registrations" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "registrations_season_idx" ON "registrations" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "registrations_created_at_idx" ON "registrations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sponsor_payments_term_idx" ON "sponsor_payments" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "sponsor_payments_status_year_idx" ON "sponsor_payments" USING btree ("status","year");--> statement-breakpoint
CREATE INDEX "sponsorship_terms_sponsor_idx" ON "sponsorship_terms" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "teams_season_idx" ON "teams" USING btree ("season_id");