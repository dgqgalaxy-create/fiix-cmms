import json
import os

files = ['frontend/src/pages/UserManual.tsx', 'frontend/src/pages/CalendarPage.tsx']

for f in files:
    with open(f, 'r', encoding='utf-8') as fr:
        content = fr.read().strip()
    
    # Try to decode if it is a JSON string literal
    if content.startswith('"') and content.endswith('"'):
        try:
            decoded = json.loads(content)
            with open(f, 'w', encoding='utf-8') as fw:
                fw.write(decoded)
            print(f'Decoded {f}')
        except Exception as e:
            print(f'Failed to decode {f}: {e}')
    else:
        print(f'{f} does not start or end with quotes')
