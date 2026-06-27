CREATE OR REPLACE FUNCTION public.llm_pick_next_key()
 RETURNS TABLE(key_id uuid, ciphertext text, iv text, provider_id uuid, provider_slug text, base_url text, default_model text, config jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_provider_id uuid;
  v_provider_slug text;
  v_base_url text;
  v_default_model text;
  v_config jsonb;
  v_key_id uuid;
  v_ciphertext text;
  v_iv text;
begin
  select p.id, p.slug, p.base_url, p.default_model, p.config
    into v_provider_id, v_provider_slug, v_base_url, v_default_model, v_config
  from public.llm_providers p
  where p.is_active and p.enabled
  limit 1;

  if v_provider_id is null then
    return;
  end if;

  select k.id, k.key_ciphertext, k.key_iv
    into v_key_id, v_ciphertext, v_iv
  from public.llm_api_keys k
  where k.provider_id = v_provider_id
    and k.enabled
    and (k.cooldown_until is null or k.cooldown_until < now())
  order by coalesce(k.last_used_at, 'epoch'::timestamptz) asc, k.id asc
  for update skip locked
  limit 1;

  if v_key_id is null then
    return;
  end if;

  update public.llm_api_keys k
     set last_used_at = now(),
         use_count = k.use_count + 1
   where k.id = v_key_id;

  insert into public.llm_rr_cursor (provider_id, last_key_id, updated_at)
  values (v_provider_id, v_key_id, now())
  on conflict on constraint llm_rr_cursor_pkey do update
    set last_key_id = excluded.last_key_id,
        updated_at = now();

  return query
  select
    v_key_id,
    v_ciphertext,
    v_iv,
    v_provider_id,
    v_provider_slug,
    v_base_url,
    v_default_model,
    v_config;
end;
$function$;