import re

file_path = 'src/components/admin/AiQuestionGeneratorUI.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the div with onClick={() => loadPrompt(p.id)} and replace it entirely.
pattern = re.compile(r'<div \n\s*key=\{p\.id\} \n\s*onClick=\{\(\) => loadPrompt\(p\.id\)\}\n\s*className=\{p-2\.5[\s\S]*?\} >', re.MULTILINE)

replacement = '''<div 
                        key={p.id} 
                        onClick={() => loadPrompt(p.id)}
                        className={p-2.5 border rounded-xl flex items-start gap-2.5 cursor-pointer transition shadow-sm }
                      >'''

if pattern.search(content):
    content = pattern.sub(replacement, content)
else:
    # Just to be safe, replace the exact broken text manually
    content = content.replace("className={p-2.5 border rounded-xl flex items-start gap-2.5 cursor-pointer transition \nshadow-sm \n                          }", "className={p-2.5 border rounded-xl flex items-start gap-2.5 cursor-pointer transition shadow-sm }")
    
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
