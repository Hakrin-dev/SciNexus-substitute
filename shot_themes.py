# -*- coding: utf-8 -*-
"""日/夜模式对比截图:?theme=dark 由 layout 内联脚本识别"""
import subprocess, os, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
tmp = os.environ['TEMP']
base = 'http://localhost:3100'
shots = [
    ('/?theme=light', 'theme-home-day.png'),
    ('/?theme=dark', 'theme-home-night.png'),
    ('/agents?theme=dark', 'theme-agents-night.png'),
    ('/scholars?theme=dark', 'theme-scholars-night.png'),
    ('/submit?theme=dark', 'theme-submit-night.png'),
    ('/agents/deep-research?theme=dark', 'theme-dr-home-night.png'),
    ('/agents/deep-research?mode=instant&theme=dark', 'theme-dr-report-night.png'),
]
for path, out in shots:
    r = subprocess.run([edge, '--headless', '--disable-gpu', '--window-size=1440,1500',
                        '--hide-scrollbars', '--virtual-time-budget=8000',
                        '--screenshot=' + os.path.join(tmp, out), base + path],
                       capture_output=True, text=True)
    lines = (r.stderr or '').strip().splitlines()
    print(out, lines[-1] if lines else 'ok')
    time.sleep(1)
