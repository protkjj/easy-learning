import { useNavigate } from "react-router";
import { ArrowLeft, Upload as UploadIcon, Loader2, Sparkles, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useState, useRef, useCallback } from "react";
import { useApp } from "../../lib/store";
import { callAI, parseJSON, buildNoteSystem, generateDemoNote } from "../../lib/ai";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, "application/pdf"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (OCR API 제한)

interface FileInfo {
  file: File;
  preview?: string; // data URL for image thumbnail
  pageCount?: number; // for PDF
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get raw base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Upload() {
  const navigate = useNavigate();
  const { school, division, subject, lang, aiProvider, apiKey, addNote } = useApp();

  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [extractedText, setExtractedText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [generating, setGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ────────────────────────────────────────
  const handleFiles = useCallback(async (newFiles: File[]) => {
    const valid = newFiles.filter(f => ACCEPTED_TYPES.includes(f.type));
    if (valid.length === 0) {
      toast.error("지원하지 않는 파일 형식입니다. (PNG, JPG, WEBP, GIF, PDF)");
      return;
    }

    // 파일 크기 검증
    const sizeChecked = valid.filter(f => {
      const limit = f.type.startsWith("image/") ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
      const limitMB = Math.round(limit / 1024 / 1024);
      if (f.size > limit) {
        toast.error(`${f.name}: ${limitMB}MB 초과 (${Math.round(f.size / 1024 / 1024)}MB)`);
        return false;
      }
      return true;
    });
    if (sizeChecked.length === 0) return;

    const fileInfos: FileInfo[] = [];
    for (const file of sizeChecked) {
      const info: FileInfo = { file };

      if (file.type.startsWith("image/")) {
        // Create thumbnail preview
        info.preview = URL.createObjectURL(file);
      } else if (file.type === "application/pdf") {
        // Get page count
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          info.pageCount = pdf.numPages;
        } catch {
          info.pageCount = 0;
        }
      }

      fileInfos.push(info);
    }

    setFiles(prev => [...prev, ...fileInfos]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    handleFiles(dropped);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      // Revoke object URL if it exists
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  // ── PDF text extraction (client-side) ────────────────────
  const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      setOcrProgress(`PDF 텍스트 추출 중... (${i}/${pdf.numPages} 페이지)`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
    }
    return text.trim();
  };

  // ── Image OCR via server proxy ──────────────────────────
  const extractImageText = async (file: File): Promise<string> => {
    const base64 = await fileToBase64(file);

    // 서버 프록시로 OCR 호출 (API 키는 서버 환경변수)
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, mimeType: file.type }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.text || "";
    }

    throw new Error("OCR failed");
  };

  // ── Process all files ────────────────────────────────────
  const handleExtract = async () => {
    if (files.length === 0 || processing) return;

    setProcessing(true);
    setExtractedText("");
    let allText = "";

    try {
      for (let i = 0; i < files.length; i++) {
        const { file } = files[i];
        const fileLabel = `[${i + 1}/${files.length}] ${file.name}`;

        if (file.type === "application/pdf") {
          setOcrProgress(`${fileLabel}: PDF 텍스트 추출 중...`);
          const text = await extractPdfText(file);
          if (text) {
            allText += `--- ${file.name} ---\n${text}\n\n`;
          } else {
            toast.error(`${file.name}: 텍스트를 추출할 수 없습니다.`);
          }
        } else if (file.type.startsWith("image/")) {
          setOcrProgress(`${fileLabel}: OCR 처리 중...`);
          try {
            const text = await extractImageText(file);
            if (text) {
              allText += `--- ${file.name} ---\n${text}\n\n`;
            }
          } catch {
            toast.error(`${file.name}: OCR 처리에 실패했습니다.`);
          }
        }
      }

      if (allText.trim()) {
        setExtractedText(allText.trim());
        toast.success("텍스트 추출이 완료되었습니다!");
      } else {
        toast.error("추출된 텍스트가 없습니다.");
      }
    } catch (err) {
      toast.error("텍스트 추출 중 오류가 발생했습니다.");
    }

    setProcessing(false);
    setOcrProgress("");
  };

  // ── AI note generation ───────────────────────────────────
  const handleGenerateNotes = async () => {
    if (!extractedText.trim() || generating) return;

    const text = extractedText.trim();
    setGenerating(true);

    try {
      const effectiveSchool = school || "대학교";
      const effectiveDivision = division || "공학";
      const effectiveSubject = subject || "업로드 학습";
      const effectiveLang = lang || "한국어";

      const prompt = `업로드된 파일(PDF/이미지)에서 추출한 텍스트 기반 필기. 전체 내용을 체계적으로 정리하라. 핵심 개념은 **굵게**, 소제목 ## 사용.`;
      const sys = buildNoteSystem(
        effectiveSchool,
        effectiveDivision,
        effectiveSubject,
        effectiveLang,
        prompt
      );

      const raw = await callAI(
        [{ role: "user", content: `업로드 파일에서 추출한 내용:\n\n"${text.substring(0, 6000)}"` }],
        sys,
        apiKey,
        aiProvider
      );

      const parsed = raw
        ? parseJSON(raw)
        : generateDemoNote(text, effectiveSchool, effectiveDivision, effectiveSubject);

      if (!parsed) {
        toast.error("AI 분석에 실패했습니다. 다시 시도해주세요.");
        setGenerating(false);
        return;
      }

      const noteObj = {
        id: Date.now(),
        time: "UP",
        raw: `[업로드] ${files.map(f => f.file.name).join(", ").substring(0, 80)}`,
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

    setGenerating(false);
  };

  // ── File icon helper ─────────────────────────────────────
  const getFileIcon = (file: File) => {
    if (file.type === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
    if (file.type.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <UploadIcon className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold">PDF/이미지 업로드</h2>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Drag & Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
            dragOver
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(Array.from(e.target.files));
                e.target.value = ""; // Reset so same file can be selected again
              }
            }}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              dragOver ? "bg-indigo-100" : "bg-gray-100"
            }`}>
              <UploadIcon className={`w-8 h-8 ${dragOver ? "text-indigo-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                파일을 드래그하거나 클릭하여 선택
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PNG, JPG, WEBP, GIF, PDF (최대 10MB)
              </p>
            </div>
          </div>
        </div>

        {/* File Preview Cards */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              선택된 파일 ({files.length}개)
            </h3>
            {files.map((fileInfo, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-200 shadow-sm"
              >
                {/* Thumbnail or Icon */}
                {fileInfo.preview ? (
                  <img
                    src={fileInfo.preview}
                    alt={fileInfo.file.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(fileInfo.file)}
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {fileInfo.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(fileInfo.file.size)}
                    {fileInfo.pageCount !== undefined && ` / ${fileInfo.pageCount}페이지`}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Extract Button */}
            <Button
              onClick={handleExtract}
              disabled={processing || files.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 text-sm rounded-xl mt-4"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {ocrProgress || "처리 중..."}
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  텍스트 추출하기
                </>
              )}
            </Button>
          </div>
        )}

        {/* Extracted Text Area */}
        {(extractedText || processing) && (
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">추출된 텍스트</h3>
              {extractedText && (
                <span className="text-xs text-gray-400">
                  {extractedText.length.toLocaleString()}자
                </span>
              )}
            </div>

            {processing && !extractedText ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">{ocrProgress || "텍스트를 추출하고 있습니다..."}</p>
              </div>
            ) : (
              <Textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                className="min-h-48 text-sm leading-relaxed resize-none border-gray-200 bg-gray-50"
                placeholder="추출된 텍스트가 여기에 표시됩니다..."
              />
            )}
          </div>
        )}

        {/* AI Note Generation Button */}
        {extractedText && !processing && (
          <Button
            onClick={handleGenerateNotes}
            disabled={generating || !extractedText.trim()}
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base rounded-2xl shadow-sm"
          >
            {generating ? (
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
        {files.length === 0 && !extractedText && (
          <div className="mt-6 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-sm font-medium text-gray-700 mb-3">사용 방법</h4>
            <ol className="space-y-2 text-sm text-gray-500">
              <li className="flex gap-2">
                <span className="text-indigo-500 font-semibold">1.</span>
                PDF 또는 이미지 파일을 드래그 앤 드롭 (다중 선택 가능)
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-semibold">2.</span>
                "텍스트 추출하기" 버튼으로 내용 추출 (PDF: 텍스트 직접 추출, 이미지: AI OCR)
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-semibold">3.</span>
                추출된 텍스트 확인/편집 후 "AI 필기 생성"
              </li>
            </ol>
            <p className="mt-3 text-xs text-gray-400">
              * 이미지 OCR은 OpenAI Vision API를 사용합니다.
              PDF는 클라이언트에서 직접 텍스트를 추출합니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
