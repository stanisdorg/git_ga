#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
from datetime import datetime

PORT = int(os.environ.get('PORT', '8081'))

# Paths for persistence
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
METADATA_PATH = os.path.join(DATA_DIR, 'metadata.json')
TRASH_PATH = os.path.join(DATA_DIR, 'trash.json')

# Global storage for trash bin and metadata (loaded/saved to disk)
trash_bin = []
metadata = {
    'duplicated_items': [],
    'category_order': {},
    'subcategory_order': {},
    'card_order': {}
}

def ensure_data_dir():
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
    except Exception:
        pass

def load_state():
    """Load metadata and trash from disk if available."""
    global metadata, trash_bin
    ensure_data_dir()
    # Load metadata
    try:
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                raw = json.load(f)
            # Accept both snake_case and camelCase keys
            m = {
                'duplicated_items': raw.get('duplicated_items', []),
                'category_order': raw.get('category_order') or raw.get('categoryOrder') or {},
                'subcategory_order': raw.get('subcategory_order') or raw.get('subcategoryOrder') or {},
                'card_order': raw.get('card_order') or raw.get('orderOverrides') or raw.get('cardOrder') or {}
            }
            metadata = m
    except Exception:
        # Keep defaults on any error
        pass
    # Load trash
    try:
        if os.path.exists(TRASH_PATH):
            with open(TRASH_PATH, 'r', encoding='utf-8') as f:
                trash = json.load(f)
            if isinstance(trash, list):
                trash_bin = trash
    except Exception:
        pass

def save_metadata():
    """Persist metadata to disk in snake_case keys."""
    ensure_data_dir()
    out = {
        'duplicated_items': metadata.get('duplicated_items', []),
        'category_order': metadata.get('category_order', {}),
        'subcategory_order': metadata.get('subcategory_order', {}),
        'card_order': metadata.get('card_order', {})
    }
    try:
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
    except Exception:
        # Ignore persistence errors; in-memory state remains
        pass

