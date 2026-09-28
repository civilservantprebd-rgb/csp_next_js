file_path = 'src/components/admin/AiQuestionGeneratorUI.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the broken className={p-2.5 ... } with className={p-2.5 ... }
import re

broken = re.search(r'className=\{p-2\.5 border rounded-xl flex items-start gap-2\.5 cursor-pointer transition \nshadow-sm \n\s*\$\{editingPromptId === p\.id \n\s*\? \'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500\' \n\s*: \'bg-white border-slate-200 hover:border-indigo-300\'\}\}', content)

if broken:
    content = content.replace(broken.group(0), 'className={p-2.5 border rounded-xl flex items-start gap-2.5 cursor-pointer transition shadow-sm }')
else:
    # Try more generic replacement
    broken2 = re.search(r'className=\{p-2\.5(.*?)\}', content, re.DOTALL)
    if broken2:
        inner = broken2.group(1)
        content = content.replace(broken2.group(0), 'className={p-2.5' + inner + '}')
        print("Fixed generic")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed backticks!")
