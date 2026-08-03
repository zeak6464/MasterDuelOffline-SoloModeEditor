from http.server import HTTPServer, SimpleHTTPRequestHandler
import difflib
import json
import os
import re
import shutil
import traceback
from urllib.parse import unquote, urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EDITOR_FILES = ('solo_editor.html', 'editor_app.js', 'editor_tools.js')


def strip_jsonc(text):
    out = []
    i = 0
    n = len(text)
    in_str = False
    esc = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            i += 2
            while i < n and text[i] not in '\n\r':
                i += 1
            continue
        if c == '/' and i + 1 < n and text[i + 1] == '*':
            i += 2
            while i + 1 < n and not (text[i] == '*' and text[i + 1] == '/'):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return re.sub(r',\s*([}\]])', r'\1', ''.join(out))


def load_jsonc(path):
    raw = open(path, encoding='utf-8').read()
    cleaned = strip_jsonc(raw)
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(cleaned.lstrip())
    return obj


def find_data_dir():
    candidates = [
        os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'Data')),
        r'C:\Program Files (x86)\Steam\steamapps\common\Yu-Gi-Oh!  Master Duel\YgoMaster-v1.76\YgoMaster\Data',
        r'C:\Program Files (x86)\Steam\steamapps\common\Yu-Gi-Oh!  Master Duel\YgoMaster-Mod\Data',
        r'C:\Program Files (x86)\Steam\steamapps\common\Yu-Gi-Oh!  Master Duel\YgoMaster\Data',
    ]
    for path in candidates:
        if os.path.isdir(path):
            return path
    raise Exception('Data directory not found. Tried:\n  - ' + '\n  - '.join(candidates))


def ensure_editor_files(data_dir):
    for name in EDITOR_FILES:
        src = os.path.join(SCRIPT_DIR, name)
        dst = os.path.join(data_dir, name)
        if os.path.isfile(src):
            shutil.copy2(src, dst)


def safe_join(root, relative):
    relative = relative.replace('\\', '/').lstrip('/')
    if '..' in relative.split('/'):
        raise ValueError('Invalid path')
    full = os.path.normpath(os.path.join(root, *relative.split('/')))
    root_norm = os.path.normpath(root)
    if not full.startswith(root_norm):
        raise ValueError('Path escapes data directory')
    return full


