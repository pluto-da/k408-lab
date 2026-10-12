set -e
cd /opt/k408
F=$(ls -t /var/backups/k408/k408-*.dump | head -1); echo "drill from $F"
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists k408_restore_drill && createdb -U "$POSTGRES_USER" k408_restore_drill'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d k408_restore_drill --no-owner' < "$F"
q() { docker compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -At -c 'select count(*) from \"User\"; '"; }
echo "prod users: $(q '"$POSTGRES_DB"')"; echo "restored users: $(q k408_restore_drill)"
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d k408_restore_drill -At -c "select count(*) from _prisma_migrations"' | sed 's/^/restored migrations: /'
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" k408_restore_drill' && echo DRILL_DB_DROPPED
