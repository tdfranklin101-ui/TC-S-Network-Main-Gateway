#!/usr/bin/env python3
"""
Geolocation Service for Current-See using GeoIP2

This script provides geolocation functionality using the MaxMind GeoIP2 database.
It can be run as a standalone microservice that the Node.js application interacts with.
"""

import os
import sys
import json
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket
import traceback

# Flag to indicate if geoip2 is available
GEOIP2_AVAILABLE = False

try:
    import geoip2.database
    GEOIP2_AVAILABLE = True
except ImportError:
    print("Warning: geoip2 module not installed. Using fallback geolocation data.")

# Path to the GeoLite2 City database
DB_PATH = os.path.join(os.getcwd(), "geo_data", "GeoLite2-City.mmdb")

# Initialize the reader outside of handler for better performance
reader = None
if GEOIP2_AVAILABLE and os.path.exists(DB_PATH):
    try:
        reader = geoip2.database.Reader(DB_PATH)
        print(f"GeoIP2 database loaded from {DB_PATH}")
    except Exception as e:
        print(f"Error loading GeoIP2 database: {e}")
        traceback.print_exc()
else:
    if not GEOIP2_AVAILABLE:
        print("geoip2 module not available. Install with: pip install geoip2")
    if not os.path.exists(DB_PATH):
        print(f"GeoIP2 database file not found at {DB_PATH}")

def get_location_data(ip_address):
    """
    Get location data for an IP address
    
    Args:
        ip_address (str): The IP address to look up
        
    Returns:
        dict: Location data including city, country, etc.
    """
    # Check if the IP is a local/private IP
    if ip_address.startswith(('10.', '172.16.', '192.168.', '127.', 'localhost', '::1')):
        return fallback_location_data(ip_address, reason="Local IP address")
    
    # Try to use the GeoIP2 database if available
    if reader:
        try:
            response = reader.city(ip_address)
            return {
                "city": response.city.name or "Unknown",
                "region": response.subdivisions.most_specific.name if response.subdivisions else "Unknown",
                "country": response.country.name or "Unknown",
                "country_code": response.country.iso_code or "Unknown",
                "postal_code": response.postal.code or "Unknown",
                "latitude": response.location.latitude,
                "longitude": response.location.longitude,
                "time_zone": response.location.time_zone or "Unknown",
                "ip": ip_address,
                "source": "geoip2"
            }
        except Exception as e:
            print(f"Error looking up IP {ip_address}: {e}")
            return fallback_location_data(ip_address, reason=str(e))
    else:
        return fallback_location_data(ip_address, reason="GeoIP2 database not available")

def fallback_location_data(ip_address, reason="Unknown error"):
    """
    Provide fallback location data when GeoIP2 is unavailable
    
    Args:
        ip_address (str): The IP address
        reason (str): Reason for using fallback
        
    Returns:
        dict: Default location data
    """
    return {
        "city": "Unknown",
        "region": "Unknown",
        "country": "Unknown",
        "country_code": "UN",
        "postal_code": "Unknown",
        "latitude": 0,
        "longitude": 0,
        "time_zone": "UTC",
        "ip": ip_address,
        "source": "fallback",
        "reason": reason
    }

def resolve_hostname(hostname):
    """
    Resolve a hostname to an IP address
    
    Args:
        hostname (str): The hostname to resolve
        
    Returns:
        str: The resolved IP address or None if failure
    """
    try:
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return None

class GeolocationRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for geolocation service"""
    
    def send_cors_headers(self):
        """Send CORS headers to allow cross-origin requests"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_cors_headers()
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        # Parse the path - expecting /geolocate?ip=1.2.3.4
        if self.path.startswith('/geolocate'):
            # Extract IP from query string
            query_components = self.path.split('?')
            if len(query_components) > 1:
                params = {}
                for param in query_components[1].split('&'):
                    if '=' in param:
                        key, value = param.split('=', 1)
                        params[key] = value
                
                ip_address = params.get('ip', '')
                hostname = params.get('hostname', '')
                
                # If hostname is provided, try to resolve it
                if hostname and not ip_address:
                    ip_address = resolve_hostname(hostname)
                
                # If no IP provided, use the client's IP
                if not ip_address:
                    ip_address = self.client_address[0]
                
                # Get location data
                location = get_location_data(ip_address)
                
                # Send response
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                # Convert to JSON and send
                self.wfile.write(json.dumps(location).encode('utf-8'))
                return
        
        # If we get here, it's an unhandled path
        self.send_response(404)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            "error": "Not Found",
            "message": f"Path {self.path} not found"
        }).encode('utf-8'))

def start_server(port=5001):
    """
    Start the geolocation HTTP server
    
    Args:
        port (int): Port to listen on
    """
    server_address = ('', port)
    httpd = HTTPServer(server_address, GeolocationRequestHandler)
    print(f"Starting geolocation service on port {port}")
    httpd.serve_forever()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Geolocation Service for Current-See')
    parser.add_argument('--ip', help='IP address to look up')
    parser.add_argument('--server', action='store_true', help='Run as a server')
    parser.add_argument('--port', type=int, default=5001, help='Port to run server on')
    
    args = parser.parse_args()
    
    if args.ip:
        # Single lookup mode
        result = get_location_data(args.ip)
        print(json.dumps(result, indent=2))
    elif args.server:
        # Server mode
        start_server(args.port)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()