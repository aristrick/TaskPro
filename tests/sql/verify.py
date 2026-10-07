"""Pemeriksa otomatis tes SQL (dipakai CI). Menjalankan run.py lalu membandingkan:
 1) baris hasil (T/P/F/V...) dengan expected_hasil.txt, dan
 2) daftar error yang memang diharapkan (penolakan oleh aturan akses) dengan expected_error.txt.
Gagal (exit 1) jika ada baris yang berubah, hilang, atau error tak terduga muncul.   Pemakaian: pip install pgserver; python tests/sql/verify.py"""
import os, re, subprocess, sys, difflib
here = os.path.dirname(os.path.abspath(__file__))
p = subprocess.run([sys.executable, os.path.join(here, 'run.py')], capture_output=True, text=True)
out = p.stdout + '\n' + p.stderr
hasil = [re.sub(r'\d{9}', 'NNNNNNNNN', l) for l in out.splitlines() if re.match(r'^(T\d+|P\d+|F\d+|V\d+|H\d+|E\d+)[ a-z]', l)]
errs = sorted(re.sub(r'\d+', 'N', m.strip()) for m in re.findall(r'ERROR:  (.*)', out))
def baca(f): return [l.rstrip('\n') for l in open(os.path.join(here, f)) if l.strip()]
gagal = False
for nama, aktual, harap in (('hasil', hasil, baca('expected_hasil.txt')), ('error', errs, baca('expected_error.txt'))):
    if aktual != harap:
        gagal = True
        print(f'--- {nama} TIDAK SESUAI harapan:')
        print('\n'.join(list(difflib.unified_diff(harap, aktual, 'diharapkan', 'aktual', lineterm=''))[:40]))
if gagal: sys.exit(1)
print(f'OK: {len(hasil)} baris hasil dan {len(errs)} penolakan sesuai harapan.')
