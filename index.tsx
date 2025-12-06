import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import JSZip from 'jszip';
// @ts-ignore
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';

// --- Types & Constants ---

type Category = 
  | 'Core Product Angles'
  | 'Detail / Close-Up Shots'
  | 'Functionality & Context'
  | 'Packaging & Presentation'
  | 'Variations & Format Deliverables'
  | 'Lifestyle & Creative Shots'
  | 'Signature Creative Shots';

interface VariantDef {
  id: string;
  title: string;
  category: Category;
  promptSuffix: string;
  defaultSelected?: boolean;
}

type AspectRatio = '1:1' | '16:9' | '4:3' | '3:4' | '9:16';

interface ImageResult {
  id: string;
  title: string;
  description: string;
  status: 'idle' | 'loading' | 'complete' | 'error';
  statusMessage?: string;
  imageUrl?: string;
  errorMsg?: string;
}

// --- Variant Library (Preserved) ---

const VARIANTS_LIB: VariantDef[] = [
  // 1️⃣ Core Product Angles
  { id: 'core-front', title: 'Front Shot', category: 'Core Product Angles', promptSuffix: "Aesthetic Front Shot: High-resolution 8K photorealistic shot of the product, perfectly centered, pure white background (#FFFFFF), soft even lighting, f/8 aperture for full sharpness." },
  { id: 'core-back', title: 'Back Shot', category: 'Core Product Angles', promptSuffix: "Aesthetic Back Shot: High-resolution 8K photorealistic shot of the rear of the product, centered, pure white background (#FFFFFF), showing back details clearly." },
  { id: 'core-left', title: 'Left Side', category: 'Core Product Angles', promptSuffix: "Aesthetic Left Side Shot: High-resolution 8K photorealistic profile view from the left, pure white background (#FFFFFF), soft shadows." },
  { id: 'core-right', title: 'Right Side', category: 'Core Product Angles', promptSuffix: "Aesthetic Right Side Shot: High-resolution 8K photorealistic profile view from the right, pure white background (#FFFFFF), soft shadows.", defaultSelected: true },
  { id: 'core-top', title: 'Top View', category: 'Core Product Angles', promptSuffix: "Aesthetic Top View Shot: High-resolution 8K photorealistic top-down view, geometric alignment, pure white background (#FFFFFF).", defaultSelected: true },
  { id: 'core-bottom', title: 'Bottom View', category: 'Core Product Angles', promptSuffix: "Aesthetic Bottom View Shot: High-resolution 8K photorealistic view of the bottom of the product, pure white background (#FFFFFF)." },
  { id: 'core-45', title: '45° Hero Angle', category: 'Core Product Angles', promptSuffix: "Aesthetic 45° Hero Angle Shot: High-resolution 8K photorealistic shot at a 45-degree angle, dynamic composition, pure white background (#FFFFFF), soft dramatic shadows." },

  // 2️⃣ Detail / Close-Up Shots
  { id: 'detail-texture', title: 'Texture Close-Up', category: 'Detail / Close-Up Shots', promptSuffix: "Aesthetic Close-Up (Texture Details): Macro photography, shallow depth of field (f/2.8), focusing intensely on the surface material and texture quality.", defaultSelected: true },
  { id: 'detail-features', title: 'Features/Ports', category: 'Detail / Close-Up Shots', promptSuffix: "Aesthetic Close-Up (Features/Buttons/Ports): Macro shot highlighting key buttons, ports, or unique functional features, sharp focus." },
  { id: 'detail-logo', title: 'Logo/Branding', category: 'Detail / Close-Up Shots', promptSuffix: "Aesthetic Close-Up (Logo/Branding): Artistic close-up of the brand logo or nameplate on the product, elegant lighting, premium feel." },
  { id: 'detail-material', title: 'Material/Stitching', category: 'Detail / Close-Up Shots', promptSuffix: "Aesthetic Close-Up (Material/Stitching): Extreme close-up showing craftsmanship, stitching, or material grain, soft luxury lighting." },

  // 3️⃣ Functionality & Context
  { id: 'func-use', title: 'Product in Use', category: 'Functionality & Context', promptSuffix: "Aesthetic Product in Use Shot: Photorealistic depiction of the product being actively used in its intended manner, human element implied or visible hands, realistic context.", defaultSelected: true },
  { id: 'func-demo', title: 'Functional Demo', category: 'Functionality & Context', promptSuffix: "Aesthetic Functional / Demonstration Shot: Shot showing the product's mechanism or main function in action (e.g., screen on, lid open, pouring)." },
  { id: 'func-scale', title: 'Scale Reference', category: 'Functionality & Context', promptSuffix: "Aesthetic Scale Shot (Hand / Object Reference): Product placed next to a common object or held in hand to visually demonstrate size and scale." },
  { id: 'func-before-after', title: 'Before & After', category: 'Functionality & Context', promptSuffix: "Aesthetic Before & After Shot: Split composition or conceptual shot showing the problem state vs the solution state provided by the product." },

  // 4️⃣ Packaging & Presentation
  { id: 'pack-closed', title: 'Box Closed', category: 'Packaging & Presentation', promptSuffix: "Aesthetic Packaging Shot (Box Closed): Pristine retail packaging shot, box closed, studio lighting, white background." },
  { id: 'pack-open', title: 'Box Open', category: 'Packaging & Presentation', promptSuffix: "Aesthetic Packaging Shot (Box Open): Retail packaging opened to reveal the product inside, inviting presentation." },
  { id: 'pack-unbox', title: 'Unboxing Sequence', category: 'Packaging & Presentation', promptSuffix: "Aesthetic Unboxing Sequence Shot: An action shot of the unboxing experience, removing lid or protective wrapping, first person perspective." },
  { id: 'pack-kit', title: 'Full Kit Layout', category: 'Packaging & Presentation', promptSuffix: "Aesthetic Full Kit / Included Contents Layout: Knolling style flat-lay photography of the product and all accessories/manuals arranged neatly on a clean surface." },

  // 5️⃣ Variations & Format Deliverables
  { id: 'var-group', title: 'Group Shot', category: 'Variations & Format Deliverables', promptSuffix: "Aesthetic Group Shot (Variants / Colors): If applicable, show multiple color variations of the product arranged artistically together." },
  { id: 'var-size', title: 'Size Comparison', category: 'Variations & Format Deliverables', promptSuffix: "Aesthetic Size Comparison Shot: Clear visual comparison with standard objects to show dimension." },
  { id: 'var-clean', title: 'Clean E-Comm', category: 'Variations & Format Deliverables', promptSuffix: "Aesthetic White Background Clean E-Commerce Shot: Standardized Amazon-style main listing image, perfectly lit, 100% white background." },
  { id: 'var-trans', title: 'Transparent BG (Prep)', category: 'Variations & Format Deliverables', promptSuffix: "Aesthetic Transparent Background PNG Shot: Product isolated on a high-contrast solid green or white background for easy background removal." },
  { id: 'var-square', title: 'Social Square 1:1', category: 'Variations & Format Deliverables', promptSuffix: "Aesthetic Square Social Format Shot (1:1): Instagram-ready lifestyle composition, perfectly balanced in a square frame." },
  { id: 'var-vertical', title: 'Vertical Video 9:16', category: 'Variations & Format Deliverables', promptSuffix: "Aesthetic Vertical Video Format Shot (9:16): Tall composition suitable for Stories/TikTok, with negative space for text overlays." },

  // 6️⃣ Lifestyle & Creative Shots
  { id: 'life-table', title: 'Minimal Tabletop', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Minimal Tabletop Shot: Clean architectural surface (concrete, marble, or wood), hard sunlight shadows, minimal props.", defaultSelected: true },
  { id: 'life-bath', title: 'Kitchen/Bathroom', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Kitchen / Bathroom Shot: Product placed in a high-end kitchen or spa-like bathroom environment, realistic moisture or steam details if applicable." },
  { id: 'life-desk', title: 'Desk Setup', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Desk / Workspace Setup Shot: Tech-focused or productivity setup, product on a desk with keyboard, mouse, and coffee, depth of field." },
  { id: 'life-bed', title: 'Bedroom/Soft', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Bedroom / Soft Texture Shot: Product on soft linen sheets or cozy duvet, warm inviting morning light, relaxed atmosphere." },
  { id: 'life-outdoor', title: 'Outdoor Natural', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Outdoor Natural Light Shot: Product outdoors, golden hour lighting, nature bokeh background (forest, beach, or park)." },
  { id: 'life-urban', title: 'Urban/Café', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Urban / Café Shot: Product on a café table or urban street setting, city life background blur, trendy vibe." },
  { id: 'life-bag', title: 'In-Bag/Pocket', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Pocket / Bag Portability Shot: Product peeking out of a stylish backpack, tote, or pocket, implying portability." },
  { id: 'life-morning', title: 'Morning Ritual', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Morning Ritual Shot: Morning vibes, sunlight streaming through blinds, coffee cup, book, peaceful start to the day.", defaultSelected: true },
  { id: 'life-night', title: 'Night Mood', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Night Mood Shot: Dark mode aesthetic, neon city lights reflection or warm bedside lamp lighting, moody and cozy." },
  { id: 'life-seasonal', title: 'Seasonal Theme', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Seasonal / Festive Theme Shot: Subtle holiday props (e.g., pinecone for winter, flower for spring) styling the product." },
  { id: 'life-flatlay', title: 'Styled Flat Lay', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Flat Lay Shot With Props: Top-down view with curated props relevant to the product's niche, artistic arrangement.", defaultSelected: true },
  { id: 'life-shelf', title: 'Shelf Display', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Shelf Display Shot: Product sitting on a floating shelf or retail display, organized interior design context." },
  { id: 'life-pov', title: 'POV Shot', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Over-the-Shoulder POV Shot: First-person view looking down at the product in hands or on lap." },
  { id: 'life-candid', title: 'Candid Natural', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Candid Natural Placement Shot: Product left casually on a side table or couch, looking lived-in and authentic." },
  { id: 'life-move', title: 'Movement', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Shot With Movement: Freeze-frame action, steam rising, water splashing, or fabric flowing around the product." },
  { id: 'life-hand', title: 'Hand-Holding', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Hand-Holding Shot: A diverse hand model holding the product naturally, showing grip and ergonomics." },
  { id: 'life-model', title: 'Model Interaction', category: 'Lifestyle & Creative Shots', promptSuffix: "Aesthetic Model Interaction Shot: A model interacting with the product in the background, shallow depth of field focus on product.", defaultSelected: true },

  // 7️⃣ Signature Creative Shots
  { id: 'sig-hero', title: 'Hero Creative', category: 'Signature Creative Shots', promptSuffix: "Aesthetic Hero Creative Shot: Award-winning advertising photography style, bold colors, dramatic composition." },
  { id: 'sig-float', title: 'Levitation', category: 'Signature Creative Shots', promptSuffix: "Aesthetic Floating / Levitation Shot: The product suspended in mid-air, defying gravity, surreal and magical feel." },
  { id: 'sig-splash', title: 'Splash/Motion', category: 'Signature Creative Shots', promptSuffix: "Aesthetic Splash / Motion Shot: Dynamic liquid splash or powder explosion around the product (if relevant) or high-speed motion blur background." },
  { id: 'sig-shadow', title: 'Dramatic Shadow', category: 'Signature Creative Shots', promptSuffix: "Aesthetic Dramatic Shadow Shot: Gobo lighting creating interesting foliage or window blind shadows across the product." },
  { id: 'sig-brand', title: 'Color Branding', category: 'Signature Creative Shots', promptSuffix: "Aesthetic Color Background Branding Shot: Product on a seamless paper background matching its brand color palette, monochromatic look." },
];

const GLOBAL_STYLE = "Main Style: Ultra-sharp studio shot with soft lighting. Camera & Quality Specs: 8K resolution, f/1.8 aperture, 85mm focal length, professional product lighting, DSLR depth-of-field realism. IMPORTANT: No logos, copyright designs, or text.";

// --- Helpers ---

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
    image.src = url
  })

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx || !pixelCrop) {
    return ''
  }

  // set canvas size to match the crop size
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // draw image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // As Base64 string
  return canvas.toDataURL('image/png');
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

// --- Components ---

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const Badge = ({ children, className, variant = 'default' }: { children?: React.ReactNode, className?: string, variant?: 'default' | 'outline' | 'destructive' | 'secondary' }) => {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default: "border-transparent bg-zinc-50 text-zinc-900 hover:bg-zinc-50/80",
    secondary: "border-transparent bg-zinc-800 text-zinc-50 hover:bg-zinc-800/80",
    destructive: "border-transparent bg-red-900 text-zinc-50 hover:bg-red-900/80",
    outline: "text-zinc-50 border-zinc-800"
  };
  return (
    <span className={`${base} ${variants[variant]} ${className || ''}`}>
      {children}
    </span>
  );
};

const RefCropModal: React.FC<{
    imageUrl: string;
    onClose: () => void;
    onSave: (newUrl: string) => void;
}> = ({ imageUrl, onClose, onSave }) => {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [aspect, setAspect] = useState<number | undefined>(undefined);
    const imgRef = useRef<HTMLImageElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    // When aspect changes, re-center crop if image is loaded
    useEffect(() => {
      if (imgRef.current && aspect) {
        const { width, height } = imgRef.current;
        const newCrop = centerAspectCrop(width, height, aspect);
        setCrop(newCrop);
        setCompletedCrop(convertToPixelCrop(newCrop, width, height));
      }
    }, [aspect]);

    // Helper to initialize crop on image load
    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
      if (aspect) {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, aspect));
      } else {
          // Default crop if no aspect
           const { width, height } = e.currentTarget;
           setCrop(centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
            width,
            height
           ));
      }
    }

    function convertToPixelCrop(crop: Crop, imageWidth: number, imageHeight: number): PixelCrop {
       return {
         unit: 'px',
         x: crop.unit === '%' ? (crop.x / 100) * imageWidth : crop.x,
         y: crop.unit === '%' ? (crop.y / 100) * imageHeight : crop.y,
         width: crop.unit === '%' ? (crop.width / 100) * imageWidth : crop.width,
         height: crop.unit === '%' ? (crop.height / 100) * imageHeight : crop.height
       };
    }

    const handleSave = async () => {
        if (!completedCrop || !imgRef.current) return;
        try {
            setIsSaving(true);
            const img = imgRef.current;
            
            // Calculate scale factor between displayed image and natural image
            const scaleX = img.naturalWidth / img.width;
            const scaleY = img.naturalHeight / img.height;

            const cropToSave: PixelCrop = {
                unit: 'px',
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY
            };

            const cropped = await getCroppedImg(imageUrl, cropToSave);
            onSave(cropped);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl h-[80vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                 {/* Header */}
                 <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                    <h3 className="text-sm font-medium text-zinc-100">Crop Reference Image</h3>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 mr-4 border-r border-zinc-700 pr-4 h-7">
                            <button onClick={() => setAspect(1)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === 1 ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>1:1</button>
                            <button onClick={() => setAspect(16/9)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === 16/9 ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>16:9</button>
                            <button onClick={() => setAspect(4/5)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === 4/5 ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>4:5</button>
                            <button onClick={() => setAspect(undefined)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === undefined ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>Free</button>
                        </div>
                        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded hover:bg-zinc-800 transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs bg-zinc-100 text-zinc-950 px-3 py-1.5 rounded font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2">
                            {isSaving && <Spinner />}
                            Save Crop
                        </button>
                    </div>
                 </div>
                 
                 {/* Cropper */}
                 <div className="flex-1 relative bg-[#0F1115] overflow-auto flex items-center justify-center p-4">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={aspect}
                    >
                        <img 
                            ref={imgRef} 
                            src={imageUrl} 
                            alt="Reference" 
                            onLoad={onImageLoad}
                            style={{ maxHeight: '65vh' }}
                        />
                    </ReactCrop>
                 </div>
            </div>
        </div>
    );
}

const ImageModal: React.FC<{ 
  result: ImageResult; 
  projectName: string;
  onClose: () => void;
  onUpdate: (newUrl: string) => void;
}> = ({ result, projectName, onClose, onUpdate }) => {
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  if (!result.imageUrl) return null;

  // Initialize crop when entering crop mode
  useEffect(() => {
    if (isCropping && imgRef.current) {
        const { width, height } = imgRef.current;
        const initialCrop = aspect 
            ? centerAspectCrop(width, height, aspect)
            : centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height);
        setCrop(initialCrop);
    }
  }, [isCropping, aspect]);

  const handleSaveCrop = async () => {
    if (!completedCrop || !imgRef.current) return;
    try {
      setIsSaving(true);
      const img = imgRef.current;
      
      // Calculate scale factor between displayed image and natural image
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const cropToSave: PixelCrop = {
          unit: 'px',
          x: completedCrop.x * scaleX,
          y: completedCrop.y * scaleY,
          width: completedCrop.width * scaleX,
          height: completedCrop.height * scaleY
      };

      const croppedImage = await getCroppedImg(result.imageUrl!, cropToSave);
      onUpdate(croppedImage);
      setIsCropping(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const fileName = `${(projectName || 'producon').replace(/\s+/g, '-')}-${result.title.replace(/\s+/g, '-').toLowerCase()}.png`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
         
         {/* Toolbar */}
         <div className="flex items-center justify-between mb-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 backdrop-blur">
            <div className="text-zinc-100 font-medium">{result.title}</div>
            <div className="flex gap-2 items-center">
               {isCropping ? (
                  <>
                    <div className="flex items-center gap-1 mr-2 border-r border-zinc-700 pr-2 h-7">
                        <button onClick={() => setAspect(1)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === 1 ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>1:1</button>
                        <button onClick={() => setAspect(16/9)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === 16/9 ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>16:9</button>
                        <button onClick={() => setAspect(4/5)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === 4/5 ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>4:5</button>
                        <button onClick={() => setAspect(undefined)} className={`text-[10px] px-2 rounded h-full flex items-center font-medium transition-colors ${aspect === undefined ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>Free</button>
                    </div>

                    <button 
                      onClick={() => setIsCropping(false)}
                      className="h-9 px-4 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveCrop}
                      className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                      disabled={isSaving}
                    >
                      {isSaving && <Spinner />}
                      Apply Crop
                    </button>
                  </>
               ) : (
                 <>
                    <button 
                      onClick={() => setIsCropping(true)}
                      className="h-9 px-4 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <i className="fa-solid fa-crop-simple text-xs"></i>
                      Crop
                    </button>
                    <a 
                      href={result.imageUrl} 
                      download={fileName}
                      className="h-9 px-4 inline-flex items-center justify-center rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-sm font-medium transition-colors gap-2"
                    >
                      <i className="fa-solid fa-download text-xs"></i>
                      Download
                    </a>
                    <button 
                      onClick={onClose}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-200 transition-colors"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                 </>
               )}
            </div>
         </div>

         {/* Editor/View Area */}
         <div className="relative flex-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center">
            {isCropping ? (
              <div className="relative w-full h-full bg-[#0F1115] flex items-center justify-center p-4 overflow-auto">
                 <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspect}
                 >
                    <img ref={imgRef} src={result.imageUrl} alt={result.title} style={{ maxHeight: '75vh' }} />
                 </ReactCrop>
              </div>
            ) : (
               <img src={result.imageUrl} alt={result.title} className="max-w-full max-h-full object-contain bg-[#0F1115]" />
            )}
         </div>

      </div>
    </div>
  );
};

const ImageCard: React.FC<{ result: ImageResult, onExpand: (id: string) => void }> = ({ result, onExpand }) => {
  const isComplete = result.status === 'complete';
  const isLoading = result.status === 'loading';
  const isError = result.status === 'error';

  return (
    <div className={`relative group rounded-lg border bg-zinc-900 transition-all duration-300 ${isComplete ? 'border-zinc-800 hover:border-zinc-600' : 'border-zinc-800'}`}>
      {/* Header Overlay */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <div className="bg-zinc-950/80 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-zinc-300 border border-zinc-800/50 uppercase tracking-wider">
          {result.title}
        </div>
      </div>

      {/* Image Area */}
      <div className="aspect-square relative w-full bg-zinc-950/50 overflow-hidden rounded-t-lg">
        {isComplete && result.imageUrl ? (
          <img 
            src={result.imageUrl} 
            alt={result.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
            onClick={() => onExpand(result.id)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
             {isLoading ? (
               <div className="flex flex-col items-center text-center space-y-3">
                 <Spinner />
                 <div className="space-y-1">
                    <div className="text-xs font-medium text-zinc-300">Processing</div>
                    {result.statusMessage && (
                      <div className="text-[10px] text-zinc-500">{result.statusMessage}</div>
                    )}
                 </div>
               </div>
             ) : isError ? (
               <div className="flex flex-col items-center text-red-400 text-center space-y-2">
                 <i className="fa-solid fa-circle-exclamation"></i>
                 <div className="text-[10px] max-w-full break-words opacity-80">{result.errorMsg}</div>
               </div>
             ) : (
               <div className="text-zinc-700 flex flex-col items-center gap-2">
                 <i className="fa-regular fa-image text-lg"></i>
                 <span className="text-[10px] font-medium uppercase tracking-widest opacity-50">Pending</span>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Footer Status / Actions */}
      <div className="p-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-900 rounded-b-lg">
         <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-emerald-500' : isLoading ? 'bg-amber-500 animate-pulse' : isError ? 'bg-red-500' : 'bg-zinc-700'}`}></div>
           <span className="text-[10px] text-zinc-400 font-medium">
             {isComplete ? 'Ready' : isLoading ? 'Generating' : isError ? 'Failed' : 'Queued'}
           </span>
         </div>
         {isComplete && (
            <button 
              onClick={() => onExpand(result.id)}
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <i className="fa-solid fa-expand text-xs"></i>
            </button>
         )}
      </div>
    </div>
  );
}

function App() {
  const [projectName, setProjectName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [isCroppingRef, setIsCroppingRef] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const stopGenerationRef = useRef(false);
  
  // Selection State - Initialize with LocalStorage logic
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('producon-selected-variants');
        if (saved) {
            return new Set(JSON.parse(saved));
        }
    } catch (e) {
        console.error("Failed to load saved selection", e);
    }
    // Default fallback if nothing in storage
    return new Set(VARIANTS_LIB.filter(v => v.defaultSelected).map(v => v.id));
  });
  
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(new Set(['Core Product Angles', 'Lifestyle & Creative Shots']));

  // Persist selection changes
  useEffect(() => {
    localStorage.setItem('producon-selected-variants', JSON.stringify(Array.from(selectedVariantIds)));
  }, [selectedVariantIds]);

  // Results State
  const [results, setResults] = useState<ImageResult[]>([]);

  // Derived selection
  const selectedResult = useMemo(() => results.find(r => r.id === selectedResultId), [results, selectedResultId]);

  // Group variants for UI
  const variantsByCategory = useMemo(() => {
    const groups: Record<string, VariantDef[]> = {};
    VARIANTS_LIB.forEach(v => {
      if (!groups[v.category]) groups[v.category] = [];
      groups[v.category].push(v);
    });
    return groups;
  }, []);

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

  const toggleCategory = (cat: Category) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const toggleVariant = (id: string) => {
    const next = new Set(selectedVariantIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedVariantIds(next);
  };

  const handleSelectAllInCategory = (cat: Category, select: boolean) => {
    const next = new Set(selectedVariantIds);
    const catVariants = variantsByCategory[cat];
    catVariants.forEach(v => {
      if (select) next.add(v.id);
      else next.delete(v.id);
    });
    setSelectedVariantIds(next);
  }

  const updateImageResult = (newUrl: string) => {
    if (!selectedResultId) return;
    setResults(prev => {
        const next = [...prev];
        const idx = next.findIndex(r => r.id === selectedResultId);
        if (idx !== -1) {
            next[idx] = { ...next[idx], imageUrl: newUrl };
        }
        return next;
    });
  };

  const handleDownloadAll = () => {
    const completed = results.filter(r => r.status === 'complete' && r.imageUrl);
    if (completed.length === 0) return;
    
    const baseName = projectName || 'producon';

    completed.forEach((result, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = result.imageUrl!;
        link.download = `${baseName.replace(/\s+/g, '-')}-${result.title.replace(/\s+/g, '-').toLowerCase()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 300);
    });
  };

  const handleDownloadZip = async () => {
    const completed = results.filter(r => r.status === 'complete' && r.imageUrl);
    if (completed.length === 0) return;

    const zip = new JSZip();
    const baseName = projectName ? projectName.replace(/\s+/g, '-') : 'producon';

    completed.forEach(result => {
        // Remove data:image/png;base64, prefix
        const data = result.imageUrl!.split(',')[1];
        const filename = `${baseName}-${result.title.replace(/\s+/g, '-').toLowerCase()}.png`;
        zip.file(filename, data, {base64: true});
    });

    const blob = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // If project name is provided, use that for the ZIP name. Else default to producon-assets.
    a.download = projectName ? `${baseName}.zip` : `producon-assets.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStop = () => {
    stopGenerationRef.current = true;
  };

  const handleGenerate = async () => {
    if (!prompt && !refImage) return;
    if (selectedVariantIds.size === 0) {
      alert("Please select at least one shot type.");
      return;
    }

    setIsGenerating(true);
    stopGenerationRef.current = false;

    const activeVariants = VARIANTS_LIB.filter(v => selectedVariantIds.has(v.id));
    const initialResults: ImageResult[] = activeVariants.map(v => ({
      id: v.id,
      title: v.title,
      description: v.promptSuffix,
      status: 'idle',
      statusMessage: 'Waiting...'
    }));
    setResults(initialResults);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      for (let i = 0; i < activeVariants.length; i++) {
        if (stopGenerationRef.current) break;

        const variant = activeVariants[i];
        let attempt = 0;
        const maxRetries = 3;
        let success = false;

        while (attempt < maxRetries && !success) {
            if (stopGenerationRef.current) break;

            try {
                setResults(prev => {
                    const next = [...prev];
                    const idx = next.findIndex(r => r.id === variant.id);
                    if (idx !== -1) {
                      next[idx] = { 
                          ...next[idx], 
                          status: 'loading',
                          statusMessage: attempt > 0 ? `Retry (${attempt}/${maxRetries})` : 'Rendering...'
                      };
                    }
                    return next;
                });

                let desc = prompt ? `Product Description: ${prompt}.` : "Product Description: Analyze the reference image to generate the specific view of the product shown.";
                
                // Append negative prompt
                const neg = negativePrompt ? `\n\nNEGATIVE PROMPT (Strictly Avoid): ${negativePrompt}` : "";
                
                const finalPrompt = `${desc} \n\nSpecific Shot Requirement: ${variant.promptSuffix} \n\n${GLOBAL_STYLE}${neg}`;
                
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

                // Exclusively use flash model, no imageSize config
                const modelName = 'gemini-2.5-flash-image';
                const config: any = { imageConfig: { aspectRatio: aspectRatio } };

                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: { parts },
                    config: config
                });
                
                if (stopGenerationRef.current) break;

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
                        const idx = next.findIndex(r => r.id === variant.id);
                        if (idx !== -1) {
                           next[idx] = { ...next[idx], status: 'complete', imageUrl, statusMessage: 'Done' };
                        }
                        return next;
                    });
                    success = true;
                } else {
                    throw new Error("No image data received");
                }

            } catch (err: any) {
                if (stopGenerationRef.current) break;
                
                console.warn(`Error ${variant.title}:`, err);
                attempt++;
                if (attempt >= maxRetries) {
                    setResults(prev => {
                        const next = [...prev];
                        const idx = next.findIndex(r => r.id === variant.id);
                        if (idx !== -1) {
                          next[idx] = { 
                              ...next[idx], 
                              status: 'error', 
                              errorMsg: err.message || 'Failed',
                              statusMessage: 'Failed'
                          };
                        }
                        return next;
                    });
                } else {
                    const delay = 1500 * Math.pow(1.5, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
      }
    } catch (error) {
      console.error("Global Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadingCount = results.filter(r => r.status === 'loading' || r.status === 'idle').length;
  const completedCount = results.filter(r => r.status === 'complete').length;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-50 selection:bg-zinc-800 selection:text-zinc-50 overflow-hidden">
      
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-50 rounded flex items-center justify-center shadow-sm">
             <i className="fa-solid fa-cube text-zinc-900 text-sm"></i>
          </div>
          <h1 className="font-semibold text-lg tracking-tight text-zinc-100">Producon <span className="text-zinc-500 font-normal">Studio</span></h1>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="secondary" className="h-7 font-mono">
              FLASH
           </Badge>
           <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <i className="fa-regular fa-user text-xs text-zinc-400"></i>
           </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-[400px] flex flex-col border-r border-zinc-800 bg-zinc-900/30 flex-shrink-0 relative z-10">
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Configuration Section */}
              <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/50">
                      <i className="fa-solid fa-sliders text-zinc-500 text-xs"></i>
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Context</h2>
                  </div>
                  
                  {/* Project Name */}
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-zinc-300">Project Name</label>
                    <input
                      type="text"
                      className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300 transition-all"
                      placeholder="e.g. MyProduct V1"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>

                  {/* Prompt */}
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-zinc-300">Description</label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all"
                      placeholder="Describe your product..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>
                  
                  {/* Negative Prompt */}
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-zinc-300">Negative Prompt</label>
                    <input
                      type="text"
                      className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-300 transition-all"
                      placeholder="e.g. hands, text, distortion, messy"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                    />
                  </div>

                  {/* Reference */}
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-zinc-300 flex justify-between items-center">
                      <span>Reference</span>
                      {refImage && (
                        <div className="flex gap-3">
                             <span className="text-zinc-500 hover:text-zinc-100 cursor-pointer transition-colors flex items-center gap-1" onClick={() => setIsCroppingRef(true)}>
                                <i className="fa-solid fa-crop-simple text-[10px]"></i> Crop
                             </span>
                             <span className="text-zinc-500 hover:text-red-300 cursor-pointer transition-colors flex items-center gap-1" onClick={() => setRefImage(null)}>
                                <i className="fa-solid fa-trash text-[10px]"></i> Remove
                             </span>
                        </div>
                      )}
                    </label>
                    <div className="relative group">
                       <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          disabled={!!refImage}
                       />
                       <div className={`h-20 w-full rounded-md border border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden ${refImage ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900'}`}>
                          {refImage ? (
                            <img src={refImage} alt="Ref" className="h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <>
                              <i className="fa-solid fa-cloud-arrow-up text-zinc-600"></i>
                              <span className="text-[10px] text-zinc-500">Upload Reference</span>
                            </>
                          )}
                       </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="grid grid-cols-1 gap-4">
                     <div className="space-y-2">
                       <label className="text-xs font-medium text-zinc-300">Aspect</label>
                       <div className="relative">
                          <select 
                            className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                          >
                            <option value="1:1">1:1 Square</option>
                            <option value="16:9">16:9 Landscape</option>
                            <option value="4:3">4:3 Standard</option>
                            <option value="3:4">3:4 Portrait</option>
                            <option value="9:16">9:16 Vertical</option>
                          </select>
                       </div>
                     </div>
                  </div>
              </div>

              {/* Shot List Section */}
              <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-list-check text-zinc-500 text-xs"></i>
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Shot List</h2>
                      </div>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{selectedVariantIds.size} Selected</span>
                  </div>
                  
                  <div className="space-y-1">
                    {(Object.keys(variantsByCategory) as Category[]).map(cat => {
                      const isExpanded = expandedCategories.has(cat);
                      const variants = variantsByCategory[cat];
                      const allSelected = variants.every(v => selectedVariantIds.has(v.id));

                      return (
                        <div key={cat} className="mb-1">
                          <div 
                            className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors group ${isExpanded ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/20'}`}
                            onClick={() => toggleCategory(cat)}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                               <i className={`fa-solid fa-chevron-right text-[10px] text-zinc-500 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}></i>
                               <span className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 truncate">{cat}</span>
                            </div>
                            <button 
                               onClick={(e) => { e.stopPropagation(); handleSelectAllInCategory(cat, !allSelected); }}
                               className="text-[10px] text-zinc-500 hover:text-zinc-100 font-medium px-2 py-1 rounded hover:bg-zinc-700 transition-colors shrink-0"
                            >
                               {allSelected ? 'None' : 'All'}
                            </button>
                          </div>
                          
                          {isExpanded && (
                            <div className="pl-4 pr-2 py-1 space-y-0.5 ml-3 border-l border-zinc-800 mt-1">
                               {variants.map(v => {
                                 const isSelected = selectedVariantIds.has(v.id);
                                 return (
                                   <div 
                                     key={v.id} 
                                     onClick={() => toggleVariant(v.id)}
                                     className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all text-xs ${isSelected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                   >
                                      <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-zinc-50 border-zinc-50 text-zinc-950' : 'border-zinc-700 bg-transparent'}`}>
                                         {isSelected && <i className="fa-solid fa-check text-[9px]"></i>}
                                      </div>
                                      <span className="truncate">{v.title}</span>
                                   </div>
                                 );
                               })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
              </div>
          </div>

          {/* Fixed Footer Action */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur">
              {isGenerating ? (
                  <button
                    onClick={handleStop}
                    className="w-full h-11 inline-flex items-center justify-center rounded-md text-sm font-semibold bg-red-950/40 text-red-200 border border-red-900 hover:bg-red-900/60 transition-colors shadow-sm"
                  >
                    <Spinner />
                    <span className="ml-2">Stop Generating ({loadingCount})</span>
                  </button>
              ) : (
                  <button
                      onClick={handleGenerate}
                      disabled={(!prompt && !refImage) || selectedVariantIds.size === 0}
                      className={`w-full h-11 inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 disabled:pointer-events-none disabled:opacity-50
                        ${(!prompt && !refImage) || selectedVariantIds.size === 0
                          ? 'bg-zinc-800 text-zinc-500'
                          : 'bg-zinc-50 text-zinc-950 hover:bg-zinc-200 shadow-sm'
                        }`}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                      Generate Assets
                  </button>
              )}
          </div>
        </aside>

        {/* Main Content (Gallery) */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-8 custom-scrollbar relative">
           <div className="max-w-[1600px] mx-auto space-y-6">
              {/* Gallery Header */}
              <div className="flex items-center justify-between sticky top-0 z-10 bg-zinc-950/80 backdrop-blur py-4 border-b border-transparent transition-all">
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-100 tracking-tight">Gallery</h2>
                  <p className="text-sm text-zinc-500">Review and export your generated assets.</p>
                </div>
                <div className="flex gap-3">
                   {completedCount > 0 && (
                      <>
                        <button 
                          onClick={handleDownloadZip}
                          className="h-9 px-4 inline-flex items-center justify-center rounded-md bg-zinc-100 text-sm font-medium text-zinc-900 shadow hover:bg-zinc-200 transition-colors"
                        >
                          <i className="fa-solid fa-file-zipper mr-2"></i>
                          Download ZIP
                        </button>
                        <button 
                          onClick={handleDownloadAll}
                          className="h-9 px-3 inline-flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-400 shadow-sm hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                          title="Download as separate files"
                        >
                          <i className="fa-solid fa-download"></i>
                        </button>
                      </>
                   )}
                </div>
              </div>
              
              {/* Gallery Grid */}
              {results.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 min-h-[500px] flex flex-col items-center justify-center text-zinc-500 gap-6 mt-10">
                  <div className="h-20 w-20 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                     <i className="fa-solid fa-images text-3xl opacity-40"></i>
                  </div>
                  <div className="text-center space-y-2 max-w-md">
                     <p className="text-base font-medium text-zinc-300">Workspace Empty</p>
                     <p className="text-sm opacity-70">Configure your product details and select your desired shots from the sidebar to begin generating high-fidelity assets.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-20">
                  {results.map((result) => (
                    <ImageCard 
                      key={result.id} 
                      result={result} 
                      onExpand={(id) => setSelectedResultId(id)}
                    />
                  ))}
                </div>
              )}
           </div>
        </main>
      </div>

      {selectedResult && (
        <ImageModal 
          result={selectedResult}
          projectName={projectName}
          onClose={() => setSelectedResultId(null)} 
          onUpdate={updateImageResult}
        />
      )}

      {isCroppingRef && refImage && (
        <RefCropModal
            imageUrl={refImage}
            onClose={() => setIsCroppingRef(false)}
            onSave={(newUrl) => {
                setRefImage(newUrl);
                setIsCroppingRef(false);
            }}
        />
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);