-- Bulk-add (or update) saved meals ("My meals"). Run in Supabase > SQL Editor.
-- 1. Replace YOUR_EMAIL@example.com with the email you sign in to the app with.
-- 2. Edit the rows below: name, kcal, protein (g), carbs (g), fat (g), for the amount in the name.
-- A meal with the same name is updated instead of duplicated.
-- Supabase may warn about RLS: choose "Run and enable RLS" (it's already on, so nothing changes).
-- "Success. No rows returned" is normal for an insert.

with me as (
  select id from auth.users where email = 'YOUR_EMAIL@example.com'
),
foods(name, kcal, protein, carbs, fat) as (
  values
    ('100 גרם קוטג'' 5% תנובה', 97, 11.0, 1.6, 5.0),
    ('כוס אורז מוכן (מבושל)', 215, 4.3, 46.5, 0.5)
    -- add more rows here, comma-separated; double any ' inside a name ('')
)
insert into public.saved_foods (user_id, name, kcal, protein, carbs, fat)
select me.id, f.name, f.kcal, f.protein, f.carbs, f.fat
from me, foods f
on conflict (user_id, name) do update
  set kcal = excluded.kcal, protein = excluded.protein,
      carbs = excluded.carbs, fat = excluded.fat;
