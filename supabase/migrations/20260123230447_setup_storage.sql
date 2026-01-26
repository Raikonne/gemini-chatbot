insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true) on conflict (id) do nothing;

drop policy if exists "Public Access" on storage.objects;

create policy "Public Access" on storage.objects for select using ( bucket_id = 'chat-attachments' );

drop policy if exists "Authenticated Uploads" on storage.objects;

create policy "Authenticated Uploads" on storage.objects for insert to authenticated
       with check ( bucket_id = 'chat-attachments' );