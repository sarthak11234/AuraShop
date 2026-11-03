'use client';

import React, { useRef, useEffect, useState } from 'react';

export interface FilmModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoSrc?: string;
}

export function FilmModal({
  isOpen,
  onClose,
  videoSrc = '/videos/hero-film.mp4',
}: FilmModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Autoplay when opened
  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Autoplay policy might require mute
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current
              .play()
              .then(() => {
                setIsPlaying(true);
              })
              .catch(() => {});
          }
        });
    }
  }, [isOpen]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setProgress((curr / dur) * 100);

    const m = Math.floor(curr / 60);
    const s = Math.floor(curr % 60);
    setCurrentTime(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);

    const dm = Math.floor(dur / 60);
    const ds = Math.floor(dur % 60);
    setDuration(`${String(dm).padStart(2, '0')}:${String(ds).padStart(2, '0')}`);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * (videoRef.current.duration || 1);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 sm:p-8 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-[#090b0e] border border-white/15 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(235,51,51,0.25)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Bar Telemetry & Close ───────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3 monospace text-[10px] text-white/70">
            <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
            <span className="text-secondary font-bold tracking-widest">TRANSMISSION // ACTIVE</span>
            <span className="text-white/30">|</span>
            <span className="hidden sm:inline">VEXO_FILM.01</span>
            <span className="text-white/30 hidden sm:inline">|</span>
            <span className="hidden sm:inline text-white/50">1080P HEVC · 60FPS</span>
          </div>

          <button
            onClick={onClose}
            className="monospace text-[10px] text-white/70 hover:text-secondary px-3 py-1.5 border border-white/20 hover:border-secondary transition-all flex items-center gap-2 group"
          >
            <span>[ESC] CLOSE</span>
            <span className="text-secondary font-bold">✕</span>
          </button>
        </div>

        {/* ── Video Player Container ──────────────────────────────────── */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            loop
            onTimeUpdate={handleTimeUpdate}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Corner Cyber Brackets on Video */}
          <div className="absolute inset-4 pointer-events-none">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-secondary" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-secondary" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-secondary" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-secondary" />
          </div>

          {/* Center Play Overlay Icon when Paused */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity"
            >
              <div className="w-20 h-20 rounded-full border-2 border-secondary bg-black/80 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                <span className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[16px] border-l-secondary ml-1" />
              </div>
            </button>
          )}
        </div>

        {/* ── Bottom Video Controls & Scrubber ────────────────────────── */}
        <div className="p-4 px-6 bg-white/[0.03] border-t border-white/10 flex flex-col gap-3">
          {/* Progress Seek Bar */}
          <div
            className="w-full h-1.5 bg-white/15 rounded-full cursor-pointer relative overflow-hidden group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-secondary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Control Buttons & Timestamps */}
          <div className="flex items-center justify-between monospace text-[10px] text-white/80">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="hover:text-secondary transition-colors font-bold flex items-center gap-1.5"
              >
                {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
              </button>

              <button
                onClick={toggleMute}
                className="hover:text-secondary transition-colors"
              >
                {isMuted ? '🔇 UNMUTE' : '🔊 MUTED'}
              </button>

              <span className="text-white/40">
                {currentTime} / {duration}
              </span>
            </div>

            <div className="flex items-center gap-4 text-white/40">
              <span className="hidden sm:inline">FUTURE IN MOTION // CAM_01</span>
              <span className="text-secondary font-bold">VEXO RUNWAY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
