#!/usr/bin/env python

import BaseHTTPServer
import os.path
from mimetypes import MimeTypes
from urlparse import urlparse

mime = MimeTypes()

class Handler( BaseHTTPServer.BaseHTTPRequestHandler ):
    def do_GET( self ):
        path = urlparse('client' + self.path).path
        if not os.path.isfile(path):
            path = 'client/index.html'
        self.send_response(200)
        self.send_header( 'Content-type', mime.guess_type(path)[0] )
        self.end_headers()
        self.wfile.write( open(path).read() )

httpd = BaseHTTPServer.HTTPServer( ('127.0.0.1', 9999), Handler )
httpd.serve_forever()
