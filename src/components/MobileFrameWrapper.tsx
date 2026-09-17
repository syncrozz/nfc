import React from 'react';
import { Wifi, Battery, Signal, ArrowLeft, Home, Square } from 'lucide-react';

interface MobileFrameWrapperProps {
  isMobileFrame: boolean;
  children: React.ReactNode;
}

export const MobileFrameWrapper: React.FC<MobileFrameWrapperProps> = ({
  isMobileFrame,
  children,
}) => {
  if (!isMobileFrame) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>;
  }

  return (
    <div className="py-6 px-4 flex justify-center items-start min-h-[calc(100vh-4rem)] bg-slate-950/60">
      {/* Smartphone Device Frame */}
      <div className="w-full max-w-[430px] bg-slate-900 border-[6px] border-slate-700 rounded-[44px] shadow-2xl shadow-black/80 overflow-hidden flex flex-col relative transition-all ring-1 ring-slate-600/40">
        {/* Top Speaker / Dynamic Island Notch */}
        <div className="bg-slate-950 px-6 pt-3 pb-2 flex items-center justify-between border-b border-slate-800 text-[11px] text-slate-400 select-none">
          <span className="font-semibold text-slate-200">09:41</span>
          <div className="w-20 h-4 bg-slate-900 rounded-full flex items-center justify-center space-x-1.5 border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-slate-700" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center space-x-1.5">
            <Signal className="w-3.5 h-3.5 text-slate-300" />
            <Wifi className="w-3.5 h-3.5 text-slate-300" />
            <Battery className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Scrollable Viewport Content */}
        <div className="flex-1 overflow-y-auto max-h-[750px] p-4 scrollbar-thin scrollbar-thumb-slate-700">
          {children}
        </div>

        {/* Android Gesture Navigation Bar */}
        <div className="bg-slate-950 py-2.5 px-8 flex items-center justify-around border-t border-slate-800 text-slate-500 select-none">
          <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
};
