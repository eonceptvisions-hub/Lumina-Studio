import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Types & Constants ---

type ImageVariantType = 
  | 'front' 
  | 'side' 
  | '45-degree' 
  | 'lifestyle' 
  | 'dark-luxury' 
  | 'macro' 
  | 'flatlay';

type AspectRatio = '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
type ImageResolution = '1K' | '2K' | '4K';

interface ImageResult {
  id: ImageVariantType;
  title: string;
  description: string;
  status: 'idle' | 'loading' | 'complete' | 'error';
  statusMessage?: string;
  imageUrl?: string;
  errorMsg?: string;
}

const VARIANTS: { id: ImageVariantType; title: string; promptSuffix: string }[] = [
  {
    id: 'front',
    title: 'Front View',
    promptSuffix: "Front view: High-resolution 8K photorealistic shot of the product, centered, pure white background (#FFFFFF), soft shadows, f/1.8, 85mm."
  },
  {
    id: 'side',
    title: 'Side View',
    promptSuffix: "Side view: High-resolution 8K photorealistic shot of the product from the side, centered, pure white background (#FFFFFF), soft shadows, f/1.8, 85mm."
  },
  {
    id: '45-degree',
    title: '45-Degree Hero',
    promptSuffix: "45-degree angle hero shot: High-resolution 8K photorealistic shot of the product at a 45-degree angle, centered, pure white background (#FFFFFF), soft shadows, f/1.8, 85mm."
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle Context',
    promptSuffix: "Lifestyle image: High-resolution 8K photorealistic image of the product in a realistic, relevant real-world use setting, soft lighting."
  },
  {
    id: 'dark-luxury',
    title: 'Dark Luxury Studio',
    promptSuffix: "Dark Luxury Studio Shot: High-resolution 8K photorealistic shot of the product in a luxurious, dark studio environment (e.g., black marble surface, mood lighting), soft reflections."
  },
  {
    id: 'macro',
    title: 'Macro Detail',
    promptSuffix: "Macro Detail Shot: High-resolution 8K photorealistic extreme close-up (macro) shot highlighting a specific texture or intricate detail of the product, soft studio lighting, pure white background (#FFFFFF) or relevant contextual background."
  },
  {
    id: 'flatlay',
    title: 'Top-Down Flatlay',
    promptSuffix: "Top-Down Flatlay: High-resolution 8K photorealistic top-down (flatlay) shot of the product, centered, soft lighting, pure white background (#FFFFFF)."
  }
];

const GLOBAL_STYLE = "Main Style: Ultra-sharp studio shot with soft lighting. Camera & Quality Specs: 8K resolution, f/1.8 aperture, 85mm focal length, professional product lighting, DSLR depth-of-field realism. IMPORTANT: No logos, copyright designs, or text.";

