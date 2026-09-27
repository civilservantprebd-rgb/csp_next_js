const fs = require('fs');

let pageCode = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// 1. Add missing imports
pageCode = pageCode.replace(
  '    Pin\n} from "lucide-react";',
  '    Pin,\n    Edit2,\n    CheckCircle2,\n    Trash2,\n    Plus\n} from "lucide-react";'
);
pageCode = pageCode.replace(
  '    Pin\r\n} from "lucide-react";',
  '    Pin,\r\n    Edit2,\r\n    CheckCircle2,\r\n    Trash2,\r\n    Plus\r\n} from "lucide-react";'
);

// 2. Add 'topics' to valid tabs
pageCode = pageCode.replace(
  '"payments", "ai_question_generator"',
  '"payments", "ai_question_generator", "topics"'
);

// 3. Inject topics tab UI
const topicTabJSX = `
            {activeTab === "topics" && (
              <div className="space-y-5">
                <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> নতুন টপিক যোগ করুন
                  </h3>
                  <form onSubmit={handleAddTopic} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      placeholder="নতুন টপিকের নাম (যেমন: বাংলা সাহিত্য > প্রাচীন যুগ)"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm transition whitespace-nowrap shadow cursor-pointer"
                    >
                      যোগ করুন
                    </button>
                  </form>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-xs sm:text-sm">বিদ্যমান টপিকসমূহ</h3>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {(config.topics || []).map((topic, idx) => ({ topic, idx })).sort((a,b) => a.topic.localeCompare(b.topic)).map(({ topic, idx }) => {
                      const parts = topic.split('>').map(p => p.trim());
                      const depth = parts.length - 1;
                      const displayName = parts[depth];
                      return (
                      <li key={idx} className="p-3 sm:p-4 hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition border-l-2 border-transparent hover:border-indigo-300" style={{ paddingLeft: \`calc(1rem + \${depth * 2}rem)\` }}>
                        {editingTopicIdx === idx ? (
                          <form onSubmit={(e) => { e.preventDefault(); handleSaveTopicEdit(idx); }} className="flex-1 flex gap-2 w-full">
                            <input
                              type="text"
                              value={editTopicName}
                              onChange={(e) => setEditTopicName(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-xl border border-indigo-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> সেভ
                            </button>
                            <button type="button" onClick={() => setEditingTopicIdx(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer">
                              বাতিল
                            </button>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-700 text-xs sm:text-sm" title={topic}>
                                {depth > 0 && <span className="text-slate-300 mr-1">↳</span>} {displayName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => {
                                  setEditingTopicIdx(idx);
                                  setEditTopicName(topic);
                                }}
                                className="flex-1 sm:flex-none text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-medium transition flex justify-center items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> এডিট
                              </button>
                              <button
                                onClick={() => handleDeleteTopic(idx)}
                                className="flex-1 sm:flex-none text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl text-xs font-medium transition flex justify-center items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> ডিলিট
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    )})}
                  </ul>
                </div>
              </div>
            )}
`;

pageCode = pageCode.replace(
  '{activeTab === "subjects" && (',
  topicTabJSX.trim() + '\n\n              {activeTab === "subjects" && ('
);

fs.writeFileSync('src/app/admin/page.tsx', pageCode, 'utf8');
console.log("Successfully restored and applied new tree UI");
