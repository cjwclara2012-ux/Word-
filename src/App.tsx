/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Printer, Info, CheckCircle2, Trophy, MapPin, Play, ChevronRight, Home, Sparkles, Loader2, Image as ImageIcon, Link as LinkIcon, Type as TextIcon, Upload } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_WORDS = [
  '딤섬(Dim Sum)', 'MTR(MTR)', '에스컬레이터(Escalator)', '습도(Humidity)', '아파트(Apartment)',
  '학교(School)', '선생님(Teacher)', '친구(Friend)', '한국어(Korean)', '공부(Study)',
  '시장(Market)', '쇼핑몰(Shopping Mall)', '공원(Park)', '바다(Sea)', '산(Mountain)',
  '버스(Bus)', '택시(Taxi)', '스타페리(Star Ferry)', '트램(Tram)', '피크(The Peak)',
  '가족(Family)', '엄마(Mom)', '아빠(Dad)', '동생(Younger Sibling)', '할머니(Grandmother)'
];

interface Cell {
  id: number;
  name: string;
  isMarked: boolean;
}

type GameState = 'HOME' | 'PLAYING';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('HOME');
  const [gridSize, setGridSize] = useState<number>(5);
  const [topic, setTopic] = useState<string>('');
  const [level, setLevel] = useState<string>('초급1');
  const [urlInput, setUrlInput] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'text' | 'image' | 'url'>('text');
  
  const [activeTopic, setActiveTopic] = useState<string>('');
  const [activeLevel, setActiveLevel] = useState<string>('');
  const [analysisSource, setAnalysisSource] = useState<string>('');
  
  const [grid, setGrid] = useState<Cell[]>([]);
  const [bingoCount, setBingoCount] = useState(0);
  const [showBingoAlert, setShowBingoAlert] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setInputType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate items using Gemini
  const generateThemeItems = async (currentTopic: string, currentLevel: string, size: number) => {
    setIsGenerating(true);
    try {
      const count = size * size;
      
      const parts: any[] = [];
      
      // Add prompt
      let prompt = `### Role
당신은 시각 자료와 문서를 분석하여 학습 어휘를 추출하는 '스마트 한국어 교육 전문가'입니다.

### Context
- 입력 방식: ${inputType === 'image' ? '이미지(교재 캡처)' : inputType === 'url' ? '웹사이트 링크' : '텍스트 주제어'}
- 수업 대상: 홍콩 한국토요학교 학생들.
- 학습 단계: ${currentLevel}
- 목표: 제공된 자료에서 핵심 어휘를 뽑아 시각적 재미(이모티콘)와 함께 빙고판 구성.

### Task
제시된 자료 내용을 분석하여 주제와 단계에 딱 맞는 한국어 단어 ${count}개를 선정하세요.
- 각 단어는 반드시 '이모티콘 + 한국어(영어 뜻)' 형식을 유지해야 합니다.
- 예시: 🍎 사과(Apple), 🚌 버스(Bus)

### Constraints
1. 멀티모달 분석: 제공된 자료(텍스트/이미지/링크) 내의 핵심 어휘를 우선적으로 반영하여 단어 추출.
2. 일관성 유지: '다시 섞기' 요청 시, 분석된 원본 소스의 맥락을 100% 유지하며 단어만 교체.
3. 시각적 효과: 모든 단어 앞에 해당 단어를 설명하는 적절한 이모티콘을 반드시 추가.
4. 현지화: 홍콩 맥락이 포함된 자료라면 이를 적극 반영(예: 🥟 딤섬(Dim Sum), 🏙️ 침사추이(Tsim Sha Tsui)).

### Format (Strict JSON)
{
  "analysis_source": "${inputType === 'image' ? '이미지' : inputType === 'url' ? '링크' : '텍스트'}",
  "lesson_info": {"topic": "${currentTopic || '분석된 주제'}", "level": "${currentLevel}"},
  "bingo_data": ["EMOJI 단어1(Meaning)", "EMOJI 단어2(Meaning)", ..., "EMOJI 단어${count}(Meaning)"]
}`;

      parts.push({ text: prompt });

      // Add Image if available
      if (inputType === 'image' && uploadedImage) {
        const base64Data = uploadedImage.split(',')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        });
      }

      // Add URL or Topic Text
      if (inputType === 'url' && urlInput) {
        parts.push({ text: `분석할 링크: ${urlInput}` });
      } else if (currentTopic) {
        parts.push({ text: `분석할 주제/텍스트: ${currentTopic}` });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis_source: { type: Type.STRING },
              lesson_info: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  level: { type: Type.STRING }
                }
              },
              bingo_data: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["bingo_data", "analysis_source"]
          }
        }
      });
      
      const data = JSON.parse(response.text || '{"bingo_data": []}');
      if (data.bingo_data && data.bingo_data.length >= count) {
        setAnalysisSource(data.analysis_source || inputType);
        return data.bingo_data.slice(0, count);
      }
      throw new Error("Insufficient items generated");
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("자료를 분석하여 단어를 생성하는 데 실패했습니다. 다시 시도해 주세요.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Initialize or Shuffle Grid
  const shuffleGrid = useCallback(async (size: number = gridSize, customItems?: string[]) => {
    const totalCells = size * size;
    const sourceItems = customItems || DEFAULT_WORDS;
    
    const shuffled = [...sourceItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, totalCells)
      .map((name, index) => ({
        id: index,
        name,
        isMarked: false,
      }));
    setGrid(shuffled);
    setBingoCount(0);
    setShowBingoAlert(false);
  }, [gridSize]);

  // Start Game
  const startGame = async () => {
    const items = await generateThemeItems(topic, level, gridSize);
    if (!items) return;
    
    setActiveTopic(topic || '멀티미디어 분석 빙고');
    setActiveLevel(level);
    shuffleGrid(gridSize, items);
    setGameState('PLAYING');
  };

  // Reshuffle
  const handleReshuffle = async () => {
    const items = await generateThemeItems(activeTopic, activeLevel, gridSize);
    if (items) {
      shuffleGrid(gridSize, items);
    }
  };

  // Go to Home
  const goHome = () => {
    setGameState('HOME');
    setTopic('');
    setUrlInput('');
    setUploadedImage(null);
    setInputType('text');
  };

  // Check for Bingo
  const checkBingo = (currentGrid: Cell[]) => {
    let lines = 0;
    const size = Math.sqrt(currentGrid.length);

    // Rows
    for (let i = 0; i < size; i++) {
      if (currentGrid.slice(i * size, (i + 1) * size).every(c => c.isMarked)) lines++;
    }

    // Columns
    for (let i = 0; i < size; i++) {
      let colMarked = true;
      for (let j = 0; j < size; j++) {
        if (!currentGrid[i + j * size].isMarked) {
          colMarked = false;
          break;
        }
      }
      if (colMarked) lines++;
    }

    // Diagonals
    let diag1 = true;
    let diag2 = true;
    for (let i = 0; i < size; i++) {
      if (!currentGrid[i * (size + 1)].isMarked) diag1 = false;
      if (!currentGrid[(i + 1) * (size - 1) + (size - 1)].isMarked) {
        // Wait, the logic for second diagonal was slightly off in original or needs adjustment for dynamic size
      }
    }
    
    // Corrected Diagonals for dynamic size
    let d1 = 0;
    let d2 = 0;
    for (let i = 0; i < size; i++) {
      if (currentGrid[i * size + i].isMarked) d1++;
      if (currentGrid[i * size + (size - 1 - i)].isMarked) d2++;
    }
    if (d1 === size) lines++;
    if (d2 === size) lines++;

    return lines;
  };

  const toggleCell = (id: number) => {
    const newGrid = grid.map(cell => 
      cell.id === id ? { ...cell, isMarked: !cell.isMarked } : cell
    );
    setGrid(newGrid);
    
    const newCount = checkBingo(newGrid);
    if (newCount > bingoCount && newCount >= 1) {
      setShowBingoAlert(true);
      setTimeout(() => setShowBingoAlert(false), 3000);
    }
    setBingoCount(newCount);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] p-4 md:p-8 font-sans text-[#333] selection:bg-blue-100">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {gameState === 'HOME' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center py-12 md:py-16"
            >
              <div className="mb-6 p-4 bg-blue-100 rounded-3xl text-blue-600">
                <Sparkles size={48} strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#1A1A1A] mb-4">
                멀티미디어 기반 <br />
                <span className="text-blue-600">홍콩 토요학교 이모티콘 빙고</span>
              </h1>
              <p className="text-base text-gray-500 font-medium max-w-md mb-10 leading-relaxed">
                교재 사진, 웹 링크, 텍스트 등 다양한 자료를 분석하여 <br />
                이모티콘과 영어 뜻이 포함된 빙고를 생성합니다.
              </p>

              <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl shadow-blue-100/50 border border-blue-50 mb-8">
                {/* Input Type Selector */}
                <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
                  <button 
                    onClick={() => setInputType('text')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${inputType === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    <TextIcon size={16} /> 텍스트
                  </button>
                  <button 
                    onClick={() => setInputType('image')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${inputType === 'image' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    <ImageIcon size={16} /> 이미지
                  </button>
                  <button 
                    onClick={() => setInputType('url')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${inputType === 'url' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    <LinkIcon size={16} /> 링크
                  </button>
                </div>

                <div className="space-y-6 mb-8 text-left">
                  {/* Dynamic Input Field */}
                  {inputType === 'text' && (
                    <div>
                      <label htmlFor="topic-input" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">수업 주제 또는 텍스트</label>
                      <textarea
                        id="topic-input"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="분석할 텍스트나 주제를 입력하세요..."
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all font-bold text-base min-h-[100px] resize-none"
                      />
                    </div>
                  )}

                  {inputType === 'image' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">교재 또는 자료 사진</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all overflow-hidden relative"
                      >
                        {uploadedImage ? (
                          <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Upload size={32} className="text-gray-300 mb-2" />
                            <span className="text-xs font-bold text-gray-400">사진 업로드 또는 촬영</span>
                          </>
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    </div>
                  )}

                  {inputType === 'url' && (
                    <div>
                      <label htmlFor="url-input" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">웹사이트 링크 (URL)</label>
                      <input
                        id="url-input"
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all font-bold text-base"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">학습 단계</label>
                    <div className="flex gap-2">
                      {['초급', '중급', '고급'].map((l) => (
                        <button
                          key={l}
                          onClick={() => setLevel(l)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${level === l ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">빙고판 크기</h3>
                  <div className="flex gap-2">
                    {[3, 4, 5].map((size) => (
                      <button
                        key={size}
                        onClick={() => setGridSize(size)}
                        className={`w-10 h-10 rounded-lg font-black text-sm transition-all ${gridSize === size ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={isGenerating || (inputType === 'image' && !uploadedImage) || (inputType === 'url' && !urlInput) || (inputType === 'text' && !topic)}
                  className={`w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      자료 분석 중...
                    </>
                  ) : (
                    <>
                      <Play size={20} fill="currentColor" />
                      빙고 생성하기
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                <Info size={14} />
                <span>홍콩 현지 맥락과 이모티콘이 포함된 어휘가 생성됩니다.</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Header */}
              <header className="flex justify-between items-center mb-6">
                <button 
                  onClick={goHome}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <Home size={24} />
                </button>
                <div className="text-center px-4 overflow-hidden">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-500 text-[10px] font-bold rounded-full border border-blue-100 uppercase tracking-tighter">
                      Source: {analysisSource}
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-[#1A1A1A] truncate">{activeTopic || '멀티미디어 분석 빙고'}</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{level} | {gridSize}x{gridSize}</p>
                </div>
                <button 
                  onClick={handlePrint}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <Printer size={24} />
                </button>
              </header>

              {/* Bingo Stats */}
              <div className="flex justify-between items-end mb-6 px-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">현재 빙고</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-blue-600 leading-none">{bingoCount}</span>
                    <span className="text-sm font-bold text-blue-600/50">줄</span>
                  </div>
                </div>
                <button 
                  onClick={handleReshuffle}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  <span>다시 섞기</span>
                </button>
              </div>

              {/* Bingo Grid */}
              <div className="bg-[#1A1A1A] p-2.5 rounded-[2rem] shadow-2xl mb-8 print:p-0 print:shadow-none">
                <div 
                  className="grid gap-1 rounded-2xl overflow-hidden bg-[#1A1A1A]"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                >
                  {grid.map((cell) => {
                    // Format: EMOJI Korean(English)
                    const emojiMatch = cell.name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
                    const emoji = emojiMatch ? emojiMatch[0] : '';
                    const rest = emoji ? cell.name.slice(emoji.length).trim() : cell.name;
                    const [korean, english] = rest.split('(');
                    const engText = english ? english.replace(')', '') : '';
                    
                    return (
                      <motion.button
                        key={cell.id}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => toggleCell(cell.id)}
                        className={`
                          aspect-square flex flex-col items-center justify-center p-1 md:p-2 text-center font-bold transition-all relative overflow-hidden
                          ${cell.isMarked 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-800 hover:bg-gray-50'}
                        `}
                      >
                        <span className="relative z-10 break-keep leading-tight flex flex-col items-center gap-0.5">
                          {emoji && <span className={`${gridSize === 3 ? 'text-2xl md:text-3xl' : gridSize === 4 ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'} mb-0.5`}>{emoji}</span>}
                          <span className={`${gridSize === 3 ? 'text-base md:text-lg' : gridSize === 4 ? 'text-sm md:text-base' : 'text-xs md:text-sm'} font-black`}>
                            {korean}
                          </span>
                          {engText && (
                            <span className={`${gridSize === 3 ? 'text-[9px] md:text-[10px]' : 'text-[8px] md:text-[9px]'} font-medium opacity-60 italic`}>
                              {engText}
                            </span>
                          )}
                        </span>
                        {cell.isMarked && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          >
                            <div className="w-full h-full bg-blue-600" />
                            <CheckCircle2 className="absolute top-1 right-1 text-white/40" size={12} />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Instructions Summary */}
              <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                    <Info size={16} />
                  </div>
                  <h2 className="font-bold text-base">학습 가이드</h2>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">
                  분석된 자료에서 추출된 단어들을 확인하며 빙고를 완성해보세요! 이모티콘과 영어 뜻을 함께 보며 한국어 어휘를 익힐 수 있습니다.
                </p>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bingo Alert Overlay */}
        <AnimatePresence>
          {showBingoAlert && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4"
            >
              <div className="bg-white px-8 py-5 rounded-[2rem] shadow-2xl border-4 border-blue-500 flex flex-col items-center gap-1">
                <Trophy className="text-amber-500 animate-bounce" size={48} />
                <span className="text-4xl font-black text-blue-600 tracking-tighter">BINGO!</span>
                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">{bingoCount}번째 빙고 달성!</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white; padding: 0; }
          button, header p:last-child, section, .fixed, .p-2, .bg-blue-50 { display: none !important; }
          header { margin-bottom: 2rem; display: block !important; text-align: center; }
          header h2 { font-size: 2.5rem !important; margin-bottom: 0.5rem; }
          .max-w-2xl { max-width: 100%; }
          .bg-\\[\\#1A1A1A\\] { background: black !important; -webkit-print-color-adjust: exact; }
          .aspect-square { border: 1px solid #000 !important; color: black !important; }
          .bg-blue-600 { background: #e2e8f0 !important; color: black !important; }
        }
      `}} />
    </div>
  );
}
