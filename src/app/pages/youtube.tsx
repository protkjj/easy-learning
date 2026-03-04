import { useNavigate } from "react-router";
import { ArrowLeft, Youtube, Loader2, FileText, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useState } from "react";
import { useApp } from "../../lib/store";
import { callAI, parseJSON, buildNoteSystem, generateDemoNote } from "../../lib/ai";
import { toast } from "sonner";

export function YouTube() {
  const navigate = useNavigate();
  const { school, division, subject, lang, aiProvider, apiKey, addNote } = useApp();

  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Extract video ID from URL for thumbnail preview
  const extractVideoId = (input: string): string | null => {
    const match = input.match(
      /(?:v=|youtu\.be\/|\/v\/|\/embed\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    const id = extractVideoId(value);
    setVideoId(id);
    // Reset state when URL changes
    if (!id) {
      setTitle(null);
      setTranscript("");
    }
  };

  // Fetch transcript from serverless function
  const handleExtract = async () => {
    if (!url.trim() || extracting) return;

    setExtracting(true);
    setTranscript("");
    setTitle(null);

    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "자막 추출에 실패했습니다.");
        setExtracting(false);
        return;
      }

      setTranscript(data.transcript);
      setTitle(data.title);
      if (data.videoId) setVideoId(data.videoId);
      toast.success("자막이 추출되었습니다!");
    } catch (err) {
      toast.error("서버 연결에 실패했습니다. 다시 시도해주세요.");
    }

    setExtracting(false);
  };

  // Process transcript through AI to generate notes
  const handleGenerateNotes = async () => {
    if (!transcript.trim() || processing) return;

    const text = transcript.trim();
    setProcessing(true);

    try {
      // Use subject-specific prompt if available, otherwise use a general YouTube prompt
      const effectiveSchool = school || "대학교";
      const effectiveDivision = division || "공학";
      const effectiveSubject = subject || title || "YouTube 학습";
      const effectiveLang = lang || "한국어";

      const prompt = `YouTube 영상 자막 기반 필기. 영상 전체 내용을 체계적으로 정리하라. 핵심 개념은 **굵게**, 소제목 ## 사용.`;
      const sys = buildNoteSystem(
        effectiveSchool,
        effectiveDivision,
        effectiveSubject,
        effectiveLang,
        prompt
      );

      const raw = await callAI(
        [{ role: "user", content: `YouTube 영상 자막 내용:\n\n"${text.substring(0, 6000)}"` }],
        sys,
        apiKey,
        aiProvider
      );

      const parsed = raw
        ? parseJSON(raw)
        : generateDemoNote(text, effectiveSchool, effectiveDivision, effectiveSubject);

      const noteObj = {
        id: Date.now(),
        time: "YT",
        raw: title ? `[YouTube] ${title}` : `[YouTube] ${text.substring(0, 80)}...`,
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
      toast.success("AI 필기가 생성되었습니다!");
      navigate("/notes");
    } catch (err) {
      toast.error("AI 필기 생성에 실패했습니다.");
    }

    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">YouTube 학습</h2>
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* URL Input */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            YouTube URL
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
            />
            <Button
              onClick={handleExtract}
              disabled={!videoId || extracting}
              className="bg-red-500 hover:bg-red-600 text-white px-5"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  추출 중...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  자막 추출
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Video Thumbnail Preview */}
        {videoId && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-6">
            <img
              src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              alt="Video thumbnail"
              className="w-full aspect-video object-cover"
              onError={(e) => {
                // Fallback to hqdefault if maxresdefault is not available
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }}
            />
            {title && (
              <div className="px-5 py-3 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-800">{title}</h3>
              </div>
            )}
          </div>
        )}

        {/* Transcript Area */}
        {(transcript || extracting) && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">추출된 자막</h3>
              {transcript && (
                <span className="text-xs text-gray-400">
                  {transcript.length.toLocaleString()}자
                </span>
              )}
            </div>

            {extracting ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">자막을 추출하고 있습니다...</p>
              </div>
            ) : (
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-48 text-sm leading-relaxed resize-none border-gray-200 bg-gray-50"
                placeholder="자막이 여기에 표시됩니다..."
              />
            )}
          </div>
        )}

        {/* Generate Notes Button */}
        {transcript && !extracting && (
          <Button
            onClick={handleGenerateNotes}
            disabled={processing || !transcript.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base rounded-2xl shadow-sm"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                AI 필기 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                AI 필기 생성
              </>
            )}
          </Button>
        )}

        {/* Info Section */}
        {!videoId && !transcript && (
          <div className="mt-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-sm font-medium text-gray-700 mb-3">사용 방법</h4>
            <ol className="space-y-2 text-sm text-gray-500">
              <li className="flex gap-2">
                <span className="text-indigo-500 font-semibold">1.</span>
                YouTube 영상 URL을 붙여넣기
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-semibold">2.</span>
                "자막 추출" 버튼으로 영상 자막 가져오기
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-semibold">3.</span>
                "AI 필기 생성"으로 자동 정리된 노트 받기
              </li>
            </ol>
            <p className="mt-3 text-xs text-gray-400">
              * 자막이 있는 영상만 지원됩니다 (자동 생성 자막 포함)
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
