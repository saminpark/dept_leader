#!/usr/bin/env python3
"""Build the static docs/ distribution and a self-contained HTML file. No dependencies."""
from pathlib import Path
import base64
import hashlib
import re
import shutil

ROOT = Path(__file__).resolve().parent
WEB = ['index.html', 'styles.css', 'config.js', 'seed.js', 'core.js', 'google-docs.js', 'app.js']

def main() -> None:
    out = ROOT / 'docs'
    out.mkdir(exist_ok=True)
    for name in WEB:
        shutil.copy2(ROOT / name, out / name)
    (out / '.nojekyll').write_text('', encoding='utf-8')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'styles.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    hashes = []
    inline_scripts = []
    for name in WEB[2:]:
        script = '\n' + (ROOT / name).read_text(encoding='utf-8').replace('</script', '<\\/script') + '\n'
        hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'")
        inline_scripts.append('<script>' + script + '</script>')
        html, count = re.subn(r'<script\s+src="' + re.escape(name) + r'"\s+defer></script>', '', html)
        if count != 1:
            raise RuntimeError(f'Expected one script include: {name}; got {count}')
    html = html.replace("script-src 'self'", "script-src 'self' " + ' '.join(hashes))
    html = html.replace('</body>', '\n'.join(inline_scripts) + '\n</body>')
    target = ROOT / 'FranD_Director_Desk.html'
    target.write_text(html, encoding='utf-8')
    print(f'Static files: {out}\nStandalone: {target} ({target.stat().st_size:,} bytes)')

if __name__ == '__main__':
    main()
