-- Add an index for the costs lookup used by the admin and portal APIs.
CREATE INDEX "client_costs_clientId_date_createdAt_idx" ON "client_costs"("clientId", "date", "createdAt");
