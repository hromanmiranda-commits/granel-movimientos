import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run_server():
    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), Handler) as httpd:
                print(f"==================================================")
                print(f" Granel Movimientos Presentation HTTP Server Active")
                print(f" URL: http://localhost:{port}")
                print(f" Serving from: {DIRECTORY}")
                print(f"==================================================")
                sys.stdout.flush()
                httpd.serve_forever()
        except OSError:
            port += 1

if __name__ == "__main__":
    run_server()
