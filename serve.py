from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


HOST = "127.0.0.1"
PORT = 5500
ROOT = Path(__file__).resolve().parent


def main():
    handler = SimpleHTTPRequestHandler
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
