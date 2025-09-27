#!/usr/bin/env python3
"""
Badge Generator Service for Current-See

This script generates shareable achievement badges with user data
about solar energy savings.
"""

import os
import sys
import json
import argparse
from PIL import Image, ImageDraw, ImageFont
import io
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

# Configuration
BADGE_WIDTH = 800
BADGE_HEIGHT = 400
BADGE_BG_COLOR = (255, 251, 235)  # Light yellow
BADGE_FONT_COLOR = (50, 50, 50)    # Dark gray
BADGE_ACCENT_COLOR = (123, 193, 68)  # Green
BADGE_BORDER_COLOR = (255, 183, 0)  # Gold

# Directory for font files
FONT_DIR = os.path.join(os.getcwd(), "python_services", "fonts")

# Create fonts directory if it doesn't exist
os.makedirs(FONT_DIR, exist_ok=True)

# Try to load a nice font, fall back to default if not available
try:
    # Check if we have Arial or a similar font
    system_font_path = None
    
    # Check common font locations
    common_font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/Arial.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/System/Library/Fonts/Arial.ttf",  # macOS
        "C:\\Windows\\Fonts\\Arial.ttf"     # Windows
    ]
    
    for font_path in common_font_paths:
        if os.path.exists(font_path):
            system_font_path = font_path
            break
    
    if system_font_path:
        TITLE_FONT = ImageFont.truetype(system_font_path, 40)
        MAIN_FONT = ImageFont.truetype(system_font_path, 36)
        FOOTER_FONT = ImageFont.truetype(system_font_path, 24)
    else:
        # Use default font
        TITLE_FONT = ImageFont.load_default()
        MAIN_FONT = ImageFont.load_default()
        FOOTER_FONT = ImageFont.load_default()
        
except Exception as e:
    print(f"Warning: Could not load custom font: {e}")
    # Fall back to default font
    TITLE_FONT = ImageFont.load_default()
    MAIN_FONT = ImageFont.load_default()
    FOOTER_FONT = ImageFont.load_default()

