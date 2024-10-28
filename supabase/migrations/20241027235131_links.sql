create sequence "public"."posts_id_seq";

create table "public"."york_links" (
    "id" integer not null default nextval('posts_id_seq'::regclass),
    "url" text not null,
    "description" text not null,
    "embedding" vector(1024)
);


alter sequence "public"."posts_id_seq" owned by "public"."york_links"."id";

CREATE UNIQUE INDEX posts_pkey ON public.york_links USING btree (id);

alter table "public"."york_links" add constraint "posts_pkey" PRIMARY KEY using index "posts_pkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_link_descriptions(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS SETOF york_links
 LANGUAGE sql
AS $function$
  select *
  from york_links
  where york_links.embedding <=> query_embedding < 1 - match_threshold
  order by york_links.embedding <=> query_embedding asc
  limit least(match_count, 200);
$function$
;

grant delete on table "public"."york_links" to "anon";

grant insert on table "public"."york_links" to "anon";

grant references on table "public"."york_links" to "anon";

grant select on table "public"."york_links" to "anon";

grant trigger on table "public"."york_links" to "anon";

grant truncate on table "public"."york_links" to "anon";

grant update on table "public"."york_links" to "anon";

grant delete on table "public"."york_links" to "authenticated";

grant insert on table "public"."york_links" to "authenticated";

grant references on table "public"."york_links" to "authenticated";

grant select on table "public"."york_links" to "authenticated";

grant trigger on table "public"."york_links" to "authenticated";

grant truncate on table "public"."york_links" to "authenticated";

grant update on table "public"."york_links" to "authenticated";

grant delete on table "public"."york_links" to "service_role";

grant insert on table "public"."york_links" to "service_role";

grant references on table "public"."york_links" to "service_role";

grant select on table "public"."york_links" to "service_role";

grant trigger on table "public"."york_links" to "service_role";

grant truncate on table "public"."york_links" to "service_role";

grant update on table "public"."york_links" to "service_role";


