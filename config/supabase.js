// Switch to esm.sh — more reliable for ES module CDN imports than jsdelivr
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://uqszvjvzwdqjgipmibqa.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxc3p2anZ6d2RxamdpcG1pYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjkyODAsImV4cCI6MjA5MTAwNTI4MH0.ns_7njQobaBqSJW9NZ32qwueBt39lq26zVdxXoEcX40";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
