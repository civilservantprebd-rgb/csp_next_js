import re
file_path = 'src/app/api/ai/draft/route.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const { object } = await generateObject({", "const { object } = await generateObject({\n      abortSignal: AbortSignal.timeout(60000),")
# Actually, I'll just add a console.log(object) before returning.
content = content.replace("return NextResponse.json({", "console.log('Generated Drafts:', object.questions.length);\n    return NextResponse.json({")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
