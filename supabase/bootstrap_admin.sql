-- Run after creating your first user in Supabase Auth.
-- Replace the email below with your login email.

update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where email = 'seu-email@exemplo.com'
  limit 1
);

select id, role, full_name, phone
from public.profiles
where role = 'admin';
