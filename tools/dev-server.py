#!/usr/bin/env python3
"""Static file server for development.

Plain `http.server` lets the browser cache ES modules, so edits silently do
not show up until a hard reload. This sends no-store on everything.

Binds every interface so a phone on the same wifi can reach it — emulation
gets the layout right but not real fingers or Safari's quirks.

    python3 tools/dev-server.py [port]
"""
import socket
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    # Not in Python's table, and the browser ignores a manifest served as
    # text/plain.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (args[0] if args else ""):
            return  # one line per asset is just noise
        super().log_message(fmt, *args)


def lan_address():
    """Best guess at this machine's address on the local network."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.0.2.1", 1))  # TEST-NET-1, never actually reached
            return s.getsockname()[0]
    except OSError:
        return None


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(NoCacheHandler, directory=".")
    with ThreadingHTTPServer(("0.0.0.0", port), handler) as server:
        print(f"Björn körs på http://localhost:{port}")
        lan = lan_address()
        if lan:
            print(f"  från telefonen (samma wifi): http://{lan}:{port}")
        print(f"  mobilvy i webbläsaren:        http://localhost:{port}/tools/mobile-preview.html")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
