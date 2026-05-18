import React, { useState, useMemo, useEffect } from 'react';
import { 
  Menu, 
  Shuffle, 
  User as UserIcon, 
  Settings, 
  Library as LibraryIcon, 
  Edit3, 
  Download, 
  CheckCircle,
  BookOpen,
  Sparkles,
  ChevronLeft,
  Save,
  Trash2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { db, auth, initAuth } from './firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp, orderBy, Timestamp } from 'firebase/firestore';

interface Word {
  id: number;
  pinyin: string;
  char: string;
}

interface SavedSheet {
  id: string;
  userId: string;
  title: string;
  wordLimit: number;
  words: Word[];
  createdAt: Timestamp;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const DEFAULT_WORDS = `阿姨,āyí
矮,ǎi
爱好,àihào
安静,ānjìng
把,bǎ
班,bān
搬,bān
半,bàn
办法,bànfǎ
办公室,bàngōngshì
帮忙,bāngmáng
包,bāo
饱,bǎo
北方,běifāng
被,bèi
鼻子,bízi
比较,bǐjiào
比赛,bǐsài
笔记本,bǐjìběn
必须,bìxū`;

export default function App() {
  const [view, setView] = useState<'setup' | 'sheet' | 'library'>('setup');
  const [inputText, setInputText] = useState(DEFAULT_WORDS);
  const [wordLimit, setWordLimit] = useState(20);
  const [words, setWords] = useState<Word[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [savedSheets, setSavedSheets] = useState<SavedSheet[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetTitle, setSheetTitle] = useState('My Vocabulary Sheet');

  useEffect(() => {
    initAuth().then(() => {
      setIsAuthReady(true);
      fetchLibrary();
    });
  }, []);

  const fetchLibrary = async () => {
    if (!auth.currentUser) return;
    const path = 'sheets';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const sheets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedSheet[];
      setSavedSheets(sheets);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const handleSaveSheet = async () => {
    if (!auth.currentUser || isSaving) return;
    setIsSaving(true);
    const path = 'sheets';
    try {
      await addDoc(collection(db, path), {
        userId: auth.currentUser.uid,
        title: sheetTitle,
        wordLimit,
        words,
        createdAt: serverTimestamp()
      });
      await fetchLibrary();
      alert('저장되었습니다!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSheet = async (id: string) => {
    const path = `sheets/${id}`;
    try {
      await deleteDoc(doc(db, 'sheets', id));
      setSavedSheets(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleOpenSavedSheet = (sheet: SavedSheet) => {
    setWords(sheet.words);
    setWordLimit(sheet.wordLimit);
    setSheetTitle(sheet.title);
    setShowAnswers(false);
    setUserAnswers({});
    setView('sheet');
  };

  const parsedWords = useMemo(() => {
    return inputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, index) => {
        // Find Chinese characters (Hanzi)
        const hanziMatch = line.match(/[\u4e00-\u9fa5]+/);
        const char = hanziMatch ? hanziMatch[0] : '';
        
        // Find Pinyin (alphabets with tone marks)
        // Look for the part after Hanzi but before the square brackets [ or Korean meanings
        let pinyin = '';
        if (hanziMatch && hanziMatch.index !== undefined) {
          const afterHanzi = line.substring(hanziMatch.index + char.length).trim();
          // Match alphabets, spaces, and specific tone marks
          const pinyinMatch = afterHanzi.match(/[a-zA-Zāēīōūǖāǎǎàáéěèíǐìóǒòúǔùǘǚǜ\s]+/);
          if (pinyinMatch) {
            pinyin = pinyinMatch[0].trim();
          }
        }

        // Fallback for simple comma/space formats
        if (!char) {
          const parts = line.split(/[,，\s]+/).filter(Boolean);
          return { id: index + 1, char: parts[0] || '', pinyin: parts[1] || '' };
        }

        return { 
          id: index + 1, 
          char: char, 
          pinyin: pinyin
        };
      })
      .filter(w => w.char.length > 0);
  }, [inputText]);

  const handleGenerate = () => {
    const shuffled = [...parsedWords].sort(() => Math.random() - 0.5);
    setWords(shuffled.slice(0, wordLimit));
    setShowAnswers(false);
    setUserAnswers({});
    setView('sheet');
  };

  const handleRandomize = () => {
    setWords(prev => [...prev].sort(() => Math.random() - 0.5));
    setShowAnswers(false);
    setUserAnswers({});
  };

  const handleAnswerChange = (idx: number, value: string) => {
    setUserAnswers(prev => ({ ...prev, [idx]: value }));
  };

  const currentProgress = 67;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-outline-variant flex items-center justify-between px-4 md:px-10 h-16 w-full sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-surface-container transition-colors rounded">
            <Menu className="w-6 h-6 text-primary" />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold text-primary">
            {view === 'setup' ? 'Generate Vocabulary Sheet' : view === 'library' ? 'My Library' : '암기 시트'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {view === 'sheet' && (
            <div className="flex gap-2">
              <button 
                onClick={handleSaveSheet}
                disabled={isSaving}
                className="bg-secondary text-white px-3 py-1.5 md:px-4 md:py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity text-xs font-semibold tracking-wider uppercase disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{isSaving ? '저장 중...' : '저장하기'}</span>
              </button>
              <button 
                onClick={handleRandomize}
                className="bg-primary-container text-on-primary-container px-3 py-1.5 md:px-4 md:py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity text-xs font-semibold tracking-wider uppercase"
              >
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">다시 랜덤화</span>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-[10px] font-bold text-primary uppercase tracking-tighter">
            <UserIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{isAuthReady ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1140px] mx-auto py-6 md:py-10 px-4 md:px-0">
        <AnimatePresence mode="wait">
          {view === 'setup' ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white border border-outline-variant p-6 md:p-10 rounded-xl shadow-sm">
                <header className="mb-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4 leading-tight">
                    Step 1: 설정 및 입력
                  </h2>
                  <p className="text-on-surface-variant leading-relaxed">
                    학습할 단어 수량을 선택하고, 아래 텍스트 영역에 단어 목록을 입력해 주세요. 
                    쉼표(,)나 줄바꿈으로 단어를 구분할 수 있습니다.
                  </p>
                </header>

                <div className="space-y-8">
                  <div>
                    <label className="block text-sm font-semibold text-primary mb-3">
                      단어 수량 선택
                    </label>
                    <div className="flex gap-1 p-1 bg-surface-container rounded-lg border border-outline-variant">
                      {[20, 30, 50].map((limit) => (
                        <button
                          key={limit}
                          onClick={() => setWordLimit(limit)}
                          className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                            wordLimit === limit 
                              ? "bg-primary text-white shadow-md" 
                              : "text-on-surface-variant hover:bg-surface-container-high"
                          )}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primary mb-3">
                      단어 목록 입력
                    </label>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="외울 단어들을 입력하세요 (예: 단어1, 단어2...)"
                      className="w-full min-h-[300px] p-4 bg-white border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-sans text-on-surface resize-none"
                    />
                    <div className="mt-2 text-right">
                      <span className="text-xs text-on-surface-variant font-medium">
                        현재 입력: {parsedWords.length}개 단어
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={parsedWords.length === 0}
                    className="w-full bg-primary text-white py-4 rounded-lg font-bold text-xl flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50"
                  >
                    생성하기
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : view === 'library' ? (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-primary">My Vocabulary Library</h2>
                <div className="text-sm font-medium text-on-surface-variant bg-surface-container px-4 py-2 rounded-full">
                  {savedSheets.length} Sheets Saved
                </div>
              </div>

              {savedSheets.length === 0 ? (
                <div className="text-center py-20 bg-white border border-outline-variant rounded-2xl border-dashed">
                  <LibraryIcon className="w-16 h-16 text-outline-variant mx-auto mb-4" />
                  <p className="text-lg text-on-surface-variant font-medium">저장된 시트가 없습니다.</p>
                  <button 
                    onClick={() => setView('setup')}
                    className="mt-4 text-primary font-bold text-sm underline underline-offset-4"
                  >
                    새 시트 만들기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedSheets.map(sheet => (
                    <div 
                      key={sheet.id}
                      className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow group relative"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" />
                          {sheet.createdAt?.toDate ? sheet.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </div>
                        <button 
                          onClick={() => handleDeleteSheet(sheet.id)}
                          className="p-2 text-outline hover:text-error transition-colors bg-surface-container rounded opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="text-xl font-bold text-primary mb-2">{sheet.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-on-surface-variant font-medium mb-6">
                        <span>{sheet.words.length} Words</span>
                        <span>{sheet.wordLimit} Limit</span>
                      </div>
                      <button 
                        onClick={() => handleOpenSavedSheet(sheet)}
                        className="w-full bg-surface-container text-primary font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all"
                      >
                        열기
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="sheet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Controls */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                  <button 
                    onClick={() => setView('setup')}
                    className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-sm mb-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    돌아가기
                  </button>
                  <p className="text-on-surface-variant text-sm font-medium mb-1">HSK Level 4 Vocabulary Practice</p>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
                      <span className="text-xs font-bold tracking-widest uppercase">Mastery: 42%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-outline"></div>
                      <span className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">Remaining: {words.length} words</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button className="flex-1 md:flex-none border border-primary text-primary px-5 py-2.5 rounded font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 hover:bg-surface-container transition-colors">
                    <Download className="w-4 h-4" />
                    PDF 다운로드
                  </button>
                  <button 
                    onClick={() => setShowAnswers(!showAnswers)}
                    className="flex-1 md:flex-none bg-primary text-white px-5 py-2.5 rounded font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {showAnswers ? '정답 숨기기' : '정답 확인하기'}
                  </button>
                </div>
              </div>

              {/* Grid */}
              <div className={cn(
                "bg-white border border-on-surface shadow-sm grid",
                wordLimit >= 30 ? "grid-cols-3" : "grid-cols-2"
              )}>
                {words.map((word, idx) => (
                  <div key={`${word.id}-${idx}`} className="study-cell">
                    <span className="absolute top-1.5 left-2 text-[10px] text-outline font-bold">{idx + 1}</span>
                    <div className="cell-top">
                      <input
                        type="text"
                        value={showAnswers ? word.pinyin : (userAnswers[idx] || '')}
                        onChange={(e) => handleAnswerChange(idx, e.target.value)}
                        placeholder={showAnswers ? "" : "입력..."}
                        className="w-full h-full bg-transparent text-center outline-none italic text-sm text-primary placeholder:text-outline-variant/50 focus:bg-surface-container-low transition-colors"
                      />
                    </div>
                    <div className="cell-bottom">
                      {word.char}
                    </div>
                  </div>
                ))}
                {/* Empty filler cells if needed to maintain grid structure */}
                {words.length % (wordLimit >= 30 ? 3 : 2) !== 0 && 
                  Array.from({ length: (wordLimit >= 30 ? 3 : 2) - (words.length % (wordLimit >= 30 ? 3 : 2)) }).map((_, i) => (
                    <div key={`filler-${i}`} className="study-cell bg-surface-container-low" />
                  ))
                }
              </div>

              {/* Bento Info Area */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-16">
                <div className="col-span-1 bg-surface-container-low border border-outline-variant p-8 rounded-2xl relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="text-xs font-bold tracking-widest text-primary uppercase mb-5">Study Tips</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                      Focus on the radicals of characters you find difficult. Research shows that connecting visual components to meaning speeds up long-term retention.
                    </p>
                  </div>
                  <BookOpen className="absolute -right-6 -bottom-6 w-32 h-32 text-on-surface/5 group-hover:scale-110 transition-transform duration-500" />
                </div>
                
                <div className="col-span-1 md:col-span-2 bg-primary-container text-white p-8 rounded-2xl relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <h3 className="text-xs font-bold tracking-widest text-white/60 uppercase mb-4">Current Goal</h3>
                      <p className="text-2xl md:text-3xl font-bold mb-6">Complete 100 words today</p>
                    </div>
                    <div>
                      <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mb-3">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${currentProgress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="bg-secondary h-full"
                        />
                      </div>
                      <p className="text-xs font-bold tracking-wider">{currentProgress}% Progress reached</p>
                    </div>
                  </div>
                  <Sparkles className="absolute -right-8 -top-8 w-48 h-48 text-white/5 opacity-40 group-hover:rotate-12 transition-transform duration-700" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 bg-white border-t border-outline-variant md:hidden">
        <button 
          onClick={() => setView('setup')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all px-4 py-2 rounded-full",
            view === 'setup' ? "bg-primary-container text-white" : "text-on-surface-variant"
          )}
        >
          <Edit3 className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Create</span>
        </button>
        <button 
          onClick={() => setView('library')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all px-4 py-2 rounded-full",
            view === 'library' ? "bg-primary-container text-white" : "text-on-surface-variant"
          )}
        >
          <LibraryIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Library</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant px-4 py-2">
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
        </button>
      </nav>
    </div>
  );
}
