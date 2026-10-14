# Overlap

Share one link, everyone paints their free slots, the organizer gets the best time. See `Overlap — PRD.md` and `PLAN.md`.

## Run
```bash
./start.sh
```
Starts MariaDB, creates the schema and DB user, builds the React app and serves everything.

Manual steps, if you prefer:
```bash
brew services start mariadb
mariadb < db/schema.sql
mariadb -e "CREATE USER IF NOT EXISTS 'overlap'@'localhost' IDENTIFIED BY 'overlap_dev'; GRANT ALL ON overlap.* TO 'overlap'@'localhost';"
(cd web && npm install && npm run build)      # outputs to public/app
php -S localhost:8080 -t public public/router.php
```
Open http://localhost:8080/ . DB credentials can be overridden with `OVERLAP_DSN`, `OVERLAP_DB_USER`, `OVERLAP_DB_PASS`.
For React hot reload: `cd web && npm run dev` (proxies `/api` to :8080).
