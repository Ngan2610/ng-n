-- Tài khoản người dùng + tin nhắn liên hệ + quản lý người dùng của Admin, lưu ở Supabase.
-- Dán toàn bộ file vào Supabase > SQL Editor > Run (chạy lại nhiều lần vẫn an toàn).
-- TRƯỚC KHI CHẠY: tìm dòng "ĐỔI MẬT KHẨU ADMIN" bên dưới và thay 'DoiMatKhauNay123' bằng mật khẩu của bạn.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_users (
  id            bigint generated always as identity primary key,
  name          text        not null check (char_length(name) between 1 and 100),
  email         text        not null unique check (email = lower(email) and char_length(email) <= 254),
  password_hash text        not null,
  role          text        not null default 'user'   check (role in ('user', 'admin')),
  status        text        not null default 'active' check (status in ('active', 'locked')),
  created_at    timestamptz not null default now()
);

create table if not exists public.app_messages (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 100),
  email      text        not null check (char_length(email) <= 254),
  body       text        not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Khóa bí mật để ký phiên đăng nhập của Admin (tự sinh một lần, không ai đọc được từ trình duyệt).
create table if not exists public.app_secret (k text primary key, v text not null);
insert into public.app_secret (k, v)
values ('token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (k) do nothing;

-- Khóa 3 bảng: trình duyệt không đọc/ghi trực tiếp, chỉ đi qua các hàm bên dưới.
alter table public.app_users    enable row level security;
alter table public.app_messages enable row level security;
alter table public.app_secret   enable row level security;

-- ĐỔI MẬT KHẨU ADMIN: thay 'DoiMatKhauNay123' (tối thiểu 8 ký tự) trước khi Run.
-- Đổi sau này:  update public.app_users set password_hash = extensions.crypt('mat-khau-moi', extensions.gen_salt('bf')) where email = 'admin@dubchef.vn';
insert into public.app_users (name, email, password_hash, role)
values ('Admin', 'admin@dubchef.vn', extensions.crypt('admin12345', extensions.gen_salt('bf')), 'admin')
on conflict (email) do nothing;

-- ---------- hàm phụ (không cho trình duyệt gọi trực tiếp) ----------
create or replace function public.app_b64(b bytea) returns text
language sql immutable as $$
  select translate(regexp_replace(encode(b, 'base64'), E'[\\n=]', '', 'g'), '+/', '-_')
$$;

create or replace function public.app_make_token(p_email text, p_role text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare sec text; body text;
begin
  select v into sec from app_secret where k = 'token';
  body := app_b64(convert_to(jsonb_build_object('email', p_email, 'role', p_role,
            'exp', (extract(epoch from now()) * 1000)::bigint + 7 * 86400000)::text, 'utf8'));
  return body || '.' || app_b64(hmac(convert_to(body, 'utf8'), convert_to(sec, 'utf8'), 'sha256'));
end;
$$;

-- Trả email admin nếu token đúng, còn hạn và tài khoản vẫn là admin đang hoạt động; ngược lại null.
create or replace function public.app_admin_of(p_token text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare sec text; body text; sig text; payload jsonb; em text;
begin
  select v into sec from app_secret where k = 'token';
  body := split_part(coalesce(p_token, ''), '.', 1);
  sig  := split_part(coalesce(p_token, ''), '.', 2);
  if body = '' or sig = '' then return null; end if;
  if sig <> app_b64(hmac(convert_to(body, 'utf8'), convert_to(sec, 'utf8'), 'sha256')) then return null; end if;
  payload := convert_from(decode(translate(body, '-_', '+/') || repeat('=', (4 - length(body) % 4) % 4), 'base64'), 'utf8')::jsonb;
  if (payload->>'exp')::bigint < (extract(epoch from now()) * 1000)::bigint then return null; end if;
  em := payload->>'email';
  if exists (select 1 from app_users where email = em and role = 'admin' and status = 'active') then return em; end if;
  return null;
exception when others then
  return null;
end;
$$;

-- ---------- hàm cho web ----------
create or replace function public.app_register(p_name text, p_email text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare em text := lower(trim(coalesce(p_email, ''))); nm text := trim(coalesce(p_name, ''));
begin
  if char_length(nm) not between 1 and 100
     or char_length(em) > 254 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(coalesce(p_password, '')) not between 8 and 200 then
    return jsonb_build_object('code', 'invalid');
  end if;
  if exists (select 1 from app_users where email = em) then
    return jsonb_build_object('code', 'exists');
  end if;
  insert into app_users (name, email, password_hash)
  values (nm, em, crypt(p_password, gen_salt('bf')));
  return jsonb_build_object('user', jsonb_build_object('name', nm, 'email', em));
exception when unique_violation then
  return jsonb_build_object('code', 'exists');
end;
$$;

create or replace function public.app_login(p_email text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u app_users;
begin
  select * into u from app_users where email = lower(trim(coalesce(p_email, '')));
  if not found or u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    return jsonb_build_object('code', 'invalid');
  end if;
  if u.status = 'locked' then
    return jsonb_build_object('code', 'locked');
  end if;
  if u.role = 'admin' then
    return jsonb_build_object('user', jsonb_build_object('name', u.name, 'email', u.email, 'role', 'admin',
                                                         'token', app_make_token(u.email, 'admin')));
  end if;
  return jsonb_build_object('user', jsonb_build_object('name', u.name, 'email', u.email));
end;
$$;

create or replace function public.app_contact(p_name text, p_email text, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 100
     or char_length(coalesce(p_email, '')) not between 3 and 254
     or char_length(trim(coalesce(p_message, ''))) not between 1 and 2000 then
    return jsonb_build_object('code', 'invalid');
  end if;
  insert into app_messages (name, email, body) values (trim(p_name), trim(p_email), trim(p_message));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- hàm cho trang Quản trị (cần token Admin) ----------
create or replace function public.admin_users(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if app_admin_of(p_token) is null then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', name, 'email', email, 'at', created_at, 'status', status)
                                    order by created_at desc)
                   from app_users where role = 'user'), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_status(p_token text, p_email text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if app_admin_of(p_token) is null then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'locked') then raise exception 'invalid'; end if;
  update app_users set status = p_status where email = lower(p_email) and role = 'user';
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_remove(p_token text, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if app_admin_of(p_token) is null then raise exception 'forbidden'; end if;
  delete from app_users where email = lower(p_email) and role = 'user';
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- phân quyền: chỉ cho trình duyệt (khóa anon) gọi 6 hàm của web ----------
revoke all on function public.app_b64(bytea)                  from public, anon, authenticated;
revoke all on function public.app_make_token(text, text)      from public, anon, authenticated;
revoke all on function public.app_admin_of(text)              from public, anon, authenticated;
revoke all on function public.app_register(text, text, text)  from public;
revoke all on function public.app_login(text, text)           from public;
revoke all on function public.app_contact(text, text, text)   from public;
revoke all on function public.admin_users(text)               from public;
revoke all on function public.admin_set_status(text, text, text) from public;
revoke all on function public.admin_remove(text, text)        from public;
grant execute on function public.app_register(text, text, text)  to anon, authenticated;
grant execute on function public.app_login(text, text)           to anon, authenticated;
grant execute on function public.app_contact(text, text, text)   to anon, authenticated;
grant execute on function public.admin_users(text)               to anon, authenticated;
grant execute on function public.admin_set_status(text, text, text) to anon, authenticated;
grant execute on function public.admin_remove(text, text)        to anon, authenticated;