// --- Components ---

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const EditorModal: React.FC<{ sourceImage: string; onClose: () => void }> = ({ sourceImage, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Ensure we just get the base64 data, removing the prefix if present
      const base64Data = sourceImage.includes('base64,') ? sourceImage.split('base64,')[1] : sourceImage;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: prompt },
            { 
              inlineData: { 
                data: base64Data, 
                mimeType: 'image/png' 
              } 
            }
          ]
        }
      });

      let imageUrl = '';
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        setGeneratedImage(imageUrl);
      } else {
        throw new Error("No image generated");
      }
    } catch (err: any) {
      console.error("Edit failed:", err);
      setError(err.message || "Failed to edit image");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative max-w-6xl w-full bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white bg-black/50 hover:bg-red-900/50 rounded-full w-10 h-10 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        {/* Left: Image Preview Area */}
        <div className="flex-1 bg-black/40 relative flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-gray-800">
            <div className="flex flex-col gap-4 w-full h-full">
                <div className="flex-1 relative flex items-center justify-center min-h-0">
                    {/* Source Image */}
                    <div className="relative group h-full flex flex-col items-center justify-center">
                         <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded border border-white/10 z-10">Original</span>
                         <img src={sourceImage} className="max-h-full max-w-full object-contain rounded-lg shadow-lg" alt="Original" />
                    </div>
                </div>
                
                {generatedImage && (
                    <div className="flex-1 relative flex items-center justify-center min-h-0 border-t border-gray-800 pt-4">
                        {/* Result Image */}
                        <div className="relative h-full flex flex-col items-center justify-center w-full">
                            <span className="absolute top-2 left-2 bg-indigo-600/80 text-white text-[10px] px-2 py-1 rounded border border-white/10 z-10">Edited Result</span>
                            <img src={generatedImage} className="max-h-full max-w-full object-contain rounded-lg shadow-lg border border-indigo-500/30" alt="Edited" />
                             <a 
                                href={generatedImage} 
                                download="edited-image.png"
                                className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all"
                                title="Download Edit"
                            >
                                <i className="fa-solid fa-download"></i>
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-[400px] bg-[#1F2937] p-6 flex flex-col">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-wand-magic-sparkles text-yellow-400"></i> Magic Editor
                </h3>
                <p className="text-sm text-gray-400 mt-1">Use AI to edit your image. Describe the change you want to make.</p>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-300 uppercase">Editing Prompt</label>
                    <textarea 
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none text-white resize-none h-32"
                        placeholder="e.g., Add a retro filter, Make it night time, Remove the background..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                    </div>
                )}

                <button 
                    onClick={handleEdit}
                    disabled={isGenerating || !prompt}
                    className={`mt-auto w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg
                        ${isGenerating || !prompt 
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-orange-900/20'}`}
                >
                    {isGenerating ? <><Spinner /> Processing...</> : <><i className="fa-solid fa-bolt"></i> Apply Edit</>}
                </button>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="fa-solid fa-bolt text-yellow-500"></i>
                    <span>Powered by <strong>Gemini 2.5 Flash Image</strong></span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const ImageModal: React.FC<{ imageUrl: string; title: string; onClose: () => void; onEdit: () => void }> = ({ imageUrl, title, onClose, onEdit }) => {
  if (!imageUrl) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative max-w-7xl max-h-[95vh] w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
         <img src={imageUrl} alt={title} className="max-w-full max-h-[85vh] object-contain rounded-sm shadow-2xl border border-gray-800" />
         
         <div className="absolute top-4 right-4 flex gap-3">
             {/* Edit Button in Lightbox */}
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="text-white bg-yellow-600/80 hover:bg-yellow-500 rounded-full w-12 h-12 flex items-center justify-center transition-all border border-white/10 backdrop-blur-md group shadow-lg shadow-yellow-900/20"
              title="Magic Edit"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-lg group-hover:scale-110 transition-transform"></i>
            </button>

            <a 
              href={imageUrl} 
              download={`lumina-${title.replace(/\s+/g, '-').toLowerCase()}.png`}
              className="text-white bg-gray-800/50 hover:bg-gray-700/80 rounded-full w-12 h-12 flex items-center justify-center transition-all border border-white/10 backdrop-blur-md group"
              onClick={(e) => e.stopPropagation()}
              title="Download"
            >
              <i className="fa-solid fa-download text-lg group-hover:scale-110 transition-transform"></i>
            </a>
            <button 
              onClick={onClose}
              className="text-white bg-gray-800/50 hover:bg-red-900/50 rounded-full w-12 h-12 flex items-center justify-center transition-all border border-white/10 backdrop-blur-md group"
              title="Close"
            >
              <i className="fa-solid fa-xmark text-xl group-hover:scale-110 transition-transform"></i>
            </button>
         </div>

         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/90 bg-gray-900/60 px-6 py-3 rounded-full backdrop-blur-xl text-sm font-medium border border-white/5 shadow-xl">
           {title}
         </div>
      </div>
    </div>
  );
};

const ImageCard: React.FC<{ result: ImageResult, onExpand: (url: string, title: string) => void, onEdit: (url: string) => void }> = ({ result, onExpand, onEdit }) => {
  const isComplete = result.status === 'complete';
  const isLoading = result.status === 'loading';
  const isError = result.status === 'error';

  return (
    <div className={`relative group rounded-xl overflow-hidden bg-gray-900 border transition-all duration-500 ${isComplete ? 'border-gray-800 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-900/10' : 'border-gray-800'}`}>
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-3 z-10 flex justify-between items-start pointer-events-none">
        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/5">
          {result.title}
        </span>
      </div>

      {/* Image Area */}
      <div className="aspect-square relative w-full bg-[#0F1115]">
        {isComplete && result.imageUrl ? (
          <img 
            src={result.imageUrl} 
            alt={result.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer"
            onClick={() => onExpand(result.imageUrl!, result.title)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
             {isLoading ? (
               <div className="flex flex-col items-center px-4 text-center">
                 <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                 <span className="text-[10px] font-mono text-indigo-400 tracking-widest animate-pulse mb-1">GENERATING</span>
                 {result.statusMessage && (
                   <span className="text-[10px] text-gray-500 animate-pulse">{result.statusMessage}</span>
                 )}
               </div>
             ) : isError ? (
               <div className="flex flex-col items-center text-red-400/80 px-4 text-center w-full">
                 <i className="fa-solid fa-triangle-exclamation text-xl mb-2"></i>
                 <span className="text-[10px] uppercase tracking-wide mb-1">Failed</span>
                 <span className="text-[9px] text-red-500/60 line-clamp-2 max-w-full break-words">{result.errorMsg}</span>
               </div>
             ) : (
               <div className="flex flex-col items-center opacity-20">
                 <i className="fa-regular fa-image text-2xl mb-2"></i>
                 <span className="text-[10px] uppercase tracking-wide">Pending</span>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Actions Overlay (Hover) */}
      {isComplete && (
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[1px]">
           <button 
             className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-yellow-600 transition-all shadow-lg border border-white/10 transform hover:scale-110"
             onClick={() => onEdit(result.imageUrl!)}
             title="Magic Edit"
           >
             <i className="fa-solid fa-wand-magic-sparkles"></i>
           </button>
           <button 
             className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-indigo-600 transition-all shadow-lg border border-white/10 transform hover:scale-110"
             onClick={() => onExpand(result.imageUrl!, result.title)}
             title="View Fullscreen"
           >
             <i className="fa-solid fa-expand"></i>
           </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [resolution, setResolution] = useState<ImageResolution>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<ImageResult[]>(
    VARIANTS.map(v => ({ id: v.id, title: v.title, description: v.promptSuffix, status: 'idle', statusMessage: 'Waiting in queue...' }))
  );
  const [selectedImage, setSelectedImage] = useState<{url: string, title: string} | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null); // New state for editing
  
  const [useFallbackModel, setUseFallbackModel] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt && !refImage) return;
    setIsGenerating(true);
    setUseFallbackModel(false);

    setResults(prev => prev.map(r => ({ ...r, status: 'idle', imageUrl: undefined, errorMsg: undefined, statusMessage: 'Waiting...' })));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      for (let i = 0; i < VARIANTS.length; i++) {
        const variant = VARIANTS[i];
        let attempt = 0;
        const maxRetries = 3;
        let success = false;
        let currentUseFallback = useFallbackModel;

        while (attempt < maxRetries && !success) {
            try {
                setResults(prev => {
                    const next = [...prev];
                    next[i] = { 
                        ...next[i], 
                        status: 'loading',
                        statusMessage: attempt > 0 
                          ? `Retrying (${attempt}/${maxRetries})...` 
                          : (currentUseFallback ? 'Rendering (Std)...' : 'Rendering (Pro)...')
                    };
                    return next;
                });

                let desc = prompt ? `Product Description: ${prompt}.` : "Product Description: Analyze the reference image to generate the specific view of the product shown.";
                const finalPrompt = `${desc} \n\nSpecific Shot Requirement: ${variant.promptSuffix} \n\n${GLOBAL_STYLE}`;
                
                const parts: any[] = [{ text: finalPrompt }];
                
                if (refImage) {
                    const base64Data = refImage.split(',')[1];
                    parts.unshift({
                        inlineData: {
                            data: base64Data,
                            mimeType: 'image/png'
                        }
                    });
                }

                const modelName = currentUseFallback ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
                
                const config: any = {
                    imageConfig: {
                        aspectRatio: aspectRatio,
                    }
                };

                if (!currentUseFallback) {
                    config.imageConfig.imageSize = resolution;
                }

                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: { parts },
                    config: config
                });

                let imageUrl = '';
                if (response.candidates && response.candidates[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                            break;
                        }
                    }
                }

                if (imageUrl) {
                    setResults(prev => {
                        const next = [...prev];
                        next[i] = { ...next[i], status: 'complete', imageUrl, statusMessage: 'Done' };
                        return next;
                    });
                    success = true;
                    
                    if (currentUseFallback) {
                        setUseFallbackModel(true);
                    }

                } else {
                    throw new Error("No image generated in response.");
                }

            } catch (err: any) {
                console.warn(`Error generating ${variant.title} (Attempt ${attempt + 1}):`, err);
                const errMsg = err.toString().toLowerCase();

                if (!currentUseFallback && (errMsg.includes('403') || errMsg.includes('permission denied') || errMsg.includes('not found') || errMsg.includes('404'))) {
                    console.log("Switching to Fallback (Flash) model.");
                    currentUseFallback = true;
                    setUseFallbackModel(true); 
                    setResults(prev => {
                        const next = [...prev];
                        next[i] = { ...next[i], statusMessage: 'Switching to Standard Model...' };
                        return next;
                    });
                    attempt++;
                    continue; 
                }

                attempt++;
                
                if (attempt >= maxRetries) {
                    setResults(prev => {
                        const next = [...prev];
                        next[i] = { 
                            ...next[i], 
                            status: 'error', 
                            errorMsg: err.message || 'Failed to generate',
                            statusMessage: 'Failed'
                        };
                        return next;
                    });
                } else {
                    const delay = 2000 * Math.pow(1.5, attempt - 1);
                    setResults(prev => {
                        const next = [...prev];
                        next[i] = { ...next[i], statusMessage: `Connection unstable. Retrying in ${Math.ceil(delay/1000)}s...` };
                        return next;
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
      }

    } catch (error) {
      console.error("Global generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadingIndex = results.findIndex(r => r.status === 'loading');
  const buttonText = isGenerating 
    ? (loadingIndex !== -1 ? `Generating Variant ${loadingIndex + 1}/${results.length}...` : 'Initializing...') 
    : 'Generate Studio Set';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
               <i className="fa-solid fa-camera-retro text-white text-sm"></i>
            </div>
            <h1 className="font-bold text-xl tracking-tight">Lumina <span className="text-indigo-400 font-light">Studio</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {isGenerating && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-indigo-400 animate-pulse">
                <i className="fa-solid fa-circle-notch fa-spin"></i> PROCESSING
              </div>
            )}
            <div className="text-[10px] font-mono text-gray-500 border border-gray-800 px-2 py-1 rounded bg-black/20">
              {useFallbackModel ? 'GEMINI-FLASH' : 'GEMINI-3-PRO'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Controls Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-indigo-400"></i> Configuration
              </h2>
              
              {/* Product Description */}
              <div className="space-y-2 mb-6">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Product Prompt</label>
                <textarea
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all min-h-[120px] resize-none text-gray-200 placeholder-gray-600"
                  placeholder="Describe your product, style, lighting, and specific details..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="space-y-2">
                   <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Aspect Ratio</label>
                   <div className="relative">
                     <select 
                       className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-200 appearance-none cursor-pointer"
                       value={aspectRatio}
                       onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                     >
                       <option value="1:1">Square (1:1)</option>
                       <option value="16:9">Wide (16:9)</option>
                       <option value="4:3">Standard (4:3)</option>
                       <option value="3:4">Portrait (3:4)</option>
                       <option value="9:16">Story (9:16)</option>
                     </select>
                     <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none"></i>
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Resolution</label>
                   <div className="relative">
                     <select 
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-200 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value as ImageResolution)}
                        disabled={useFallbackModel} 
                      >
                        <option value="1K">1K (Fast)</option>
                        <option value="2K">2K (High)</option>
                        <option value="4K">4K (Ultra)</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none"></i>
                   </div>
                   {useFallbackModel && <p className="text-[9px] text-yellow-500 mt-1">Resolution unavailable in standard mode.</p>}
                 </div>
              </div>

              {/* Reference Image Upload */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex justify-between items-center">
                  <span>Reference Image (Optional)</span>
                  {refImage && <span className="text-indigo-400 text-[10px] cursor-pointer hover:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded" onClick={() => setRefImage(null)}>CLEAR</span>}
                </label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300 ${refImage ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-gray-700 hover:border-gray-500 bg-gray-900/30 hover:bg-gray-800/50'}`}>
                    {refImage ? (
                        <div className="relative w-full h-full p-2">
                            <img src={refImage} alt="Reference" className="h-full w-full object-contain rounded-lg" />
                            {/* Edit Ref Button */}
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    setEditingImage(refImage);
                                }}
                                className="absolute bottom-2 right-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg z-20"
                                title="Magic Edit this reference"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                            </button>
                        </div>
                    ) : (
                      <>
                         <i className="fa-regular fa-image text-2xl text-gray-500 mb-2 group-hover:text-gray-400 transition-colors"></i>
                         <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Click to upload reference</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt && !refImage)}
                className={`w-full mt-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg text-sm tracking-wide
                  ${isGenerating || (!prompt && !refImage)
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white hover:shadow-indigo-500/25 shadow-indigo-900/20 active:scale-[0.98] border border-transparent'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <Spinner /> {buttonText}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> {buttonText}
                  </>
                )}
              </button>
            </div>
            
            {/* Info Box */}
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 text-xs text-indigo-300/80 leading-relaxed flex gap-3">
              <i className="fa-solid fa-circle-info mt-0.5"></i>
              <span>
                Generates 7 distinct variants sequentially. Use the <strong>Magic Edit</strong> button on any image to customize it further with AI.
              </span>
            </div>
          </div>

          {/* Results Grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text