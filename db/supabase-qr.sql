-- Đếm lượt quét mã QR bằng Supabase. Dán toàn bộ file này vào Supabase > SQL Editor > Run (chạy lại nhiều lần vẫn an toàn).
create table if not exists public.qr_scans (
  id         bigint generated always as identity primary key,
  visitor_id text        not null check (visitor_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  lang       text        not null check (lang ~ '^[a-z]{2,8}$'),
  scanned_at timestamptz not null default now()
);
create index if not exists ix_qr_scans_at on public.qr_scans (scanned_at) include (visitor_id);

-- Khóa bảng: trình duyệt không đọc/ghi trực tiếp, chỉ đi qua 2 hàm bên dưới.
alter table public.qr_scans enable row level security;

create or replace function public.qr_track(p_visitor text, p_lang text)
returns void language sql security definer set search_path = public as $$
  insert into qr_scans (visitor_id, lang) values (p_visitor, p_lang);
$$;

create or replace function public.qr_stats(p_days int default 7, p_tz int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  span  int  := case when p_days in (7, 14, 30) then p_days else 7 end;
  today date := (now() + make_interval(hours => p_tz))::date;
  c0 date; p0 date; p1 date;
  result jsonb;
begin
  c0 := today - (span - 1);
  p0 := today - (span * 2 - 1);
  p1 := today - span;
  with s as (
    select visitor_id, (scanned_at + make_interval(hours => p_tz))::date as d, scanned_at
    from qr_scans
    where scanned_at >= now() - make_interval(days => span * 2 + 2)
  )
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', d::text, 'visitors', v, 'views', w))
                      from (select d, count(distinct visitor_id) v, count(*) w from s group by d) x), '[]'::jsonb),
    'period', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from s where d between c0 and today),
      'views',    (select count(*) from s where d between c0 and today)),
    'prev', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from s where d between p0 and p1),
      'views',    (select count(*) from s where d between p0 and p1)),
    'totals', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from qr_scans),
      'views',    (select count(*) from qr_scans)),
    'activeNow', (select count(distinct visitor_id) from qr_scans where scanned_at >= now() - interval '5 minutes')
  ) into result;
  return result;
end;
$$;

-- Cho phép trình duyệt (khóa anon) gọi đúng 2 hàm này.
revoke all on function public.qr_track(text, text) from public;
revoke all on function public.qr_stats(int, int) from public;
grant execute on function public.qr_track(text, text) to anon, authenticated;
grant execute on function public.qr_stats(int, int) to anon, authenticated;
