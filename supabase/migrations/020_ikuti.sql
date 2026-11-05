-- 020_ikuti.sql
-- Ikuti dan berhenti mengikuti lapak (S5.1, A41, A42, A43; V2, V7, V33, V49).
--
-- 1. ikuti_lapak(p_lapak) dan berhenti_ikuti(p_lapak): satu-satunya jalan menulis tabel pengikut.
--    Keduanya idempotent: mengikuti dua kali atau berhenti dua kali tidak galat dan tidak menggandakan baris.
--    ikuti_lapak menolak jika belum masuk, lapak tidak tayang (draf, disembunyikan, atau tidak ada),
--    atau lapak milik sendiri (A42). Trigger ikuti_lapak_sendiri dari 005 tetap jadi pengaman kedua.
-- 2. Hak tabel: authenticated hanya boleh SELECT pengikut, dan RLS "pengikut kelola sendiri" (005)
--    membatasi ke baris sendiri. Tanpa hak INSERT dan DELETE, tulis langsung dari konsol ditolak.
--    Anon tidak punya hak apa pun. Jumlah pengikut publik tetap lewat lapak_publik.
-- Tidak ada tabel baru dan tidak ada kolom lokasi (A21). Fungsi hanya menerima id lapak.

create or replace function public.ikuti_lapak(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_pemilik uuid;
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;
  select l.pemilik_id into v_pemilik
    from public.lapak l
   where l.id = p_lapak and l.status_tayang = 'tayang';
  if not found then
    raise exception 'Lapak tidak tersedia';
  end if;
  if v_pemilik = v_uid then
    raise exception 'Pemilik tidak bisa mengikuti lapaknya sendiri';
  end if;
  insert into public.pengikut (pelanggan_id, lapak_id)
  values (v_uid, p_lapak)
  on conflict (pelanggan_id, lapak_id) do nothing;
end;
$$;

-- Berhenti mengikuti boleh untuk lapak apa pun yang diikuti (juga yang sedang disembunyikan)
create or replace function public.berhenti_ikuti(p_lapak uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Harus masuk dulu';
  end if;
  delete from public.pengikut where pelanggan_id = auth.uid() and lapak_id = p_lapak;
end;
$$;

revoke all on function public.ikuti_lapak(uuid) from public, anon;
revoke all on function public.berhenti_ikuti(uuid) from public, anon;
grant execute on function public.ikuti_lapak(uuid) to authenticated;
grant execute on function public.berhenti_ikuti(uuid) to authenticated;

revoke all on public.pengikut from anon, authenticated;
grant select on public.pengikut to authenticated;
