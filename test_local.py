#!/usr/bin/env python3
"""
Script de test local pour l'API make-video
"""

import os
import sys
import tempfile
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import yt_dlp

# Simuler les variables d'environnement Vercel
os.environ['YOUTUBE_USERNAME'] = 'benjamin.arthuys@gmail.com'  # Remplace par ton email
os.environ['YOUTUBE_PASSWORD'] = '!M4ym4n32#'        # Remplace par ton mot de passe

# Importer la classe handler de l'API
sys.path.append('api')
import make_video

def test_api():
    """Test de l'API en local"""
    
    # Créer une requête de test
    class MockRequest:
        def __init__(self, path):
            self.path = path
    
    # Créer un handler de test
    class TestHandler(make_video.handler):
        def __init__(self):
            self.wfile = MockFile()
            self.headers_sent = False
            self.status_code = 200
        
        def send_response(self, code):
            self.status_code = code
            print(f"📡 Status: {code}")
        
        def send_header(self, name, value):
            if not self.headers_sent:
                print(f"📋 Header: {name}: {value}")
        
        def end_headers(self):
            self.headers_sent = True
            print("📋 Headers sent")
        
        def wfile_write(self, data):
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            print(f"📄 Response: {data}")
            return data
    
    class MockFile:
        def __init__(self):
            self.data = b""
        
        def write(self, data):
            if isinstance(data, bytes):
                self.data += data
            else:
                self.data += data.encode('utf-8')
            return data
        
        def get_data(self):
            return self.data
    
    # Test 1: Mode dry-run
    print("🧪 Test 1: Mode dry-run")
    test_handler = TestHandler()
    test_handler.path = "/api/make-video?videoId=test&dry=1"
    test_handler.do_GET()
    print("\n" + "="*50 + "\n")
    
    # Test 2: Test réel (si les credentials sont configurés)
    if os.environ.get('YOUTUBE_USERNAME') and os.environ.get('YOUTUBE_PASSWORD'):
        print("🧪 Test 2: Test réel avec authentification")
        test_handler = TestHandler()
        test_handler.path = "/api/make-video?videoId=dQw4w9WgXcQ&start=0&dur=30&text=Test%20Video"
        test_handler.do_GET()
    else:
        print("⚠️ Test 2: Skipped - Credentials non configurés")
        print("Configure YOUTUBE_USERNAME et YOUTUBE_PASSWORD dans le script")

if __name__ == "__main__":
    print("🚀 Test local de l'API make-video")
    print("="*50)
    test_api()
