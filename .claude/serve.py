"""Local preview server with HTTP Range support (so the trailer can seek, like Firebase Hosting)."""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        size = os.path.getsize(path)
        start = int(m.group(1) or 0)
        end = min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
        f = open(path, 'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        n = getattr(self, '_remaining', None)
        if n is None:
            return super().copyfile(source, outputfile)
        while n > 0:
            chunk = source.read(min(65536, n))
            if not chunk: break
            outputfile.write(chunk); n -= len(chunk)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ThreadingHTTPServer(('127.0.0.1', port), RangeHandler).serve_forever()
