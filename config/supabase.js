import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://uqszvjvzwdqjgipmibqa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxc3p2anZ6d2RxamdpcG1pYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjkyODAsImV4cCI6MjA5MTAwNTI4MH0.ns_7njQobaBqSJW9NZ32qwueBt39lq26zVdxXoEcX40"
);
