from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Max-Age', '86400')
        SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()

    def translate_path(self, path):
        # Remove any URL parameters
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        
        # Convert URL path to filesystem path
        path = path.replace('/', os.path.sep)
        if path.startswith(os.path.sep):
            path = path[1:]
        
        # Join with the current directory
        path = os.path.join(os.getcwd(), path)
        
        # Normalize the path
        return os.path.normpath(path)

def run_server():
    try:
        # Change to the Yu-Gi-Oh! Master Duel data directory
        data_dir = r'C:\Program Files (x86)\Steam\steamapps\common\Yu-Gi-Oh!  Master Duel\YgoMaster-Mod\Data'
        if not os.path.exists(data_dir):
            raise Exception(f"Data directory not found: {data_dir}")
        
        os.chdir(data_dir)
        print(f"Changed working directory to: {os.getcwd()}")
        
        # Start the server
        port = 8000
        server_address = ('', port)
        httpd = HTTPServer(server_address, CORSRequestHandler)
        print(f'Server running on port {port}...')
        print(f'Access the editor at: http://localhost:{port}/solo_editor.html')
        print(f'Press Ctrl+C to stop the server')
        httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server: {str(e)}")
        input("Press Enter to exit...")

if __name__ == '__main__':
    run_server() 