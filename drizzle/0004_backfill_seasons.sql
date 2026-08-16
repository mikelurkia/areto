-- Backfill: crea una fila en `seasons` por cada valor distinto del antiguo
-- texto libre `season` en `teams`/`fees`, y enlaza `season_id` con ella.
insert into "seasons" ("club_id", "name")
select distinct "club_id", "season" from "teams" where "season" is not null
union
select distinct "club_id", "season" from "fees" where "season" is not null
on conflict ("club_id", "name") do nothing;
--> statement-breakpoint
update "teams" t
set "season_id" = s."id"
from "seasons" s
where s."club_id" = t."club_id" and s."name" = t."season";
--> statement-breakpoint
update "fees" f
set "season_id" = s."id"
from "seasons" s
where s."club_id" = f."club_id" and s."name" = f."season";
--> statement-breakpoint
-- Marca como actual la temporada de nombre "mayor" (orden alfabético) de cada
-- club, asumiendo el formato "AAAA/AA" (único caso hoy). Ajustar a mano si en
-- el futuro conviven formatos de nombre distintos.
with ranked as (
  select "id", row_number() over (partition by "club_id" order by "name" desc) as rn
  from "seasons"
)
update "seasons" s
set "is_current" = true
from ranked r
where s."id" = r."id" and r.rn = 1;
