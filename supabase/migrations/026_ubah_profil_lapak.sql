-- 026_ubah_profil_lapak.sql
-- Ubah profil lapak (V42; A36, A37, A40). Dijalankan setelah 025.
--
-- Kenapa perlu fungsi: pemilik tidak punya hak UPDATE langsung pada tabel lapak (011, supaya status_tayang dan slug
-- tidak bisa diubah sendiri). simpan_daftar_1 hanya untuk lapak draf. Jadi lapak tayang dan disembunyikan diubah lewat
-- fungsi di bawah, yang hanya menyentuh nama, deskripsi, foto profil, dan foto lapak.
--
-- simpan_profil_lapak: satu transaksi.
--   - Pemilik diperiksa lewat cek_pemilik_lapak (005). Tamu dan orang lain ditolak.
--   - Hanya lapak tayang atau disembunyikan; lapak draf tetap lewat Daftar 1.
--   - Nama wajib terisi. Deskripsi maks. 300 karakter dan tanpa link (A37); constraint tabel (005, 011) tetap berlaku.
--   - Slug dan status_tayang tidak disentuh (A36: link dan QR lama tetap jalan).
--   - Foto: alamat foto baru harus berada di folder pemilik sendiri di bucket foto-lapak, supaya tidak bisa diisi alamat
--     luar. Foto yang dihapus hanya yang milik lapak ini. Maks. 4 foto lapak (A40); trigger batas_foto (005) tetap
--     jadi penjaga terakhir. Urutan foto dirapikan lagi menjadi 1..n.
-- File di Storage dihapus oleh aplikasi lewat API Storage setelah fungsi ini berhasil.

create or replace function public.simpan_profil_lapak(
  p_lapak       uuid,
  p_nama        text,
  p_deskripsi   text,
  p_foto_url    text,
  p_foto_hapus  uuid[] default '{}',
  p_foto_baru   text[] default '{}'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_lapak   public.lapak%rowtype;
  v_folder  text;
  v_desk    text := nullif(btrim(coalesce(p_deskripsi, '')), '');
  v_url     text;
  v_urutan  int;
begin
  perform public.cek_pemilik_lapak(p_lapak);

  -- Dikunci supaya dua simpan bersamaan tidak melewati batas 4 foto
  select * into v_lapak from public.lapak where id = p_lapak for update;
  if v_lapak.status_tayang = 'draf' then
    raise exception 'Selesaikan daftar lapak dulu';
  end if;

  if char_length(btrim(coalesce(p_nama, ''))) = 0 then
    raise exception 'Isi nama lapak dulu';
  end if;
  if v_desk is not null and char_length(v_desk) > 300 then
    raise exception 'Keterangan maks. 300 karakter';
  end if;
  if v_desk is not null and v_desk ~* 'http|www\.' then
    raise exception 'Keterangan tidak boleh berisi link';
  end if;

  -- Folder milik pemilik di bucket foto-lapak, sama dengan kebijakan unggah Storage (011)
  v_folder := '/storage/v1/object/public/foto-lapak/' || auth.uid()::text || '/';
  if p_foto_url is distinct from v_lapak.foto_url and p_foto_url is not null
     and position(v_folder in p_foto_url) = 0 then
    raise exception 'Foto tidak dikenal';
  end if;
  foreach v_url in array coalesce(p_foto_baru, '{}') loop
    if v_url is null or position(v_folder in v_url) = 0 then
      raise exception 'Foto tidak dikenal';
    end if;
  end loop;

  update public.lapak set
    nama = btrim(p_nama),
    deskripsi = v_desk,
    foto_url = p_foto_url,
    diubah_pada = now()
  where id = p_lapak;

  delete from public.foto_lapak where lapak_id = p_lapak and id = any(coalesce(p_foto_hapus, '{}'));

  if (select count(*) from public.foto_lapak where lapak_id = p_lapak)
     + coalesce(array_length(p_foto_baru, 1), 0) > 4 then
    raise exception 'Maksimal 4 foto per lapak';
  end if;

  select coalesce(max(urutan), 0) into v_urutan from public.foto_lapak where lapak_id = p_lapak;
  foreach v_url in array coalesce(p_foto_baru, '{}') loop
    v_urutan := v_urutan + 1;
    insert into public.foto_lapak (lapak_id, url, urutan) values (p_lapak, v_url, v_urutan);
  end loop;

  -- Urutan dirapikan menjadi 1..n setelah ada yang dihapus
  update public.foto_lapak f set urutan = u.n
    from (select id, row_number() over (order by urutan, id) as n from public.foto_lapak where lapak_id = p_lapak) u
   where f.id = u.id and f.urutan <> u.n;
end;
$$;

revoke all on function public.simpan_profil_lapak(uuid, text, text, text, uuid[], text[]) from public, anon;
grant execute on function public.simpan_profil_lapak(uuid, text, text, text, uuid[], text[]) to authenticated;
