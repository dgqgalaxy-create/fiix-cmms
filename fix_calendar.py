import json
import re

# Recover CalendarPage.tsx from transcript
with open(r'C:\Users\Mantenimiento\.gemini\antigravity-ide\brain\e9e28c1c-1651-4086-9bb2-bb87b97bc469\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            if 'tool_calls' in step:
                for tc in step['tool_calls']:
                    if tc['name'] == 'write_to_file' and 'CalendarPage.tsx' in tc['args'].get('TargetFile', ''):
                        with open(r'C:\Users\Mantenimiento\Documents\fiix-cmms\frontend\src\pages\CalendarPage.tsx', 'w', encoding='utf-8') as out:
                            out.write(tc['args']['CodeContent'])
        except:
            pass

f = 'frontend/src/pages/CalendarPage.tsx'
with open(f, 'r', encoding='utf-8') as fr:
    content = fr.read()

content = content.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n  \n  // Calendar State\n  const [currentView, setCurrentView] = useState<any>(Views.MONTH);\n  const [currentDate, setCurrentDate] = useState(new Date());')

target = '''defaultDate={new Date()}
            culture=\"es\"
            messages={{
              next: \"Sig\",
              previous: \"Ant\",
              today: \"Hoy\",
              month: \"Mes\",
              week: \"Semana\",
              day: \"Día\"
            }}'''

replacement = '''defaultDate={new Date()}
            date={currentDate}
            onNavigate={(date) => setCurrentDate(date)}
            view={currentView}
            onView={(view) => setCurrentView(view)}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            culture=\"es\"
            messages={{
              next: \"Sig\",
              previous: \"Ant\",
              today: \"Hoy\",
              month: \"Mes\",
              week: \"Semana\",
              day: \"Día\",
              agenda: \"Agenda\",
              date: \"Fecha\",
              time: \"Hora\",
              event: \"Evento\"
            }}'''

content = content.replace(target, replacement)
content = re.sub(r'(<h1[^>]*?text-slate-800)', r'\1 dark:text-slate-100', content)
content = re.sub(r'(<p[^>]*?text-slate-500)', r'\1 dark:text-slate-300', content)

with open(f, 'w', encoding='utf-8') as fw:
    fw.write(content)
print('Fixed')
