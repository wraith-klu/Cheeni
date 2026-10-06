import React, { useRef, useContext } from 'react';
import { UserDataContext } from "../context/userDataContext";
import { useNavigate } from 'react-router-dom';
import { LuImagePlus, LuArrowRight, LuSparkles, LuCheck } from "react-icons/lu";

import image1 from '../assets/image1.jpg';
import image2 from '../assets/image2.jpg';
import image3 from '../assets/image3.jpg';
import image4 from '../assets/image4.jpg';
import image5 from '../assets/image15.jpg';
import image6 from '../assets/image6.jpg';
import image7 from '../assets/image7.jpg';
import image8 from '../assets/image8.jpg';
import image9 from '../assets/image9.jpg';
import image10 from '../assets/image10.jpg';
import image11 from '../assets/image11.jpg';
import image12 from '../assets/image12.jpg';
import image13 from '../assets/image13.jpg';
import image14 from '../assets/image14.jpg';

function Customize() {
  const {
    selectedImage, setSelectedImage,
    frontendImage, setFrontendImage,
    setBackendImage,
  } = useContext(UserDataContext);

  const navigate = useNavigate();
  const inputImage = useRef();

  const images = [
    image1, image2, image3, image4, image5,
    image6, image7, image8, image9, image10,
    image11, image12, image13, image14
  ];

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBackendImage(file);  
    const fileURL = URL.createObjectURL(file);
    setFrontendImage(fileURL);
    setSelectedImage(null);
  };

  const handleNext = () => {
    navigate('/customize2');
  };

  return (
    <div className="w-full min-h-screen bg-[#050713] text-slate-100 flex flex-col items-center py-10 px-4 relative overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Ambient background glows */}
      <div className="fixed top-10 left-1/3 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-[450px] h-[450px] bg-cyan-600/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2 mb-8 relative z-10 max-w-xl">
        <div className="w-12 h-12 rounded-2xl glass-card border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] mb-1">
          <LuSparkles className="w-6 h-6" />
        </div>
        <h1 className="font-heading text-2xl sm:text-4xl font-bold tracking-tight text-white">
          Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Assistant Avatar</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Select an AI persona from the gallery or upload your custom companion image.
        </p>
      </div>

      {/* Grid */}
      <div className="w-full max-w-6xl grid gap-4 sm:gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 relative z-10 mb-10">
        {/* Upload Custom Card */}
        <div
          className={`cursor-pointer rounded-2xl glass-card flex flex-col items-center justify-center aspect-square overflow-hidden transition-all duration-300 group border ${
            frontendImage
              ? "border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.5)] scale-[1.02]"
              : "border-white/10 hover:border-cyan-400/50 hover:scale-[1.02]"
          }`}
          onClick={() => inputImage.current.click()}
        >
          {!frontendImage ? (
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <div className="w-12 h-12 rounded-2xl neo-convex flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <LuImagePlus className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-200">Upload Custom</p>
              <span className="text-[10px] text-slate-500">PNG, JPG, WebP</span>
            </div>
          ) : (
            <div className="w-full h-full relative">
              <img src={frontendImage} alt="Custom avatar" className="w-full h-full object-cover rounded-2xl" />
              <div className="absolute top-2 right-2 p-1.5 rounded-full bg-cyan-500 text-slate-950 font-bold shadow-lg">
                <LuCheck className="w-3.5 h-3.5" />
              </div>
            </div>
          )}
        </div>

        {/* Gallery Images */}
        {images.map((img, idx) => {
          const isSelected = selectedImage === img;
          return (
            <div
              key={idx}
              className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 relative group aspect-square border ${
                isSelected
                  ? "border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.55)] scale-[1.02]"
                  : "border-white/10 hover:border-white/30 hover:scale-[1.02]"
              }`}
              onClick={() => {
                setSelectedImage(img);
                setBackendImage(null);
                setFrontendImage(null);
              }}
            >
              <img src={img} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              {isSelected && (
                <div className="absolute top-2 right-2 p-1.5 rounded-full bg-cyan-400 text-slate-950 font-bold shadow-lg">
                  <LuCheck className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        <input type="file" accept="image/*" hidden ref={inputImage} onChange={handleUpload} />
      </div>

      {/* Continue Button */}
      {(selectedImage || frontendImage) && (
        <div className="fixed bottom-6 z-30 animate-bounce">
          <button
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500 hover:opacity-95 text-slate-950 font-bold text-sm sm:text-base flex items-center gap-2 shadow-[0_0_30px_rgba(6,182,212,0.5)] cursor-pointer"
            onClick={handleNext}
          >
            <span>Proceed to Naming</span>
            <LuArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default Customize;