def create_badge(username, energy_value, badge_type="offset", color_theme="default"):
    """
    Create a shareable achievement badge
    
    Args:
        username (str): User's name to display on the badge
        energy_value (str): Energy value to display (e.g., "14.2 kWh")
        badge_type (str): Type of achievement (offset, generated, saved)
        color_theme (str): Color theme for the badge
        
    Returns:
        bytes: PNG image data
    """
    # Create a new image
    img = Image.new('RGB', (BADGE_WIDTH, BADGE_HEIGHT), color=BADGE_BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Draw a border
    draw.rectangle(
        (10, 10, BADGE_WIDTH - 10, BADGE_HEIGHT - 10),
        outline=BADGE_BORDER_COLOR,
        width=4
    )
    
    # Apply different themes
    if color_theme == "green":
        bg_color = (240, 255, 240)
        accent_color = (0, 128, 0)
    elif color_theme == "blue":
        bg_color = (240, 248, 255)
        accent_color = (0, 102, 204)
    else:  # default
        bg_color = BADGE_BG_COLOR
        accent_color = BADGE_ACCENT_COLOR
    
    # Fill with theme background
    draw.rectangle(
        (14, 14, BADGE_WIDTH - 14, BADGE_HEIGHT - 14),
        fill=bg_color
    )
    
    # Add a sun icon in the corner
    sun_radius = 40
    draw.ellipse(
        (BADGE_WIDTH - 100, 50, BADGE_WIDTH - 20, 130),
        fill=BADGE_BORDER_COLOR
    )
    
    # Add title text
    title_text = "Solar Achievement"
    draw.text((40, 40), title_text, fill=BADGE_FONT_COLOR, font=TITLE_FONT)
    
    # Add main content - customize text based on badge type
    if badge_type == "offset":
        action_text = "offset"
    elif badge_type == "generated":
        action_text = "generated"
    elif badge_type == "saved":
        action_text = "saved"
    else:
        action_text = "achieved"
    
    main_text = f"{username} {action_text} {energy_value} today!"
    
    # Draw the main message
    text_width = draw.textlength(main_text, font=MAIN_FONT)
    text_x = (BADGE_WIDTH - text_width) / 2
    draw.text((text_x, 160), main_text, fill=accent_color, font=MAIN_FONT)
    
    # Draw a separator line
    draw.line((40, 250, BADGE_WIDTH - 40, 250), fill=BADGE_BORDER_COLOR, width=2)
    
    # Add footer text
    footer_text = "Powered by The Current-See"
    footer_date = "April 15, 2025"
    
    draw.text((40, 300), footer_text, fill=BADGE_FONT_COLOR, font=FOOTER_FONT)
    
    # Calculate width of date text to right-align it
    date_width = draw.textlength(footer_date, font=FOOTER_FONT)
    draw.text((BADGE_WIDTH - 40 - date_width, 300), footer_date, 
              fill=BADGE_FONT_COLOR, font=FOOTER_FONT)
    
    # Add website URL at bottom
    url_text = "www.thecurrentsee.org"
    draw.text((40, 340), url_text, fill=accent_color, font=FOOTER_FONT)
    
    # Convert to PNG in memory
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return buffer.getvalue()

class BadgeRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for badge generation service"""
    
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
        # Parse the path - expecting /generate_badge?name=User&kwh=14.2
        if self.path.startswith('/generate_badge'):
            # Extract query parameters
            query_components = self.path.split('?')
            if len(query_components) > 1:
                params = dict(urllib.parse.parse_qsl(query_components[1]))
                
                # Get parameters with defaults
                username = params.get('name', 'Solar Hero')
                energy_value = params.get('kwh', '0.0') + ' kWh'
                badge_type = params.get('type', 'offset')
                color_theme = params.get('theme', 'default')
                
                # Generate the badge
                badge_data = create_badge(
                    username=username,
                    energy_value=energy_value,
                    badge_type=badge_type,
                    color_theme=color_theme
                )
                
                # Determine if we should return PNG or base64
                format_type = params.get('format', 'png')
                
                if format_type == 'base64':
                    # Convert to base64 and return as JSON
                    base64_data = base64.b64encode(badge_data).decode('utf-8')
                    
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    
                    self.wfile.write(json.dumps({
                        'image': f'data:image/png;base64,{base64_data}'
                    }).encode('utf-8'))
                else:
                    # Return the PNG image directly
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-Type', 'image/png')
                    self.send_header('Content-Length', str(len(badge_data)))
                    self.end_headers()
                    
                    self.wfile.write(badge_data)
                
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

def start_server(port=5002):
    """
    Start the badge generator HTTP server
    
    Args:
        port (int): Port to listen on
    """
    server_address = ('', port)
    httpd = HTTPServer(server_address, BadgeRequestHandler)
    print(f"Starting badge generator service on port {port}")
    httpd.serve_forever()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Badge Generator Service')
    parser.add_argument('--name', help='Username to display on badge')
    parser.add_argument('--kwh', help='Energy value to display')
    parser.add_argument('--type', help='Badge type (offset, generated, saved)')
    parser.add_argument('--theme', help='Color theme (default, green, blue)')
    parser.add_argument('--output', help='Output file path (if not specified, prints base64)')
    parser.add_argument('--server', action='store_true', help='Run as a server')
    parser.add_argument('--port', type=int, default=5002, help='Port to run server on')
    
    args = parser.parse_args()
    
    if args.server:
        # Server mode
        start_server(args.port)
    elif args.name and args.kwh:
        # Single badge generation mode
        badge_data = create_badge(
            username=args.name,
            energy_value=args.kwh + ' kWh',
            badge_type=args.type or 'offset',
            color_theme=args.theme or 'default'
        )
        
        if args.output:
            # Save to file
            with open(args.output, 'wb') as f:
                f.write(badge_data)
            print(f"Badge saved to {args.output}")
        else:
            # Print base64 to stdout
            base64_data = base64.b64encode(badge_data).decode('utf-8')
            print(f"data:image/png;base64,{base64_data}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()