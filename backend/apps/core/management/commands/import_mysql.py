"""Import data from a legacy MySQL database into HMS.

Usage:
    python manage.py import_mysql --table patients_old --entity patients
    python manage.py import_mysql --table employees --entity staff --where "active=1"

Configure connection via env vars (or pass on command line):
    LEGACY_MYSQL_HOST, LEGACY_MYSQL_PORT, LEGACY_MYSQL_USER,
    LEGACY_MYSQL_PASSWORD, LEGACY_MYSQL_DB

The handlers re-use the same row-dict approach as import_excel, so column names in
the source MySQL table must be aliased via SQL to match HMS expected fields:

  SELECT
    fname    AS first_name,
    lname    AS last_name,
    phone_no AS phone,
    ...
  FROM patients_old
  WHERE active = 1

You can also write a custom mapping below. For complex transformations, fork
this command per legacy system.
"""
from __future__ import annotations
import os
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.models import Hospital
from .import_excel import ENTITY_HANDLERS


class Command(BaseCommand):
    help = "Import data from a legacy MySQL DB into HMS."

    def add_arguments(self, parser):
        parser.add_argument("--entity", choices=ENTITY_HANDLERS.keys(), required=True)
        parser.add_argument("--query", help="Full SELECT query (preferred for column aliasing)")
        parser.add_argument("--table", help="Table name (used if --query not provided)")
        parser.add_argument("--where", default="", help="WHERE clause when using --table")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--hospital-code", default=None)
        parser.add_argument("--host", default=os.environ.get("LEGACY_MYSQL_HOST", "localhost"))
        parser.add_argument("--port", default=int(os.environ.get("LEGACY_MYSQL_PORT", 3306)))
        parser.add_argument("--user", default=os.environ.get("LEGACY_MYSQL_USER", "root"))
        parser.add_argument("--password", default=os.environ.get("LEGACY_MYSQL_PASSWORD", ""))
        parser.add_argument("--database", default=os.environ.get("LEGACY_MYSQL_DB", ""))

    def handle(self, *args, **opts):
        try:
            import MySQLdb  # type: ignore
        except ImportError as e:
            raise CommandError("mysqlclient not installed") from e

        if not opts["query"] and not opts["table"]:
            raise CommandError("Provide either --query or --table")
        if not opts["database"]:
            raise CommandError("--database (or LEGACY_MYSQL_DB env) is required")

        hospital_code = opts["hospital_code"] or settings.HMS_DEFAULT_HOSPITAL_CODE
        hospital = Hospital.objects.filter(code=hospital_code).first()
        if not hospital:
            raise CommandError(f"Hospital '{hospital_code}' not found. Run seed_initial first.")

        conn = MySQLdb.connect(
            host=opts["host"], port=int(opts["port"]),
            user=opts["user"], passwd=opts["password"], db=opts["database"],
            charset="utf8mb4",
        )
        cur = conn.cursor(MySQLdb.cursors.DictCursor)

        if opts["query"]:
            sql = opts["query"]
        else:
            where = f" WHERE {opts['where']}" if opts["where"] else ""
            sql = f"SELECT * FROM `{opts['table']}`{where}"

        self.stdout.write(f"Executing on legacy DB: {sql}")
        cur.execute(sql)
        rows = list(cur.fetchall())
        cur.close()
        conn.close()

        # Lower-case keys for handler compatibility
        rows = [{k.lower(): v for k, v in r.items()} for r in rows]
        self.stdout.write(f"Fetched {len(rows)} rows. Mode: {'DRY RUN' if opts['dry_run'] else 'WRITE'}")

        handler = ENTITY_HANDLERS[opts["entity"]]
        with transaction.atomic():
            created, skipped, errors = handler(rows, hospital, dry_run=opts["dry_run"])
            if opts["dry_run"]:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(f"Created: {created}, Skipped: {skipped}, Errors: {len(errors)}"))
        for r, msg in errors[:20]:
            self.stdout.write(f"  Row {r}: {msg}")
