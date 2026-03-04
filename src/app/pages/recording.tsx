import { useNavigate } from "react-router";
import { ArrowLeft, Mic, Pause, Square, Send, Zap, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { useApp } from "../../lib/store";
import { CONFIG } from "../../lib/config";
import { callAI, parseJSON, buildNoteSystem, generateDemoNote } from "../../lib/ai";
import { saveNoteToNotion, saveProgressToNotion } from "../../lib/notion";
import { toast } from "sonner";

export function Recording() {
  const navigate = useNavigate();
  const app = useApp();
  const { school, division, subject, lang, professor, aiProvider, apiKey, addNote, elapsed, startTimer, stopTimer } = app;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notionStatus, setNotionStatus] = useState<string | null>(null);
  const [sttMode, setSttMode] = useState<"browser" | "whisper">("browser"); // STT 엔진 선택
  const [whisperProcessing, setWhisperProcessing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const cfg = school ? CONFIG[school as keyof typeof CONFIG] : null;
  const divCfg = cfg && division ? cfg.계열[division as keyof typeof cfg.계열] : null;
  const isHighschool = school === "고등학교";

  // Redirect if no subject selected
  useEffect(() => {
    if (!subject) navigate("/");
  }, [subject, navigate]);

  // Timer
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Web Speech API (브라우저 모드) ────────────────────────
  const startBrowserSTT = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("음성 인식이 지원되지 않는 브라우저입니다. Chrome/Edge를 사용하거나 Whisper 모드를 선택해주세요.");
      return;
    }

    const recognition = new SR();
    recognition.lang = lang === "English" ? "en-US" : "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) setTranscript((prev) => prev + final);
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech error:", event.error);
      if (event.error === "not-allowed") {
        alert("마이크 권한을 허용해주세요.");
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [lang]);

  // ── Whisper (MediaRecorder + OpenAI) ──────────────────────
  const startWhisperRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // 1초마다 chunk
      mediaRecorderRef.current = mediaRecorder;
    } catch (e) {
      alert("마이크 권한을 허용해주세요.");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, []);

  const sendWhisperChunk = async () => {
    if (audioChunksRef.current.length === 0) return;

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];

    if (blob.size < 1000) return; // 너무 작으면 스킵

    setWhisperProcessing(true);
    try {
      // base64 변환
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      // 서버 프록시로 Whisper 호출 (API 키는 서버 환경변수)
      let text = "";
      const res = await fetch("/api/whisper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, language: lang }),
      });
      if (res.ok) {
        const d = await res.json();
        text = d.text || "";
      }

      if (text.trim()) {
        setTranscript((prev) => prev + text.trim() + " ");
      }
    } catch (e) {
      console.warn("Whisper 변환 실패:", e);
    }
    setWhisperProcessing(false);
  };

  // ── 공통 녹음 컨트롤 ──────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsPaused(false);
    setInterimText("");

    if (sttMode === "browser") {
      startBrowserSTT();
    } else {
      startWhisperRecording();
    }
  }, [sttMode, startBrowserSTT, startWhisperRecording]);

  const handlePause = () => {
    if (isPaused) {
      // Resume
      if (sttMode === "browser" && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
      if (sttMode === "whisper" && mediaRecorderRef.current?.state === "paused") {
        mediaRecorderRef.current.resume();
      }
      isRecordingRef.current = true;
    } else {
      // Pause
      isRecordingRef.current = false;
      if (sttMode === "browser" && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (sttMode === "whisper" && mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.pause();
        // 일시정지 시 현재까지의 오디오를 Whisper로 전송
        sendWhisperChunk();
      }
    }
    setIsPaused(!isPaused);
  };

  const handleStopRecording = async () => {
    isRecordingRef.current = false;

    if (sttMode === "browser") {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        // 마지막 chunk 전송
        await sendWhisperChunk();
        mediaRecorderRef.current = null;
      }
    }

    setIsRecording(false);
    setIsPaused(false);
    setInterimText("");
  };

  // Whisper 자동 전송 (30초마다)
  useEffect(() => {
    if (!isRecording || isPaused || sttMode !== "whisper") return;
    const interval = setInterval(() => {
      sendWhisperChunk();
    }, 30000); // 30초마다
    return () => clearInterval(interval);
  }, [isRecording, isPaused, sttMode]);

  // ── AI 필기 처리 ────────────────────────────────────────
  const processNote = async () => {
    if (!transcript.trim() || processing || !divCfg) return;
    const text = transcript.trim();
    setProcessing(true);

    try {
      const sys = buildNoteSystem(school!, division!, subject!, lang, divCfg.prompt);
      const raw = await callAI([{ role: "user", content: `수업 내용: "${text}"` }], sys, apiKey, aiProvider);
      const parsed = raw ? parseJSON(raw) : generateDemoNote(text, school!, division!, subject!);

      if (!parsed) {
        toast.error("AI 분석 실패. 다시 시도해주세요.");
        setProcessing(false);
        return;
      }

      const noteObj = {
        id: Date.now(),
        time: formatTime(elapsed),
        raw: text,
        note: parsed?.note || text,
        insight: parsed?.insight || null,
        keywords: parsed?.keywords || [],
        importance: parsed?.importance || "medium",
        suneung_tip: parsed?.suneung_tip || null,
        supplement: parsed?.supplement || null,
        auto_search: parsed?.auto_search || null,
        connections: parsed?.connections || null,
      };

      addNote(noteObj);
      setTranscript("");
      setProcessing(false);

      // Notion background save
      setNotionStatus("saving");
      const ok = await saveNoteToNotion(noteObj, subject!, division!, professor);
      setNotionStatus(ok ? "saved" : "failed");
      setTimeout(() => setNotionStatus(null), 2000);
    } catch (e) {
      console.error("processNote failed:", e);
      toast.error("AI 분석 실패. 다시 시도해주세요.");
      setProcessing(false);
    }
  };

  const handleFinish = async () => {
    handleStopRecording();
    stopTimer();
    // 진도 트래커에 학습 기록 저장
    await saveProgressToNotion(subject!, division!, school!, app.notes.length, 0, Math.round(elapsed / 60));
    navigate("/notes");
  };

  if (!subject) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-900">{subject}</h2>
            <p className="text-xs text-gray-500">{division} · {aiProvider === "demo" ? "데모" : aiProvider}</p>
          </div>
          <div className="flex items-center gap-2">
            {notionStatus && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                notionStatus === "saving" ? "bg-yellow-100 text-yellow-700" :
                notionStatus === "saved" ? "bg-green-100 text-green-700" :
                "bg-red-100 text-red-700"
              }`}>
                {notionStatus === "saving" ? "저장중" : notionStatus === "saved" ? "저장됨" : "실패"}
              </span>
            )}
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 text-xs" onClick={handleFinish}>
              완료 →
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8 flex-1 flex flex-col w-full">
        {/* STT Mode Toggle */}
        <div className="flex justify-center gap-2 mb-4">
          <button
            onClick={() => !isRecording && setSttMode("browser")}
            disabled={isRecording}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              sttMode === "browser" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <Mic className="w-3 h-3 inline mr-1" />
            브라우저 (무료)
          </button>
          <button
            onClick={() => !isRecording && setSttMode("whisper")}
            disabled={isRecording}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              sttMode === "whisper" ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <Zap className="w-3 h-3 inline mr-1" />
            Whisper (고정밀)
          </button>
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <div className="text-5xl font-bold tracking-wider mb-2 text-gray-900">{formatTime(elapsed)}</div>
          <div className="text-gray-500 text-sm">
            {isRecording ? (isPaused ? "일시정지됨" : (whisperProcessing ? "Whisper 변환중..." : "녹음 중...")) : "준비"}
          </div>
        </div>

        {/* Record Button */}
        <div className="flex justify-center mb-8">
          <motion.button
            onClick={handleStartRecording}
            disabled={isRecording}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center ${
              isRecording ? "bg-red-500/20 opacity-50 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
            } transition-colors`}
            animate={isRecording && !isPaused ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {isRecording && !isPaused && (
              <motion.div
                className="absolute inset-0 rounded-full bg-red-500/30"
                animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <Mic className="w-10 h-10 text-white" />
          </motion.button>
        </div>

        {/* Waveform */}
        {isRecording && (
          <div className="flex items-center justify-center gap-1 mb-6 h-12">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className={`w-1 rounded-full ${sttMode === "whisper" ? "bg-emerald-500" : "bg-red-500"}`}
                animate={!isPaused ? { height: [Math.random() * 30 + 8, Math.random() * 45 + 8, Math.random() * 30 + 8] } : {}}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                style={{ height: isPaused ? 8 : undefined }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        {isRecording && (
          <div className="flex justify-center gap-4 mb-6">
            <Button onClick={handlePause} size="lg" variant="outline" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-100">
              <Pause className="w-5 h-5 mr-2" />
              {isPaused ? "재개" : "일시정지"}
            </Button>
            <Button onClick={handleStopRecording} size="lg" variant="outline" className="bg-red-50 border-red-300 text-red-600 hover:bg-red-100">
              <Square className="w-5 h-5 mr-2" />
              중지
            </Button>
          </div>
        )}

        {/* Interim text */}
        {interimText && (
          <div className="text-center text-gray-500 text-sm italic mb-4">
            {interimText}
          </div>
        )}

        {/* Live transcript display when recording */}
        {isRecording && transcript && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-4">
            <p className="text-xs text-indigo-600 font-medium mb-2">실시간 인식 텍스트</p>
            <p className="text-gray-900 text-sm leading-relaxed">{transcript.slice(-200)}{interimText && <span className="text-indigo-500 italic"> {interimText}</span>}</p>
          </div>
        )}

        {/* Transcript / Manual Input */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 flex-1 flex flex-col shadow-sm">
          <h3 className="text-base font-medium text-gray-900 mb-3">
            {isRecording ? "실시간 텍스트" : "수동 입력"}
          </h3>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="강의 내용을 직접 입력하거나 버튼으로 음성 입력..."
            className={`bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 flex-1 ${isRecording ? "min-h-16" : "min-h-24"} mb-4 resize-none`}
          />
          <div className="flex gap-3">
            <Button
              onClick={processNote}
              disabled={!transcript.trim() || processing}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {processing ? "AI 분석 중..." : "AI 필기 생성"}
            </Button>
          </div>
          <button
            onClick={() => navigate("/upload")}
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors w-full"
          >
            <Upload className="w-3.5 h-3.5" />
            파일에서 텍스트 추출 →
          </button>
          {app.notes.length > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              {app.notes.length}개 노트 생성됨 · 완료 버튼으로 확인
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
