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

  update public.llm_api_keys
     set last_used_at = now(),
         use_count = use_count + 1
   where id = v_key_id;

  insert into public.llm_rr_cursor as c (provider_id, last_key_id, updated_at)
  values (v_provider_id, v_key_id, now())
  on conflict (provider_id) do update
    set last_key_id = excluded.last_key_id,
        updated_at = now();

  key_id := v_key_id;
  ciphertext := v_ciphertext;
  iv := v_iv;
  provider_id := v_provider_id;
  provider_slug := v_provider_slug;
  base_url := v_base_url;
  default_model := v_default_model;
  config := v_config;
  return next;
end;
$function$;