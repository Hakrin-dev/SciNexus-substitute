# -*- coding: utf-8 -*-
"""
日/夜 Logo 资产管线(用户定稿成品,直接使用,不做二次合成):
- 日间logo.png(白字黑底)→ 同目录 logo-day.png
- 夜间logo.png(黑字白底)→ 同目录 logo-night.png
- 日间图缩至 256px → ../app/icon.png(favicon)

运行: python frontend_v1/brand/process_logo.py
(logo-day.png / logo-night.png 由 logo.tsx 静态导入打包,无需 public/)
"""
import os, sys, io, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from PIL import Image

BRAND = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BRAND, '..', 'app')

def main():
    pairs = [('日间logo.png', 'logo-day.png'), ('夜间logo.png', 'logo-night.png')]
    for src_name, dst_name in pairs:
        dst = os.path.join(BRAND, dst_name)
        shutil.copyfile(os.path.join(BRAND, src_name), dst)
        print('brand/' + dst_name, os.path.getsize(dst), 'bytes')

    # favicon(日间版,256px 足够)
    icon = Image.open(os.path.join(BRAND, '日间logo.png'))
    icon.thumbnail((256, 256), Image.LANCZOS)
    icon.save(os.path.join(APP, 'icon.png'))
    print('app/icon.png', os.path.getsize(os.path.join(APP, 'icon.png')), 'bytes')

if __name__ == '__main__':
    main()
