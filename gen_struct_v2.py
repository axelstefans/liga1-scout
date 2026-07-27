import os
import fnmatch
from datetime import datetime

IGNORE_DIRS = {'.git', 'node_modules', 'venv', '.venv', '__pycache__', 'dist', 'build', 'coverage'}
IGNORE_PATTERNS = ['*-lock.json', '*.lock', '.env', '*.pyc', '.*_cache']
TOOLING_DIRS = {'.agents', '.specify', '.gemini'}

def should_ignore(name, is_dir):
    if is_dir and name in IGNORE_DIRS:
        return True
    if is_dir and name.endswith('_cache') and name.startswith('.'):
        return True
    for pat in IGNORE_PATTERNS:
        if fnmatch.fnmatch(name, pat):
            return True
    return False

def build_tree(path, depth, inside_tooling=False):
    try:
        entries = os.listdir(path)
    except PermissionError:
        return []
    
    dirs = []
    files = []
    for e in entries:
        full_path = os.path.join(path, e)
        if os.path.islink(full_path):
            continue
        is_dir = os.path.isdir(full_path)
        if should_ignore(e, is_dir):
            continue
        if is_dir:
            dirs.append(e)
        else:
            files.append(e)
            
    dirs.sort()
    files.sort()
    
    basename = os.path.basename(path)
    
    is_tooling_root = basename in TOOLING_DIRS
    if is_tooling_root:
        inside_tooling = True
        
    if inside_tooling and not is_tooling_root:
        return [{'name': '...', 'is_dir': False, 'children': []}]
        
    if basename in ('player_images', 'images', 'assets', 'public') and depth > 1:
        if basename == 'public' and 'player_images' in dirs:
            pass # allow descending into public to collapse player_images
        else:
            return [{'name': '...', 'is_dir': False, 'children': []}]
    
    if depth >= 6 and (len(dirs) + len(files)) >= 15:
        return [{'name': '...', 'is_dir': False, 'children': []}]
        
    children = []
    for d in dirs:
        full_d = os.path.join(path, d)
        sub = build_tree(full_d, depth + 1, inside_tooling)
        children.append({'name': d, 'is_dir': True, 'children': sub})
        
    if is_tooling_root:
        if files:
            children.append({'name': '...', 'is_dir': False, 'children': []})
    elif len(files) > 15:
        for f in files[:3]:
            children.append({'name': f, 'is_dir': False, 'children': []})
        children.append({'name': '...', 'is_dir': False, 'children': []})
        for f in files[-3:]:
            children.append({'name': f, 'is_dir': False, 'children': []})
    else:
        for f in files:
            children.append({'name': f, 'is_dir': False, 'children': []})
            
    return children

def format_tree(nodes, level=0):
    lines = []
    indent = '    ' * level
    for node in nodes:
        name = node['name']
        lines.append(f"{indent}{name}")
        lines.extend(format_tree(node['children'], level + 1))
    return lines

root = '.'
tree = build_tree(root, 1)

out_lines = ['# Project Structure', f'Generated on: {datetime.now().isoformat()}', '```text']
out_lines.extend(format_tree(tree, 0))
out_lines.append('```\n')

with open('project_structure.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))
