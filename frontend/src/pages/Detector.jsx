import React, { useEffect, useRef, useState } from 'react';
import { UserButton } from '@clerk/clerk-react';

export default function Detector() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [prediction, setPrediction] = useState(null); // { label: 'REAL' | 'FAKE', confidence: float }

  useEffect(() => {
    // Setup the webcam stream
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    }
    setupWebcam();

    // Cleanup function
    return () => {
      stopRecording();
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const sendVideoChunk = async (blob) => {
    if (!blob || blob.size === 0) return;

    const formData = new FormData();
    formData.append('chunk', blob, 'chunk.webm');

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/detect`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // data should be { label: 'FAKE' | 'REAL', confidence: float }
        setPrediction(data);
      } else {
        console.error('Failed to get prediction:', await response.text());
      }
    } catch (error) {
      console.error('Error sending video chunk:', error);
    }
  };

  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;

    const stream = videoRef.current.srcObject;
    let options = { mimeType: 'video/webm' };
    
    // Check for supported mimeTypes if webm is not supported by the browser
    if (!MediaRecorder.isTypeSupported('video/webm')) {
      options = { mimeType: 'video/mp4' };
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          await sendVideoChunk(event.data);
        }
      };

      // Start recording and slice chunks every 2000 milliseconds
      mediaRecorder.start(2000);
    } catch (error) {
      console.error('Error starting MediaRecorder:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    if (isDetecting) {
      startRecording();
    } else {
      stopRecording();
    }

    return () => {
      stopRecording();
    };
  }, [isDetecting]);

  const toggleDetection = () => {
    setIsDetecting(!isDetecting);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="fixed top-0 w-full px-8 py-4 flex justify-between items-center z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-linear-to-br from-violet-500 to-purple-600"></div>
          <span className="text-[13px] font-semibold tracking-tight">DeepfakeRT Detector (Live Stream)</span>
        </div>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { userButtonAvatarBox: "w-8 h-8 border border-white/10" }
          }}
        />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 mt-20">
        <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl shadow-violet-500/10 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto object-cover"
          />
          
          {/* Scanning line animation when detecting */}
          {isDetecting && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden object-cover z-10">
              <div className="w-full h-[2px] bg-violet-500 shadow-[0_0_15px_3px_rgba(139,92,246,0.5)] animate-[scan_2s_linear_infinite]" 
                   style={{
                     animation: 'scan 2s linear infinite'
                   }}>
              </div>
            </div>
          )}

          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan {
              0% { transform: translateY(0); }
              50% { transform: translateY(100vh); }
              100% { transform: translateY(0); }
            }
          `}} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-6">
          <button
            onClick={toggleDetection}
            className={`px-8 py-3 rounded-xl font-medium tracking-tight text-[14px] transition-all duration-300 ${
              isDetecting 
                ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20' 
                : 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
            }`}
          >
            {isDetecting ? 'Stop Stream Analysis' : 'Start Stream Analysis'}
          </button>

          <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-md">
            <h3 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Sequence Prediction</h3>
            {prediction ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <span className={`text-3xl font-bold tracking-tight ${
                  prediction.label === 'FAKE' ? 'text-red-500' : 'text-emerald-500'
                }`}>
                  {prediction.label}
                </span>
                <span className="text-[14px] text-slate-300 font-medium">
                  Confidence: <span className="text-white">{(prediction.confidence * 100).toFixed(2)}%</span>
                </span>
              </div>
            ) : (
              <div className="text-[14px] text-slate-500 italic py-4">
                {isDetecting ? 'Analyzing live chunks...' : 'Ready to start live stream analysis...'}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
