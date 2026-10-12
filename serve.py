#!/usr/bin/env python3
"""Serve only the web distribution on the local loopback interface."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent / 'docs'

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    if not (1 <= args.port <= 65535):
        parser.error('port must be 1..65535')
    if not (ROOT / 'index.html').exists():
        raise SystemExit('Run python build.py first.')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    except OSError as exc:
        raise SystemExit(f'Could not start server: {exc}\nTry another port: python serve.py --port 8001')
    url = f'http://localhost:{args.port}'
    print(f'Fran:D Director Desk: {url}\nKeep this window open. Press Ctrl+C to stop.')
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
