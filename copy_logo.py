import re

control_path = r"c:\Users\LXY\Desktop\meeting planner\timer-20260301\timer-20260301\ui\control.html"
display_path = r"c:\Users\LXY\Desktop\meeting planner\timer-20260301\timer-20260301\ui\display.html"

with open(control_path, "r", encoding="utf-8") as f:
    control_html = f.read()

# find first base64 image 
match = re.search(r'src="(data:image/png;base64,[^"]+)"', control_html)
if not match:
    print("Could not find base64 logo in control.html")
    exit(1)

b64_src = match.group(1)

with open(display_path, "r", encoding="utf-8") as f:
    display_html = f.read()

# Check if already inserted
if 'id="fs-logo"' not in display_html:
    insert_str = f'\n        <!-- Fullscreen Branding Logo -->\n        <img id="fs-logo" src="{b64_src}" alt="Logo">\n'
    
    # Insert after <div id="fs-backdrop"></div>
    target = '<div id="fs-backdrop"></div>'
    if target in display_html:
        display_html = display_html.replace(target, target + insert_str)
        with open(display_path, "w", encoding="utf-8") as f:
            f.write(display_html)
        print("Successfully inserted logo into display.html")
    else:
        print("Could not find fs-backdrop in display.html")
else:
    # update the source if it already exists
    display_html = re.sub(r'<img id="fs-logo" src="[^"]+" alt="Logo">', f'<img id="fs-logo" src="{b64_src}" alt="Logo">', display_html)
    with open(display_path, "w", encoding="utf-8") as f:
        f.write(display_html)
    print("Successfully updated logo in display.html")