def save_trash():
    """Persist trash_bin to disk."""
    ensure_data_dir()
    try:
        with open(TRASH_PATH, 'w', encoding='utf-8') as f:
            json.dump(trash_bin, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

# Load initial state
load_state()

class SaveHandler(http.server.BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_POST(self):
        if self.path == '/save':
            return self.handle_save()
        elif self.path == '/trash':
            return self.handle_trash()
        elif self.path == '/duplicate':
            return self.handle_duplicate()
        elif self.path == '/restore':
            return self.handle_restore()
        elif self.path == '/delete-permanent':
            return self.handle_delete_permanent()
        elif self.path == '/metadata':
            return self.handle_metadata()
        else:
            self.send_response(404)
            self._set_cors()
            self.end_headers()
            return

    def handle_save(self):
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
        except Exception:
            self.send_response(400)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': False, 'error': 'invalid_json' }).encode('utf-8'))
            return
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            target_path = os.path.join(base_dir, 'data', 'Копия вопросы.json')
            backup_path = os.path.join(base_dir, 'data', 'Копия вопросы copy.json')
            # backup
            try:
                if os.path.exists(target_path):
                    with open(target_path, 'r', encoding='utf-8') as f:
                        existing = f.read()
                    with open(backup_path, 'w', encoding='utf-8') as f:
                        f.write(existing)
            except Exception:
                pass
            # write new
            try:
                print(f"[handle_save] Saving {len(data) if isinstance(data, list) else 'non-list'} items to main JSON")
            except Exception:
                pass
            with open(target_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': True }).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': False, 'error': 'write_failed' }).encode('utf-8'))

    def handle_trash(self):
        """Handle moving items to trash bin"""
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
            items = data.get('items', [])
            
            # Add to trash bin with metadata
            for item in items:
                trash_item = {
                    'item': item,
                    'deleted_at': datetime.now().isoformat(),
                    'deleted_by': data.get('deleted_by', 'unknown')
                }
                trash_bin.append(trash_item)
            # Persist
            save_trash()
            
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': True, 'trash_size': len(trash_bin) }).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': False, 'error': str(e) }).encode('utf-8'))

    def handle_duplicate(self):
        """Handle duplicating items"""
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
            items = data.get('items', [])
            
            # Track duplicated items
            for item in items:
                dup_item = {
                    'original': item.get('original_question', ''),
                    'duplicate': item.get('new_question', ''),
                    'duplicated_at': datetime.now().isoformat(),
                    'duplicated_by': data.get('duplicated_by', 'unknown')
                }
                metadata['duplicated_items'].append(dup_item)
            save_metadata()
            
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': True }).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': False, 'error': str(e) }).encode('utf-8'))

    def handle_restore(self):
        """Handle restoring items from trash"""
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
            questions_to_restore = data.get('questions', [])
            
            # Remove from trash bin
            original_count = len(trash_bin)
            trash_bin[:] = [item for item in trash_bin if item['item']['question'] not in questions_to_restore]
            restored_count = original_count - len(trash_bin)
            save_trash()
            try:
                print(f"[handle_restore] Requested: {len(questions_to_restore)}; Restored: {restored_count}")
            except Exception:
                pass
            
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': True, 'restored_count': restored_count }).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': False, 'error': str(e) }).encode('utf-8'))

    def handle_delete_permanent(self):
        """Permanently delete items from trash bin (purge)."""
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
            # Accept either {questions: [...]} or {items: [{question: ...}, ...]}
            qs = set(data.get('questions') or [])
            for it in data.get('items', []):
                q = (it.get('question') if isinstance(it, dict) else None)
                if q:
                    qs.add(q)
            if not qs:
                self.send_response(400)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({ 'ok': False, 'error': 'no_questions_provided' }).encode('utf-8'))
                return

            before = len(trash_bin)
            trash_bin[:] = [item for item in trash_bin if item.get('item', {}).get('question') not in qs]
            deleted_count = before - len(trash_bin)
            save_trash()
            try:
                print(f"[handle_delete_permanent] Purged: {deleted_count} items")
            except Exception:
                pass
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': True, 'deleted_count': deleted_count }).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({ 'ok': False, 'error': str(e) }).encode('utf-8'))

    def do_GET(self):
        """Handle GET requests for metadata and trash bin"""
        if self.path == '/metadata':
            return self.handle_metadata()
        else:
            self.send_response(404)
            self._set_cors()
            self.end_headers()

    def handle_metadata(self):
        """Handle metadata operations (order, duplicates, etc.)"""
        if self.command == 'POST':
            # Update metadata
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                # Accept both snake_case and camelCase
                if 'category_order' in data or 'categoryOrder' in data:
                    metadata['category_order'] = data.get('category_order') or data.get('categoryOrder') or {}
                if 'subcategory_order' in data or 'subcategoryOrder' in data:
                    metadata['subcategory_order'] = data.get('subcategory_order') or data.get('subcategoryOrder') or {}
                # Cards order may be sent as card_order, cardOrder or orderOverrides
                if 'card_order' in data or 'cardOrder' in data or 'orderOverrides' in data:
                    metadata['card_order'] = data.get('card_order') or data.get('cardOrder') or data.get('orderOverrides') or {}
                save_metadata()
                self.send_response(200)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({ 'ok': True }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({ 'ok': False, 'error': str(e) }).encode('utf-8'))
        else:
            # GET - return metadata
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            # Always return snake_case keys
            self.wfile.write(json.dumps({
                'ok': True,
                'metadata': {
                    'duplicated_items': metadata.get('duplicated_items', []),
                    'category_order': metadata.get('category_order', {}),
                    'subcategory_order': metadata.get('subcategory_order', {}),
                    'card_order': metadata.get('card_order', {})
                },
                'trash_bin': trash_bin
            }).encode('utf-8'))

if __name__ == '__main__':
    with socketserver.TCPServer(("0.0.0.0", PORT), SaveHandler) as httpd:
        print(f"Save server running on http://0.0.0.0:{PORT}")
        httpd.serve_forever()
