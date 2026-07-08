"""Dev server that mimics Vercel rewrites from vercel.json.

Run: python tools/dev_server.py [port]

Mirrors the current vercel.json rewrites so /suivi/:code, /app, /commander, etc.
behave the same locally as in production.

NOTE: this is a STATIC server. It does NOT run the Vercel Serverless Functions in
/api. Any request to /api/* returns an explicit 501 (not a silent 404). To exercise
the Functions locally, use `vercel dev` (serves static + /api + vercel.json rewrites).
"""
import http.server
import socketserver
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).parent.parent.resolve()
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

STATIC_REWRITES = {
    '/': '/index.html',
    '/app': '/app.html',
    '/commander': '/commander.html',
    '/dashboard': '/dashboard.html',
    '/postuler': '/postuler.html',
    '/mobilite': '/mobilite.html',
    '/admin': '/admin/editor.html',
}
SUIVI_RE = re.compile(r'^/suivi/([^/?#]+)/?$')


class VercelLikeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        # Point commun a do_GET ET do_HEAD : /api n'est pas servi ici (les Functions
        # Vercel ne tournent qu'avec `vercel dev`). 501 explicite plutot qu'un 404 muet
        # (ou pire, servir le .js source en HEAD) qui ferait croire a un bug de code.
        if self.path == '/api' or self.path.startswith('/api/') or self.path.startswith('/api?'):
            self.send_error(501, "Utiliser `vercel dev` pour tester les Functions /api (dev_server.py ne sert que le statique)")
            return None
        return super().send_head()

    def do_GET(self):
        parts = urlsplit(self.path)
        path_only = parts.path
        query = parts.query

        if path_only in STATIC_REWRITES:
            new_path = STATIC_REWRITES[path_only]
            self.path = new_path + (f'?{query}' if query else '')
        else:
            m = SUIVI_RE.match(path_only)
            if m:
                code = m.group(1)
                extra = f'&{query}' if query else ''
                self.path = f'/app.html?code={code}{extra}'

        # No-store on HTML responses to match vercel.json behavior
        return super().do_GET()

    def end_headers(self):
        if self.path.endswith('.html') or self.path.split('?')[0].endswith('.html'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[dev] {self.address_string()} - {fmt % args}\n")


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    os.chdir(ROOT)
    print(f"Chaskis dev server on http://localhost:{PORT}  (root: {ROOT})")
    with ReusableTCPServer(("", PORT), VercelLikeHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
