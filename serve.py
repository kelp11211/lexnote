"""Fixed-origin, loopback-only static launcher. No application API."""
import argparse
import functools
import http.server
from pathlib import Path
import threading
import webbrowser


class LocalServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-browser', action='store_true', help='Start without opening a browser')
    args = parser.parse_args()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(Path(__file__).resolve().parent))
    try:
        server = LocalServer(('127.0.0.1', 8765), handler)
    except OSError:
        print('Port 8765 is unavailable. Close the existing server, or open its URL if it is Lexnote.')
        print('Do not change ports: browser data belongs to http://localhost:8765.')
        return 1
    print('Lexnote: http://localhost:8765 - press Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open('http://localhost:8765')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
