from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


HOST = "127.0.0.1"
PORT = 5500
ROOT = Path(__file__).resolve().parent


class NoCacheRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Force fresh files on every request during local development.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            fallback = ROOT / "404.html"
            if fallback.exists():
                try:
                    body = fallback.read_bytes()
                    self.send_response(404)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    if self.command != "HEAD":
                        self.wfile.write(body)
                    return
                except Exception:
                    pass
        super().send_error(code, message, explain)


def main():
    handler = NoCacheRequestHandler
    server = ThreadingHTTPServer((HOST, PORT), handler)
    print(f"Serving {ROOT} at http://{HOST}:{PORT}/index.html")
    try:
        webbrowser.open(f"http://{HOST}:{PORT}/index.html")
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
