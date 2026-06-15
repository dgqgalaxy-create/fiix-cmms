import urllib.request
import re
from collections import Counter

try:
    from PIL import Image
    import io
except ImportError:
    import os
    os.system("pip install pillow")
    from PIL import Image
    import io

# Fetch HTML
req = urllib.request.Request('https://lpet.com.mx/', headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')

# Find logo
logos = re.findall(r'src="([^"]*(?:logo|icon)[^"]*\.(?:png|jpg|svg))"', html, re.IGNORECASE)
print(f"Found logos: {logos}")
if not logos:
    print("No logo found.")
else:
    for logo_url in logos:
        print(f"Analyzing Logo URL: {logo_url}")
        if logo_url.endswith('.svg'):
            try:
                req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
                svg = urllib.request.urlopen(req).read().decode('utf-8')
                colors = re.findall(r'#[0-9a-fA-F]{3,6}', svg)
                print("SVG Colors:", Counter(colors).most_common(5))
            except Exception as e:
                print(f"Error reading SVG: {e}")
        else:
            try:
                req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
                img_data = urllib.request.urlopen(req).read()
                img = Image.open(io.BytesIO(img_data)).convert('RGB')
                
                # Get colors
                colors = img.getcolors(img.size[0] * img.size[1])
                if not colors:
                    continue
                valid_colors = []
                for count, color in colors:
                    r, g, b = color
                    # ignore white-ish
                    if r > 240 and g > 240 and b > 240: continue
                    # ignore black-ish
                    if r < 15 and g < 15 and b < 15: continue
                    valid_colors.append((count, color))
                    
                valid_colors.sort(reverse=True)
                print("Top 5 Image Colors (RGB):")
                for count, color in valid_colors[:5]:
                    print(f"#{color[0]:02x}{color[1]:02x}{color[2]:02x} (Count: {count})")
            except Exception as e:
                print(f"Error reading Image: {e}")
