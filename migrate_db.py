"""
migrate_db.py — Script de migración de base de datos para DLHB-CORE Motor Financiero.

Ejecutar desde la raíz del proyecto:
    python migrate_db.py

Diseñado para ser idempotente: puede ejecutarse múltiples veces sin errores ni duplicados.
No usa el ORM (SQLAlchemy) para ser independiente del estado del modelo.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "dlhb_core.db"


def _column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def _table_exists(cursor: sqlite3.Cursor, table: str) -> bool:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cursor.fetchone() is not None


def migrate() -> None:
    changes: list[str] = []
    skipped: list[str] = []

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=OFF")  # deshabilitado durante migración

    try:
        cursor = conn.cursor()

        # ------------------------------------------------------------------ #
        # 1. Renombrar INACTIVO → CANCELADO en loans.status
        # ------------------------------------------------------------------ #
        if _table_exists(cursor, "loans"):
            cursor.execute(
                "SELECT COUNT(*) FROM loans WHERE status = 'INACTIVO'"
            )
            count = cursor.fetchone()[0]
            if count > 0:
                cursor.execute(
                    "UPDATE loans SET status = 'CANCELADO' WHERE status = 'INACTIVO'"
                )
                changes.append(
                    f"loans.status: {count} fila(s) actualizadas INACTIVO → CANCELADO"
                )
            else:
                skipped.append("loans.status: sin filas INACTIVO (nada que renombrar)")
        else:
            skipped.append("loans: tabla no existe, se omite renombrado de status")

        # ------------------------------------------------------------------ #
        # 2. Nuevas columnas en loans
        # ------------------------------------------------------------------ #
        loans_columns = [
            (
                "interest_period_unit",
                "ALTER TABLE loans ADD COLUMN interest_period_unit TEXT NOT NULL DEFAULT 'por_periodo'",
            ),
        ]

        if _table_exists(cursor, "loans"):
            for col, sql in loans_columns:
                if not _column_exists(cursor, "loans", col):
                    cursor.execute(sql)
                    changes.append(f"loans.{col}: columna añadida")
                else:
                    skipped.append(f"loans.{col}: ya existe")
        else:
            skipped.append("loans: tabla no existe, se omiten columnas nuevas")

        # ------------------------------------------------------------------ #
        # 3. Nuevas columnas en payments
        # ------------------------------------------------------------------ #
        payments_columns = [
            (
                "monto_a_mora",
                "ALTER TABLE payments ADD COLUMN monto_a_mora REAL NOT NULL DEFAULT 0.0",
            ),
            (
                "monto_a_interes",
                "ALTER TABLE payments ADD COLUMN monto_a_interes REAL NOT NULL DEFAULT 0.0",
            ),
            (
                "monto_a_capital",
                "ALTER TABLE payments ADD COLUMN monto_a_capital REAL NOT NULL DEFAULT 0.0",
            ),
            (
                "capital_previo",
                "ALTER TABLE payments ADD COLUMN capital_previo REAL",
            ),
            (
                "capital_posterior",
                "ALTER TABLE payments ADD COLUMN capital_posterior REAL",
            ),
            (
                "mora_previa",
                "ALTER TABLE payments ADD COLUMN mora_previa REAL",
            ),
            (
                "mora_posterior",
                "ALTER TABLE payments ADD COLUMN mora_posterior REAL",
            ),
            (
                "observacion",
                "ALTER TABLE payments ADD COLUMN observacion TEXT",
            ),
            (
                "asesor",
                "ALTER TABLE payments ADD COLUMN asesor TEXT NOT NULL DEFAULT ''",
            ),
        ]

        if _table_exists(cursor, "payments"):
            for col, sql in payments_columns:
                if not _column_exists(cursor, "payments", col):
                    cursor.execute(sql)
                    changes.append(f"payments.{col}: columna añadida")
                else:
                    skipped.append(f"payments.{col}: ya existe")
        else:
            skipped.append("payments: tabla no existe, se omiten columnas nuevas")

        # ------------------------------------------------------------------ #
        # 4. Poblar monto_a_capital desde principal_payment (filas existentes)
        # ------------------------------------------------------------------ #
        if (
            _table_exists(cursor, "payments")
            and _column_exists(cursor, "payments", "principal_payment")
            and _column_exists(cursor, "payments", "monto_a_capital")
        ):
            cursor.execute(
                """
                UPDATE payments
                SET monto_a_capital = principal_payment
                WHERE monto_a_capital = 0.0
                  AND principal_payment IS NOT NULL
                  AND principal_payment != 0.0
                """
            )
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                changes.append(
                    f"payments.monto_a_capital: {rows_updated} fila(s) pobladas desde principal_payment"
                )
            else:
                skipped.append(
                    "payments.monto_a_capital: sin filas a poblar desde principal_payment"
                )

        # ------------------------------------------------------------------ #
        # 5. Poblar monto_a_interes desde interest_payment (filas existentes)
        # ------------------------------------------------------------------ #
        if (
            _table_exists(cursor, "payments")
            and _column_exists(cursor, "payments", "interest_payment")
            and _column_exists(cursor, "payments", "monto_a_interes")
        ):
            cursor.execute(
                """
                UPDATE payments
                SET monto_a_interes = interest_payment
                WHERE monto_a_interes = 0.0
                  AND interest_payment IS NOT NULL
                  AND interest_payment != 0.0
                """
            )
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                changes.append(
                    f"payments.monto_a_interes: {rows_updated} fila(s) pobladas desde interest_payment"
                )
            else:
                skipped.append(
                    "payments.monto_a_interes: sin filas a poblar desde interest_payment"
                )

        # ------------------------------------------------------------------ #
        # 6. Crear tabla interest_records
        # ------------------------------------------------------------------ #
        if not _table_exists(cursor, "interest_records"):
            cursor.execute(
                """
                CREATE TABLE interest_records (
                    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    loan_id             INTEGER NOT NULL
                                        REFERENCES loans(id) ON DELETE CASCADE,
                    monto_interes       REAL    NOT NULL,
                    capital_base        REAL    NOT NULL,
                    tasa_aplicada       REAL    NOT NULL,
                    interest_period_unit TEXT   NOT NULL,
                    fecha_generacion    DATE    NOT NULL,
                    asesor              TEXT    NOT NULL,
                    observacion         TEXT,
                    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            changes.append("interest_records: tabla creada")
        else:
            skipped.append("interest_records: tabla ya existe")

        # ------------------------------------------------------------------ #
        # 7. Crear tabla mora_records
        # ------------------------------------------------------------------ #
        if not _table_exists(cursor, "mora_records"):
            cursor.execute(
                """
                CREATE TABLE mora_records (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    loan_id      INTEGER NOT NULL
                                 REFERENCES loans(id) ON DELETE CASCADE,
                    monto        REAL    NOT NULL,
                    fecha_evento DATE    NOT NULL,
                    motivo       TEXT    NOT NULL,
                    observacion  TEXT,
                    asesor       TEXT    NOT NULL,
                    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            changes.append("mora_records: tabla creada")
        else:
            skipped.append("mora_records: tabla ya existe")

        conn.commit()

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.close()

    # ------------------------------------------------------------------ #
    # Resumen
    # ------------------------------------------------------------------ #
    print("\n" + "=" * 60)
    print("  MIGRACIÓN DLHB-CORE — Motor Financiero")
    print("=" * 60)
    print(f"  Base de datos: {DB_PATH.resolve()}")
    print()

    if changes:
        print(f"  ✅  Cambios aplicados ({len(changes)}):")
        for msg in changes:
            print(f"      • {msg}")
    else:
        print("  ✅  Sin cambios necesarios.")

    if skipped:
        print(f"\n  ⏭   Pasos omitidos (ya realizados) ({len(skipped)}):")
        for msg in skipped:
            print(f"      • {msg}")

    print("=" * 60 + "\n")


if __name__ == "__main__":
    migrate()
