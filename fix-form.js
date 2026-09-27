const fs = require('fs');

let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

const formStart = code.indexOf('<form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">');
const formEndStr = '</form>';
const formEnd = code.indexOf(formEndStr, formStart) + formEndStr.length;

if (formStart > -1 && formEnd > formStart) {
    const newFormContent = `
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs sm:text-sm font-bold text-slate-700">প্রশ্ন, অপশন ও ব্যাখ্যা (Smart Paste)</label>
              <button type="button" onClick={() => setRawText(SAMPLE_TEXT)} className="text-xs text-indigo-600 hover:underline cursor-pointer">নমুনা দেখুন</button>
            </div>
            <textarea
              required
              rows={8}
              placeholder="১. প্রশ্ন...\\nক) অপশন...\\nউত্তর: ক\\nব্যাখ্যা: ..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white font-mono"
            />
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">
              বাল্ক ইম্পোর্টের মতো একই ফরম্যাটে প্রশ্ন পেস্ট করুন। আপনি চাইলে একসাথে একাধিক প্রশ্নও পেস্ট করতে পারেন।
            </p>
          </div>

          <div>
            <TopicTreeSelector
              selectedTopicPath={selectedTopic}
              onSelectTopicPath={(path) => setSelectedTopic(path)}
              topics={mergedTopics}
              onTopicsUpdated={() => onRefresh()}
              label="প্রশ্নের টপিক ও সাব-টপিক নির্ধারণ"
              helperText="টপিক নির্বাচন করুন অথবা যেকোনো স্তরে সাব-টপিক তৈরি করুন (পরবর্তী প্রশ্নে বজায় থাকবে)"
            />
          </div>
          
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer disabled:opacity-50"
            >
              {editingIndex !== null ? "প্রশ্ন আপডেট করুন" : "প্রশ্ন যোগ করুন"}
            </button>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                বাতিল
              </button>
            )}
          </div>
        </form>
`;
    code = code.substring(0, formStart) + newFormContent + code.substring(formEnd);
    fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
    console.log("Successfully replaced the JSX form!");
} else {
    console.log("Could not find form boundaries.");
}
