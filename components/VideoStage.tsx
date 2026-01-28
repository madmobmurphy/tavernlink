import React from 'react';
import { Mic, MicOff, Video, VideoOff, Crown, Sword, Monitor, Flame } from 'lucide-react';
import { User, UserRole } from '../types';

interface VideoStageProps {
  users: User[];
  currentUser: User | null;
  layout: 'table' | 'grid';
  onToggleMic: (val: boolean) => void;
  onToggleCam: (val: boolean) => void;
}

const AvatarDisplay: React.FC<{ avatar: string; name: string; size?: string }> = ({ avatar, name, size = "text-2xl" }) => {
  if (avatar && (avatar.startsWith('http') || avatar.startsWith('blob') || avatar.startsWith('/'))) {
    return <img src={avatar} alt={name} className="w-full h-full object-cover" />;
  }
  return <div className={`w-full h-full flex items-center justify-center ${size} bg-slate-800 text-slate-200 select-none font-serif`}>{avatar || name[0]}</div>;
};

// Reusable Participant Card
const ParticipantCard: React.FC<{ 
  user: User; 
  isTableMode: boolean;
  currentUser: User | null; 
  onToggleMic: (val: boolean) => void; 
  onToggleCam: (val: boolean) => void; 
}> = ({ user, isTableMode, currentUser, onToggleMic, onToggleCam }) => {
    const isSelf = user.id === currentUser?.id;
    // Check boolean isDM flag
    const isDM = user.isDM;

    return (
        <div className={`relative group transition-all duration-300 ${isTableMode ? (isDM ? 'w-32 h-32 md:w-40 md:h-40' : 'w-24 h-24 md:w-28 md:h-28') : 'w-full h-full min-h-[200px] bg-slate-900 rounded-xl border border-slate-800'}`}>
            <div className={`w-full h-full relative overflow-hidden shadow-xl transition-all ${
                isTableMode 
                    ? `rounded-full border-4 ${isDM ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.4)]' : 'border-slate-700 bg-slate-900'}`
                    : `rounded-xl border-2 ${isDM ? 'border-amber-500/50' : 'border-slate-700'}`
            }`}>
                {user.isVideoOn ? (
                   <AvatarDisplay avatar={user.avatar} name={user.name} />
                ) : (
                   <AvatarDisplay avatar={user.avatar} name={user.name} />
                )}
                
                {/* Self Controls Overlay */}
                {isSelf && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onToggleMic(!user.isMuted); }}
                      className={`p-2 rounded-full transition-colors ${user.isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}
                    >
                      {user.isMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
                    </button>
                    <button 
                       onClick={(e) => { e.stopPropagation(); onToggleCam(!user.isVideoOn); }}
                       className={`p-2 rounded-full transition-colors ${!user.isVideoOn ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}
                    >
                      {!user.isVideoOn ? <VideoOff className="w-4 h-4 text-white" /> : <Video className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                )}
            </div>

            {/* Name Tag */}
            <div className={`absolute ${isTableMode ? '-bottom-3 left-1/2 -translate-x-1/2' : 'bottom-2 left-2 right-2'} bg-black/80 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold text-white flex items-center justify-center gap-1 backdrop-blur-md border border-slate-700 z-10 whitespace-nowrap shadow-lg`}>
                {user.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                {user.name}
                {user.isScreenSharing && <Monitor className="w-3 h-3 text-blue-400" />}
            </div>

            {/* Role Badge */}
            {isDM && (
                <div className="absolute -top-2 -right-2 bg-amber-900 text-amber-100 p-1.5 rounded-full shadow-lg border border-amber-500 z-20">
                  <Crown className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};

export const VideoStage: React.FC<VideoStageProps> = ({ users, currentUser, layout, onToggleMic, onToggleCam }) => {
  // Use isDM boolean for filtering
  const dmUser = users.find(u => u.isDM);
  const players = users.filter(u => !u.isDM);
  const activeSharer = users.find(u => u.isScreenSharing);

  // --- GRID LAYOUT ---
  if (layout === 'grid') {
      return (
         <div className="flex-1 bg-slate-950 p-4 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
              {users.length > 0 ? users.map(u => (
                  <ParticipantCard 
                    key={u.id} 
                    user={u} 
                    isTableMode={false} 
                    currentUser={currentUser} 
                    onToggleMic={onToggleMic} 
                    onToggleCam={onToggleCam} 
                  />
              )) : (
                  <div className="col-span-full h-96 flex flex-col items-center justify-center text-slate-500">
                      <div className="w-16 h-16 rounded-full bg-slate-900 mb-4 flex items-center justify-center">
                          <Crown className="w-8 h-8 opacity-20" />
                      </div>
                      <p>The tavern is empty.</p>
                  </div>
              )}
            </div>
         </div>
       );
  }

  // --- TABLE LAYOUT ---
  return (
    <div className="flex-1 bg-slate-950 relative flex items-center justify-center overflow-hidden p-8">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[#1a1008]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#2d1b10] to-[#0f0705]"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10 mix-blend-overlay"></div>
      
      {/* Animated Torches */}
      <div className="absolute top-12 left-12 animate-pulse"><Flame className="w-8 h-8 text-orange-500 blur-[2px]" /></div>
      <div className="absolute top-12 right-12 animate-pulse delay-700"><Flame className="w-8 h-8 text-orange-500 blur-[2px]" /></div>
      <div className="absolute bottom-12 left-12 animate-pulse delay-300"><Flame className="w-8 h-8 text-orange-500 blur-[2px]" /></div>
      <div className="absolute bottom-12 right-12 animate-pulse delay-500"><Flame className="w-8 h-8 text-orange-500 blur-[2px]" /></div>

      {/* The Table */}
      <div className="relative w-full max-w-6xl aspect-video bg-[#3e2723] rounded-[60px] shadow-[0_30px_80px_rgba(0,0,0,0.95)] border-[16px] border-[#251610] flex items-center justify-center">
        {/* Table Texture */}
        <div className="absolute inset-0 rounded-[44px] opacity-40 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
        
        {/* Map / Screen Share Area */}
        <div className="absolute inset-12 rounded-[32px] bg-[#d7ccc8] opacity-90 overflow-hidden shadow-inner border-2 border-[#5d4037] flex items-center justify-center group">
           {activeSharer ? (
               <div className="w-full h-full bg-slate-900 relative">
                   {/* Placeholder for actual screen share stream */}
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-blue-400">
                       <Monitor className="w-16 h-16 mb-4 animate-pulse" />
                       <span className="font-mono text-lg">{activeSharer.name} is sharing...</span>
                   </div>
                   <div className="absolute bottom-4 right-4 bg-black/80 px-3 py-1 rounded text-xs text-white">Live Feed</div>
               </div>
           ) : (
               <>
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,180,50,0.1)_0%,transparent_70%)]"></div>
                 <div className="text-[#5d4037]/40 font-serif font-bold text-3xl select-none tracking-[0.2em]">ADVENTURE MAP</div>
               </>
           )}
        </div>

        {/* DM Position (Top Center) */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30">
          {dmUser ? (
            <ParticipantCard user={dmUser} isTableMode={true} currentUser={currentUser} onToggleMic={onToggleMic} onToggleCam={onToggleCam} />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-dashed border-slate-700/50 flex items-center justify-center bg-black/20">
              <Crown className="w-8 h-8 text-slate-700/50" />
            </div>
          )}
        </div>

        {/* Players Layout */}
        <div className="absolute left-[-50px] top-1/2 -translate-y-1/2 flex flex-col gap-8 z-20">
           {players.filter((_, i) => i % 3 === 0).map(u => <ParticipantCard key={u.id} user={u} isTableMode={true} currentUser={currentUser} onToggleMic={onToggleMic} onToggleCam={onToggleCam} />)}
        </div>

        <div className="absolute right-[-50px] top-1/2 -translate-y-1/2 flex flex-col gap-8 z-20">
            {players.filter((_, i) => i % 3 === 1).map(u => <ParticipantCard key={u.id} user={u} isTableMode={true} currentUser={currentUser} onToggleMic={onToggleMic} onToggleCam={onToggleCam} />)}
        </div>

        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex gap-12 z-20">
            {players.filter((_, i) => i % 3 === 2).map(u => <ParticipantCard key={u.id} user={u} isTableMode={true} currentUser={currentUser} onToggleMic={onToggleMic} onToggleCam={onToggleCam} />)}
        </div>
      </div>
    </div>
  );
};