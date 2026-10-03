"""Uji SQL: menjalankan database.sql di Postgres tertanam lalu skenario hak akses dan stok.
Pemakaian:  pip install pgserver   lalu   python tests/sql/run.py
Hasil dibaca dari teks di layar (tiap baris T.. menyebut yang diharapkan). Tidak menyentuh database Supabase Anda."""
import os, shutil, tempfile, pgserver
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.abspath(os.path.join(here, '..', '..'))
s = pgserver.get_server(tempfile.mkdtemp(prefix='taskpro-test-'))
s.psql(f"\\set ON_ERROR_STOP on\n\\i {here}/00_stub.sql")
s.psql(f"\\set ON_ERROR_STOP on\n\\i {root}/database.sql")
print(s.psql(f"\\i {here}/10_test.sql"))
print(s.psql(f"\\i {here}/20_project_test.sql"))
print(s.psql(f"\\i {here}/30_focus_test.sql"))
print(s.psql(f"\\i {here}/40_v12_test.sql"))
