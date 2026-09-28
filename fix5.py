import re
file_path = 'src/components/admin/AiQuestionGeneratorUI.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = "className={`p-2.5 border rounded-xl flex items-start gap-2.5 cursor-pointer transition shadow-sm ${editingPromptId === p.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}"
content = re.sub(r'className=\{p-2\.5[\s\S]*?\}', replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