class EditorRequestHandler(SimpleHTTPRequestHandler):
    data_dir = None

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, *')
        self.send_header('Access-Control-Max-Age', '86400')
        self.send_header('Cache-Control', 'no-store')
        SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            # Browser often aborts video/image probes; keep the console clean.
            pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def log_error(self, format, *args):
        msg = format % args if args else str(format)
        # Don't dump full tracebacks for routine missing preview files / aborted clients
        if 'Broken pipe' in msg or 'ConnectionAbortedError' in msg or 'Connection reset' in msg:
            return
        if 'FileNotFoundError' in msg and ('.mp4' in msg or 'PackNames.json' in msg):
            return
        SimpleHTTPRequestHandler.log_error(self, format, *args)

    def send_error(self, code, message=None, explain=None):
        try:
            # Short 404 body so aborted video probes don't explode mid-write
            if code == 404:
                body = b'Not Found'
                self.send_response(404, message)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Connection', 'close')
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                    pass
                return
            super().send_error(code, message, explain)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def _send_json(self, code, payload):
        body = json.dumps(payload).encode('utf-8')
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length).decode('utf-8')
        return json.loads(raw) if raw else {}

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path == '/api/save':
                self.handle_save()
            elif path == '/api/list':
                self.handle_list()
            elif path == '/api/load':
                self.handle_load()
            elif path == '/api/exists':
                self.handle_exists()
            elif path == '/api/backups':
                self.handle_backups()
            elif path == '/api/restore':
                self.handle_restore()
            elif path == '/api/diff':
                self.handle_diff()
            else:
                self._send_json(404, {'ok': False, 'error': 'Unknown API route'})
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            traceback.print_exc()
            self._send_json(500, {'ok': False, 'error': str(e)})

    def handle_save(self):
        data = self._read_json_body()
        rel = data.get('path')
        content = data.get('content')
        if not rel or content is None:
            self._send_json(400, {'ok': False, 'error': 'path and content are required'})
            return
        full = safe_join(self.data_dir, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        # Backup existing file once per save
        if os.path.isfile(full):
            backup = full + '.bak'
            shutil.copy2(full, backup)
        if isinstance(content, (dict, list)):
            text = json.dumps(content, indent=2, ensure_ascii=False)
        else:
            text = str(content)
        with open(full, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
            if not text.endswith('\n'):
                f.write('\n')
        print(f'Saved {rel}')
        self._send_json(200, {'ok': True, 'path': rel})

    def handle_list(self):
        data = self._read_json_body()
        rel = data.get('path', '')
        full = safe_join(self.data_dir, rel) if rel else self.data_dir
        if not os.path.isdir(full):
            self._send_json(404, {'ok': False, 'error': 'Directory not found'})
            return
        files = sorted(
            name for name in os.listdir(full)
            if os.path.isfile(os.path.join(full, name))
        )
        dirs = sorted(
            name for name in os.listdir(full)
            if os.path.isdir(os.path.join(full, name))
        )
        self._send_json(200, {'ok': True, 'files': files, 'dirs': dirs})

    def handle_load(self):
        data = self._read_json_body()
        rel = data.get('path')
        if not rel:
            self._send_json(400, {'ok': False, 'error': 'path is required'})
            return
        full = safe_join(self.data_dir, rel)
        if not os.path.isfile(full):
            self._send_json(404, {'ok': False, 'error': 'File not found'})
            return
        if rel.lower().endswith(('.json', '.bak')) and (
            rel.lower().endswith('.json') or rel.lower().endswith('.json.bak')
        ):
            try:
                obj = load_jsonc(full)
                self._send_json(200, {'ok': True, 'data': obj})
                return
            except Exception:
                pass
        text = open(full, encoding='utf-8').read()
        self._send_json(200, {'ok': True, 'text': text})

    def handle_exists(self):
        data = self._read_json_body()
        rel = data.get('path')
        if not rel:
            self._send_json(400, {'ok': False, 'error': 'path is required'})
            return
        full = safe_join(self.data_dir, rel)
        self._send_json(200, {'ok': True, 'exists': os.path.isfile(full), 'path': rel})

    def handle_backups(self):
        backups = []
        root = self.data_dir
        for dirpath, _, filenames in os.walk(root):
            for name in filenames:
                if not name.endswith('.bak'):
                    continue
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, root).replace('\\', '/')
                original = rel[:-4] if rel.endswith('.bak') else rel
                backups.append({
                    'backup': rel,
                    'original': original,
                    'size': os.path.getsize(full),
                    'mtime': os.path.getmtime(full),
                })
        backups.sort(key=lambda x: x['mtime'], reverse=True)
        self._send_json(200, {'ok': True, 'backups': backups})

    def handle_restore(self):
        data = self._read_json_body()
        rel = data.get('path')
        if not rel:
            self._send_json(400, {'ok': False, 'error': 'path is required'})
            return
        # Accept either original path or .bak path
        if rel.endswith('.bak'):
            bak_rel = rel
            orig_rel = rel[:-4]
        else:
            orig_rel = rel
            bak_rel = rel + '.bak'
        bak_full = safe_join(self.data_dir, bak_rel)
        orig_full = safe_join(self.data_dir, orig_rel)
        if not os.path.isfile(bak_full):
            self._send_json(404, {'ok': False, 'error': f'Backup not found: {bak_rel}'})
            return
        # Keep a safety copy of current file before restore
        if os.path.isfile(orig_full):
            safety = orig_full + '.pre_restore'
            shutil.copy2(orig_full, safety)
        shutil.copy2(bak_full, orig_full)
        print(f'Restored {orig_rel} from {bak_rel}')
        self._send_json(200, {'ok': True, 'path': orig_rel, 'from': bak_rel})

    def handle_diff(self):
        data = self._read_json_body()
        rel = data.get('path')
        if not rel:
            self._send_json(400, {'ok': False, 'error': 'path is required'})
            return
        if rel.endswith('.bak'):
            bak_rel = rel
            orig_rel = rel[:-4]
        else:
            orig_rel = rel
            bak_rel = rel + '.bak'
        orig_full = safe_join(self.data_dir, orig_rel)
        bak_full = safe_join(self.data_dir, bak_rel)
        if not os.path.isfile(orig_full) or not os.path.isfile(bak_full):
            self._send_json(404, {'ok': False, 'error': 'Original or backup missing'})
            return
        orig_lines = open(orig_full, encoding='utf-8').read().splitlines()
        bak_lines = open(bak_full, encoding='utf-8').read().splitlines()
        diff = list(difflib.unified_diff(
            bak_lines, orig_lines,
            fromfile=bak_rel, tofile=orig_rel, lineterm=''
        ))
        self._send_json(200, {
            'ok': True,
            'original': orig_rel,
            'backup': bak_rel,
            'diff': diff[:2000],
            'truncated': len(diff) > 2000
        })

    def translate_path(self, path):
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        path = unquote(path)
        path = path.replace('/', os.path.sep)
        if path.startswith(os.path.sep):
            path = path[1:]
        return os.path.normpath(os.path.join(os.getcwd(), path))


def run_server():
    try:
        data_dir = find_data_dir()
        ensure_editor_files(data_dir)
        os.chdir(data_dir)
        EditorRequestHandler.data_dir = data_dir
        print(f'Changed working directory to: {os.getcwd()}')

        port = 8000
        httpd = HTTPServer(('', port), EditorRequestHandler)
        print(f'Server running on port {port}...')
        print(f'Access the editor at: http://localhost:{port}/solo_editor.html')
        print('Press Ctrl+C to stop the server')
        httpd.serve_forever()
    except Exception as e:
        print(f'Error starting server: {e}')
        traceback.print_exc()
        try:
            input('Press Enter to exit...')
        except EOFError:
            pass


if __name__ == '__main__':
    run_server()
