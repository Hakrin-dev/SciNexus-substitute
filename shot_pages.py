# -*- coding: utf-8 -*-
import subprocess, os, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
tmp = os.environ['TEMP']
base = 'http://localhost:3100'
pages = [
    ('/', 'f_home.png', 1440, 1500),
    ('/submit', 'f_submit.png', 1440, 1650),
    ('/papers/rdt-1b', 'f_paper.png', 1440, 1100),
    ('/scholars', 'f_scholars.png', 1440, 1250),
    ('/scholars/kaiming-he', 'f_scholar_detail.png', 1440, 1500),
    ('/knowledge', 'f_knowledge.png', 1440, 900),
    ('/agents', 'f_agents.png', 1440, 1500),
    ('/agents/deep-search?q=diffusion', 'f_deep_search.png', 1440, 1650),
    ('/agents/deep-research', 'f_dr_home.png', 1440, 1250),
    ('/agents/deep-research?autostart=1', 'f_dr_running.png', 1440, 1500, 7500),
    ('/agents/deep-research?mode=instant', 'f_dr_report.png', 1440, 2400),
]
for p in pages:
    path, out, w, h = p[:4]
    budget = p[4] if len(p) > 4 else 6000
    r = subprocess.run([edge, '--headless', '--disable-gpu', f'--window-size={w},{h}',
                        '--hide-scrollbars', f'--virtual-time-budget={budget}',
                        '--screenshot=' + os.path.join(tmp, out), base + path],
                       capture_output=True, text=True)
    lines = (r.stderr or '').strip().splitlines()
    print(out, lines[-1] if lines else 'ok')
    time.sleep(1)
