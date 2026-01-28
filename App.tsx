import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Home, Plus, Settings, LogOut, Hash, Volume2, Mic, MicOff, Video, VideoOff, Users, 
  Send, Paperclip, Smile, Search, X, Loader2, Sparkles, Wand2, Shield, LayoutGrid, Dices, Monitor, Sword, Crown,
  Image as ImageIcon, Trash2, Edit2, MoreVertical, Headphones, Speaker, Gift, Sticker, ShieldAlert, Key, RefreshCw, Eye, EyeOff, Lock,
  Feather, MessageSquare, ChevronDown, ChevronRight, BrainCircuit, Terminal, Beer, Trash, AlertTriangle, Github, ScrollText, CheckCircle, UserPlus, Ghost,
  BookOpen, FileText, Download, Upload, Cpu
} from 'lucide-react';
import { Auth } from './components/Auth';
import { VideoStage } from './components/VideoStage';
import { deriveKey, encryptMessage, decryptMessage } from './services/cryptoService';
import { generateContent, DEFAULT_PROMPTS } from './services/aiService';
import { User, Server, Channel, Message, ChannelType, UserRole, AuthResponse, AIConfig, Gif } from './types';

// Connect to backend
const API_URL = '/api';
const socket: Socket = io('/', { path: '/socket.io', autoConnect: false });

// --- Reusable UI Components ---

const CloseButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="absolute -top-4 -right-4 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 shadow-lg border border-slate-600 transition-all z-50">
        <X className="w-5 h-5" />
    </button>
);

const ChangePasswordModal = ({ isOpen, onUpdate }: any) => {
    const [password, setPassword] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] backdrop-blur-md">
            <div className="bg-slate-900 border border-red-500 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
                <div className="flex flex-col items-center mb-4 text-center">
                    <ShieldAlert className="w-12 h-12 text-red-500 mb-2" />
                    <h2 className="text-xl font-bold text-white">Security Alert</h2>
                    <p className="text-slate-400 text-sm mt-2">
                        You are using the default Admin credentials. You must change your password immediately to secure the tavern.
                    </p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">New Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1" autoFocus />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={() => onUpdate(password)} disabled={!password} className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold disabled:opacity-50">Update Password</button>
                </div>
            </div>
        </div>
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Yes, I am sure", isDangerous = false }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className={`bg-slate-900 border ${isDangerous ? 'border-red-900/50' : 'border-slate-700'} rounded-xl w-full max-w-sm p-6 shadow-2xl relative`}>
                <h3 className={`text-xl font-bold mb-2 flex items-center gap-2 ${isDangerous ? 'text-red-500' : 'text-white'}`}>
                    <AlertTriangle className="w-5 h-5"/> {title}
                </h3>
                <p className="text-slate-400 text-sm mb-6">{message}</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-2 text-white rounded font-bold ${isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-Components ---

const ScrollShopView = ({ messages, users, currentUser, isAdmin, onUpload, onDelete }: { 
    messages: Message[], users: User[], currentUser: User | null, isAdmin: boolean, onUpload: (file: File) => void, onDelete: (id: string) => void 
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const validTypes = "image/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx";

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2"><BookOpen className="w-6 h-6" /> Scroll Shop</h2>
                    <p className="text-slate-400 text-sm">Repository of knowledge. Images, Tomes (PDF), and Parchments (Docs) only.</p>
                </div>
                <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Deposit Scroll
                </button>
                <input type="file" ref={fileRef} accept={validTypes} className="hidden" onChange={e => { if(e.target.files?.[0]) onUpload(e.target.files[0]); }} />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar p-2">
                {messages.filter(m => !m.isDeleted && (m.type === 'file' || m.type === 'image')).map(msg => (
                    <div key={msg.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col relative group hover:border-amber-500/50 transition-colors">
                        <div className="h-32 bg-slate-900 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                            {msg.type === 'image' ? (
                                <img src={msg.content} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <FileText className="w-12 h-12 text-slate-500" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-sm text-slate-200 truncate" title={msg.fileName}>{msg.fileName || 'Unknown Scroll'}</h4>
                            <p className="text-xs text-slate-500 flex justify-between mt-1">
                                <span>{users.find(u => u.id === msg.userId)?.name || 'Unknown'}</span>
                                <span>{msg.fileSize}</span>
                            </p>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <a href={msg.content} download target="_blank" className="flex-1 py-1.5 bg-slate-700 hover:bg-indigo-600 text-center rounded text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
                                <Download className="w-3 h-3" /> Retrieve
                            </a>
                            {(isAdmin || msg.userId === currentUser?.id) && (
                                <button onClick={() => onDelete(msg.id)} className="p-1.5 bg-slate-700 hover:bg-red-600 rounded text-white transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DecryptedMessage: React.FC<{ 
    msg: Message; 
    cryptoKey: CryptoKey | null; 
    currentUserId?: string; 
    users: User[]; 
    onDelete: (id: string) => void;
}> = ({ msg, cryptoKey, currentUserId, users, onDelete }) => {
  const [content, setContent] = useState(msg.content);
  const [isDecrypted, setIsDecrypted] = useState(false);

  useEffect(() => {
    if (msg.isDeleted) { setContent(''); return; }
    if (msg.type === 'text' && cryptoKey && !msg.isLocal) {
      decryptMessage(msg.content, cryptoKey).then(res => { setContent(res); setIsDecrypted(true); });
    } else { setContent(msg.content); }
  }, [msg, cryptoKey]);

  if (msg.isLocal) return <div className="flex justify-center my-2"><div className="bg-slate-800/80 px-4 py-1 rounded-full text-xs text-slate-400 italic">{content}</div></div>;

  return (
    <div className={`flex gap-4 group p-2 rounded hover:bg-slate-800/50 relative ${msg.userId === currentUserId ? 'bg-slate-800/20' : ''}`}>
      {!msg.isDeleted && msg.userId === currentUserId && <button onClick={() => onDelete(msg.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
        {msg.userId === 'system' ? <Sparkles className="w-5 h-5 text-purple-400" /> : <img src={users.find(u => u.id === msg.userId)?.avatar || ''} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
              <span className={`font-bold text-sm ${msg.userId === currentUserId ? 'text-amber-500' : 'text-slate-300'}`}>{msg.userId === 'system' ? 'AI Oracle' : (users.find(u => u.id === msg.userId)?.name || 'Unknown')}</span>
              <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          {msg.isDeleted ? <div className="text-slate-600 text-xs italic mt-1 flex items-center gap-1"><Trash className="w-3 h-3" /> Message deleted.</div> : (
              <div className={`text-slate-200 mt-1 leading-relaxed whitespace-pre-wrap break-words ${isDecrypted ? '' : 'font-mono text-xs text-slate-500'}`}>
                {msg.type === 'image' ? <img src={msg.content} className="max-w-xs rounded-lg border border-slate-700 mt-2" /> : 
                 msg.type === 'file' ? <a href={msg.content} target="_blank" className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700 mt-2 hover:bg-slate-700 w-fit"><FileText className="w-4 h-4"/> {msg.fileName} <Download className="w-3 h-3 ml-2"/></a> :
                 content.startsWith('[GIF:') ? <img src={content.slice(5,-1)} className="max-w-xs rounded-lg mt-2" /> : content}
             </div>
          )}
      </div>
    </div>
  );
};

// --- Modals ---

const CreateServerModal = ({ isOpen, onClose, onCreate }: any) => {
    const [name, setName] = useState('');
    const [img, setImg] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
                <CloseButton onClick={onClose} />
                <h2 className="text-xl font-bold text-white mb-4">Create Tavern</h2>
                <div className="space-y-4">
                    <input value={img} onChange={e => setImg(e.target.value)} placeholder="Image URL" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Tavern Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1" autoFocus />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={() => { onCreate(name, img); onClose(); setName(''); setImg(''); }} disabled={!name} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold disabled:opacity-50">Create</button>
                </div>
            </div>
        </div>
    );
};

const CreateChannelModal = ({ isOpen, onClose, onCreate }: any) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<ChannelType>(ChannelType.TEXT);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
                <CloseButton onClick={onClose} />
                <h2 className="text-xl font-bold text-white mb-4">Create Channel</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Channel Type</label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            <button onClick={() => setType(ChannelType.TEXT)} className={`p-2 rounded border flex flex-col items-center gap-1 ${type === ChannelType.TEXT ? 'bg-slate-800 border-indigo-500 text-white' : 'border-slate-800 text-slate-500'}`}><Feather className="w-4 h-4" /><span className="text-[10px]">Board</span></button>
                            <button onClick={() => setType(ChannelType.VOICE)} className={`p-2 rounded border flex flex-col items-center gap-1 ${type === ChannelType.VOICE ? 'bg-slate-800 border-indigo-500 text-white' : 'border-slate-800 text-slate-500'}`}><Beer className="w-4 h-4" /><span className="text-[10px]">Tavern</span></button>
                            <button onClick={() => setType(ChannelType.SCROLL)} className={`p-2 rounded border flex flex-col items-center gap-1 ${type === ChannelType.SCROLL ? 'bg-slate-800 border-indigo-500 text-white' : 'border-slate-800 text-slate-500'}`}><BookOpen className="w-4 h-4" /><span className="text-[10px]">Shop</span></button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Name</label>
                        <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mt-1" placeholder="new-channel" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={() => { onCreate(name, type); onClose(); setName(''); }} disabled={!name} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold disabled:opacity-50">Create</button>
                </div>
            </div>
        </div>
    );
};

// Simplified Server Settings Modal
const ServerSettingsModal = ({ server, users, isOpen, onClose, onUpdate, onInvite, onKick, currentUser }: any) => {
    if(!isOpen) return null;
    const memberUsers = users.filter((u: User) => server.memberIds?.includes(u.id));
    const nonMemberUsers = users.filter((u: User) => !server.memberIds?.includes(u.id));
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl p-6 relative">
                 <CloseButton onClick={onClose} />
                 <h2 className="text-2xl font-bold mb-4">Tavern Management</h2>
                 <div className="flex gap-4 mb-4">
                     <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase">Name</label><input className="w-full bg-slate-950 border border-slate-800 rounded p-2" value={server.name} onChange={e => onUpdate({...server, name: e.target.value})} /></div>
                 </div>
                 <h3 className="font-bold mb-2">Members</h3>
                 <div className="h-40 overflow-y-auto bg-slate-950 rounded border border-slate-800 p-2 mb-4">
                     {memberUsers.map((u: User) => (
                         <div key={u.id} className="flex justify-between items-center p-2 hover:bg-slate-800 rounded">
                             <span>{u.name}</span>
                             {u.id !== server.creatorId && <button onClick={() => onKick(u.id)} className="text-red-500 text-xs">Kick</button>}
                         </div>
                     ))}
                 </div>
                 <h3 className="font-bold mb-2">Invite</h3>
                 <div className="h-32 overflow-y-auto bg-slate-950 rounded border border-slate-800 p-2">
                     {nonMemberUsers.map((u: User) => (
                         <div key={u.id} className="flex justify-between items-center p-2 hover:bg-slate-800 rounded">
                             <span>{u.name}</span>
                             <button onClick={() => onInvite(u.id)} className="text-green-500 text-xs">Invite</button>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
    );
}

const SettingsModal = ({ user, users, isOpen, onClose, onUpdateUser, onUpdateOtherUser, onDeleteUser, onLogout, aiConfig, setAiConfig, uploadLimit, setUploadLimit }: any) => {
    const [tab, setTab] = useState('account');
    const [name, setName] = useState(user.name);
    const [avatar, setAvatar] = useState(user.avatar);
    const [localAiConfig, setLocalAiConfig] = useState<AIConfig>(aiConfig);
    const [localUploadLimit, setLocalUploadLimit] = useState(uploadLimit || 10);
    const isAdmin = user.role === UserRole.ADMIN;

    const saveSettings = async () => {
        const token = localStorage.getItem('tavern_token');
        if(isAdmin) {
             await fetch('/api/admin/settings', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadLimitMB: localUploadLimit }) });
             await fetch('/api/ai/config', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(localAiConfig) });
             setUploadLimit(localUploadLimit);
             setAiConfig(localAiConfig);
        }
        onUpdateUser({ name, avatar });
        onClose();
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl h-[600px] shadow-2xl flex relative">
                <CloseButton onClick={onClose} />
                <div className="w-56 bg-slate-950 border-r border-slate-800 p-4 flex flex-col gap-1 rounded-l-xl">
                    <button onClick={() => setTab('account')} className={`text-left px-3 py-2 rounded text-sm ${tab === 'account' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Account</button>
                    <button onClick={() => setTab('audio')} className={`text-left px-3 py-2 rounded text-sm ${tab === 'audio' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Audio</button>
                    {isAdmin && <button onClick={() => setTab('admin')} className={`text-left px-3 py-2 rounded text-sm ${tab === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Admin Controls</button>}
                </div>
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    {tab === 'account' && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold">Profile</h2>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2" placeholder="Display Name" />
                            <input value={avatar} onChange={e => setAvatar(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2" placeholder="Avatar URL" />
                            <button onClick={onLogout} className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 rounded text-sm flex items-center gap-2"><LogOut className="w-4 h-4" /> Log Out</button>
                        </div>
                    )}
                    {tab === 'audio' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">Audio Settings</h2>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500">Output Volume</label>
                                <input type="range" min="0" max="1" step="0.1" onChange={(e) => {
                                    const els = document.querySelectorAll('video, audio');
                                    els.forEach((el: any) => el.volume = e.target.value);
                                }} className="w-full mt-2 accent-indigo-500" />
                            </div>
                        </div>
                    )}
                    {tab === 'admin' && isAdmin && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">Admin Controls</h2>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500">Max Upload Size (MB)</label>
                                <input type="number" value={localUploadLimit} onChange={e => setLocalUploadLimit(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 mt-1" />
                            </div>
                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="font-bold mb-2">AI Configuration</h3>
                                <div className="space-y-2">
                                    <input value={localAiConfig.apiKey} onChange={e => setLocalAiConfig({...localAiConfig, apiKey: e.target.value})} type="password" placeholder="API Key" className="w-full bg-slate-950 border border-slate-700 rounded p-2" />
                                    <input type="number" value={localAiConfig.tokenLimit || 200} onChange={e => setLocalAiConfig({...localAiConfig, tokenLimit: parseInt(e.target.value)})} placeholder="Max Tokens" className="w-full bg-slate-950 border border-slate-700 rounded p-2" />
                                    <textarea value={localAiConfig.systemInstruction || ''} onChange={e => setLocalAiConfig({...localAiConfig, systemInstruction: e.target.value})} placeholder="System Instruction (e.g., You are a dark fantasy DM...)" className="w-full bg-slate-950 border border-slate-700 rounded p-2 h-20" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="mt-8 pt-4 border-t border-slate-800">
                         <button onClick={saveSettings} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold">Save All Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- App ---

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('tavern_token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Data
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [gifs, setGifs] = useState<Gif[]>([]);
  
  // UI State
  const [activeServerId, setActiveServerId] = useState<string>('home');
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'chat' | 'video'>('chat');
  const [videoLayout, setVideoLayout] = useState<'table' | 'grid'>('table');
  const [showUserList, setShowUserList] = useState(true);
  
  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  
  // AI
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const aiMenuTimeout = useRef<any>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<{role: 'user'|'ai', content: string}[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: 'gemini', apiKey: '', tokenLimit: 200, systemInstruction: '', prompts: DEFAULT_PROMPTS, customButtons: [] });
  const [uploadLimit, setUploadLimit] = useState(10);

  // Confirms & Tools
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Effects & Fetching ---
  useEffect(() => {
    if (token) {
      // Connect socket
      socket.auth = { token };
      if (!socket.connected) socket.connect();

      // Setup Listeners
      const onConnect = () => {
          if (activeChannelId) socket.emit('join_channel', activeChannelId);
      };

      socket.on('connect', onConnect);
      socket.on('message', (msg: Message) => setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]));
      socket.on('message_deleted', ({ id }) => setMessages(prev => prev.map(m => m.id === id ? { ...m, isDeleted: true, content: '' } : m)));
      socket.on('user_update', (data) => {
          if (data.id === user?.id) setUser(prev => prev ? ({ ...prev, ...data }) : null);
          setUsers(prev => {
              const exists = prev.find(u => u.id === data.id);
              if (exists) return prev.map(u => u.id === data.id ? { ...u, ...data } : u);
              return [...prev, data as User];
          });
      });
      socket.on('user_deleted', ({ id }) => {
          setUsers(prev => prev.filter(u => u.id !== id));
          if (user && user.id === id) handleLogout();
      });
      socket.on('gif_added', (gif: Gif) => setGifs(prev => [...prev, gif]));
      socket.on('gif_deleted', ({ id }) => setGifs(prev => prev.filter(g => g.id !== id)));
      socket.on('added_to_server', () => fetchData());
      socket.on('removed_from_server', ({ serverId }) => {
          setServers(prev => prev.filter(s => s.id !== serverId));
          if (activeServerId === serverId) setActiveServerId('home');
      });

      // Initial fetch
      fetchData();

      return () => { 
          socket.off('connect', onConnect);
          socket.off('message'); 
          socket.off('user_update'); 
          socket.off('user_deleted'); 
          socket.off('message_deleted'); 
          socket.off('gif_added'); 
          socket.off('gif_deleted'); 
          socket.off('added_to_server'); 
          socket.off('removed_from_server'); 
          socket.disconnect();
      };
    }
  }, [token]);

  // Handle Channel Join Logic
  useEffect(() => {
    if (activeChannelId && token) {
      updateSelf({ currentChannelId: activeChannelId });
      const ch = channels.find(c => c.id === activeChannelId);
      if (ch?.type !== ChannelType.VOICE) setViewMode('chat');
      
      // Emit join (works if connected, if not, 'connect' listener will handle it)
      if (socket.connected) {
          socket.emit('join_channel', activeChannelId);
      }
      
      setMessages([]); // Clear previous messages while loading
      fetch(`${API_URL}/messages/${activeChannelId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json()).then(setMessages).catch(() => setMessages([]));
    }
  }, [activeChannelId, token, channels]); // Added channels dependency to ensure we find the channel info

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, viewMode]);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/init`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
          console.warn("Invalid token or user not found. Logging out.");
          handleLogout();
          return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser({ ...data.user, name: data.user.display_name || data.user.username });
        setServers(data.servers);
        setChannels(data.channels);
        setUsers(data.users.map((u: any) => ({ ...u, name: u.name || u.username, isMuted: false, isVideoOn: false, isScreenSharing: false, isDM: u.isDM || u.role === UserRole.ADMIN }))); 
        setGifs(data.gifs || []);
        if (data.globalKey) setCryptoKey(await deriveKey(data.globalKey));
        if (data.uploadLimitMB) setUploadLimit(data.uploadLimitMB);
        
        if (data.user.role === UserRole.ADMIN) {
             const aiRes = await fetch(`${API_URL}/ai/config`, { headers: { Authorization: `Bearer ${token}` } });
             const aiData = await aiRes.json();
             if(aiData) setAiConfig(aiData);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleLogin = (data: AuthResponse) => { setToken(data.token); localStorage.setItem('tavern_token', data.token); setUser(data.user); };
  const handleLogout = () => { localStorage.removeItem('tavern_token'); setToken(null); setUser(null); setCryptoKey(null); };
  
  const updateSelf = async (update: Partial<User>) => {
      if (!user) return;
      const updatedUser = { ...user, ...update };
      setUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
      if (update.name || update.avatar) fetch(`${API_URL}/users/${user.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(update) });
      socket.emit('user_update', updatedUser);
  };

  const handleUpdateOtherUser = async (id: string, update: Partial<User>) => {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...update } : u));
      fetch(`${API_URL}/users/${id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(update) });
  };

  const handleUpdatePassword = async (password: string) => {
      if (!user) return;
      fetch(`${API_URL}/users/${user.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setUser({ ...user, needsPasswordChange: false });
  };

  const handleDeleteUser = async (id: string) => fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

  const handleStartDM = async (targetUser: User) => {
      if (!user) return;
      const existing = channels.find(c => c.type === ChannelType.DM && c.participantIds?.includes(targetUser.id) && c.participantIds?.includes(user.id));
      if (existing) { setActiveChannelId(existing.id); } else {
          const res = await fetch(`${API_URL}/channels`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `DM: ${targetUser.name}`, type: ChannelType.DM, serverId: 'home', participantIds: [user.id, targetUser.id] }) });
          const newChannel = await res.json();
          setChannels(prev => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
      }
      setActiveServerId('home');
      setViewMode('chat');
  };

  const handleDeleteMessage = (id: string) => fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

  const handleAddGif = (url: string) => {
      fetch(`${API_URL}/gifs`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  };

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : inputText;
    if (!textToSend.trim() || !activeChannelId) return;
    if (textToSend.match(/^https?:\/\/.*\.(gif|webp)$/i)) { handleAddGif(textToSend); handleSendMessage(`[GIF:${textToSend}]`); if(textOverride === undefined) setInputText(''); return; }
    let contentToSend = textToSend;
    if (cryptoKey) contentToSend = await encryptMessage(textToSend, cryptoKey);
    if(textOverride === undefined) setInputText(''); 
    setShowEmoji(false); setShowGif(false); setShowDice(false);
    fetch(`${API_URL}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: activeChannelId, content: contentToSend, type: 'text' }) });
  };

  const handleFileUpload = async (file: File) => {
      if (!activeChannelId) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('channelId', activeChannelId);
      
      try {
          const res = await fetch(`${API_URL}/upload`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData
          });
          const data = await res.json();
          if(!res.ok) alert(data.error);
      } catch (e) { alert("Upload failed"); }
  };

  const handleAiChat = async () => {
      if(!aiChatInput) return;
      const userMsg = { role: 'user', content: aiChatInput } as const;
      setAiChatHistory(prev => [...prev, userMsg]);
      setAiChatInput('');
      
      const token = localStorage.getItem('tavern_token');
      try {
          const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiChatInput, type: 'chat' }) });
          const data = await res.json();
          setAiChatHistory(prev => [...prev, { role: 'ai', content: data.text }]);
      } catch(e) { setAiChatHistory(prev => [...prev, { role: 'ai', content: "I cannot answer." }]); }
  };

  const handleCreateServer = async (name: string, img: string) => {
      const res = await fetch(`${API_URL}/servers`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, imgUrl: img }) });
      if (res.ok) {
          const newServer = await res.json();
          setServers(prev => [...prev, newServer]);
          if (newServer.defaultChannel) { setChannels(prev => [...prev, newServer.defaultChannel]); setActiveChannelId(newServer.defaultChannel.id); }
          setActiveServerId(newServer.id);
      }
  };

  const handleCreateChannel = async (name: string, type: ChannelType) => {
      const res = await fetch(`${API_URL}/channels`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, serverId: activeServerId }) });
      if (res.ok) {
          const newChannel = await res.json();
          setChannels(prev => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
          if (type === ChannelType.VOICE) setViewMode('video');
      }
  };

  const handleInviteUser = async (userId: string) => {
      if (activeServerId === 'home') return;
      const res = await fetch(`${API_URL}/servers/${activeServerId}/invite`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      });
      if (res.ok) {
          const data = await res.json();
          if (data.memberIds) {
              setServers(prev => prev.map(s => s.id === activeServerId ? { ...s, memberIds: data.memberIds } : s));
          }
      }
  };

  const handleKickUser = async (userId: string) => {
      if (activeServerId === 'home') return;
      const res = await fetch(`${API_URL}/servers/${activeServerId}/members/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
          const data = await res.json();
           if (data.memberIds) {
              setServers(prev => prev.map(s => s.id === activeServerId ? { ...s, memberIds: data.memberIds } : s));
          }
      }
  };

  // Logic to manage AI menu hover
  const onAiMouseEnter = () => { if(aiMenuTimeout.current) clearTimeout(aiMenuTimeout.current); setAiMenuOpen(true); };
  const onAiMouseLeave = () => { aiMenuTimeout.current = setTimeout(() => setAiMenuOpen(false), 750); };

  if (!token) return <Auth onLogin={handleLogin} />;
  
  const currentServer = servers.find(s => s.id === activeServerId);
  const currentChannel = channels.find(c => c.id === activeChannelId);
  const usersInList = activeServerId === 'home' ? users : users.filter(u => currentServer?.memberIds?.includes(u.id));
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.POWER_USER || (currentServer && currentServer.creatorId === user?.id);

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden text-slate-200 font-sans relative">
      {user && <ChangePasswordModal isOpen={user.needsPasswordChange} onUpdate={handleUpdatePassword} />}
      {user && <SettingsModal 
        user={user} users={users} isOpen={showSettings} onClose={() => setShowSettings(false)} 
        onUpdateUser={updateSelf} onUpdateOtherUser={handleUpdateOtherUser} onDeleteUser={handleDeleteUser} onLogout={handleLogout} 
        aiConfig={aiConfig} setAiConfig={setAiConfig} uploadLimit={uploadLimit} setUploadLimit={setUploadLimit}
      />}
      {currentServer && <ServerSettingsModal server={currentServer} users={users} currentUser={user} isOpen={showServerSettings} onClose={() => setShowServerSettings(false)} onUpdate={server => setServers(servers.map(s => s.id === server.id ? server : s))} onInvite={handleInviteUser} onKick={handleKickUser} />}
      <CreateServerModal isOpen={showCreateServer} onClose={() => setShowCreateServer(false)} onCreate={handleCreateServer} />
      <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} onCreate={handleCreateChannel} />

      {/* AI Chat Modal */}
      {showAiChat && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
              <div className="bg-slate-900 w-full max-w-lg h-[600px] rounded-xl border border-purple-500/50 flex flex-col shadow-2xl">
                  <div className="p-4 border-b border-purple-900/50 flex justify-between items-center">
                      <h3 className="text-purple-400 font-bold flex items-center gap-2"><BrainCircuit className="w-5 h-5"/> AI Dungeon Master</h3>
                      <button onClick={() => setShowAiChat(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {aiChatHistory.map((m, i) => (
                          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-slate-700 text-white' : 'bg-purple-900/30 text-purple-200 border border-purple-800'}`}>
                                  {m.content}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t border-purple-900/50 flex gap-2">
                      <input value={aiChatInput} onChange={e => setAiChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiChat()} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm" placeholder="Ask the DM..." />
                      <button onClick={handleAiChat} className="p-2 bg-purple-600 rounded text-white"><Send className="w-4 h-4" /></button>
                  </div>
              </div>
          </div>
      )}

      {/* 1. Server Sidebar */}
      <div className="w-20 bg-slate-950 flex flex-col items-center py-4 gap-3 border-r border-slate-800 z-20">
        <button onClick={() => { setActiveServerId('home'); setActiveChannelId(''); }} className={`w-12 h-12 rounded-[20px] flex items-center justify-center transition-all ${activeServerId === 'home' ? 'bg-indigo-600 rounded-[16px]' : 'bg-slate-800 hover:bg-indigo-600 hover:rounded-[16px]'}`}><Shield className="w-6 h-6 text-amber-400" /></button>
        <div className="w-8 h-0.5 bg-slate-800 rounded-full" />
        {servers.map(s => (
            <button key={s.id} onClick={() => { setActiveServerId(s.id); setActiveChannelId(''); }} className={`w-12 h-12 rounded-[24px] flex items-center justify-center transition-all overflow-hidden ${activeServerId === s.id ? 'rounded-[16px] outline outline-2 outline-amber-500' : 'hover:rounded-[16px]'}`}>
                {s.imgUrl ? <img src={s.imgUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-bold">{s.name.substring(0, 2).toUpperCase()}</div>}
            </button>
        ))}
        <button onClick={() => setShowCreateServer(true)} className="w-12 h-12 rounded-[24px] bg-slate-800 flex items-center justify-center text-emerald-500 hover:bg-emerald-900/20 mt-auto mb-2"><Plus className="w-6 h-6" /></button>
      </div>

      {/* 2. Channel Sidebar */}
      <div className="w-64 bg-slate-900 flex flex-col border-r border-slate-800">
        <div className="h-14 shadow-sm border-b border-slate-800 flex items-center justify-between px-4 font-bold text-slate-200 truncate">
            {activeServerId === 'home' ? 'Home' : currentServer?.name}
            {activeServerId !== 'home' && canManage && <button onClick={() => setShowServerSettings(true)} className="text-slate-500 hover:text-white"><Settings className="w-4 h-4" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
            {activeServerId !== 'home' ? (
                <>
                {/* Scroll Shops */}
                <div>
                    <div className="flex items-center justify-between px-2 mb-1 text-xs font-bold text-slate-500 uppercase"><div className="flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Scroll Shops</div>{canManage && <button onClick={() => setShowCreateChannel(true)}><Plus className="w-3 h-3" /></button>}</div>
                    {channels.filter(c => c.serverId === activeServerId && c.type === ChannelType.SCROLL).map(c => (
                        <button key={c.id} onClick={() => { setActiveChannelId(c.id); setViewMode('chat'); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeChannelId === c.id ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:bg-slate-800/50'}`}><BookOpen className="w-4 h-4" /><span className="truncate">{c.name}</span></button>
                    ))}
                </div>
                {/* Text Channels */}
                <div>
                     <div className="flex items-center justify-between px-2 mb-1 text-xs font-bold text-slate-500 uppercase"><div className="flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Black Boards</div>{canManage && <button onClick={() => setShowCreateChannel(true)}><Plus className="w-3 h-3" /></button>}</div>
                    {channels.filter(c => c.serverId === activeServerId && c.type === ChannelType.TEXT).map(c => (
                        <button key={c.id} onClick={() => { setActiveChannelId(c.id); setViewMode('chat'); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeChannelId === c.id ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:bg-slate-800/50'}`}><Feather className="w-4 h-4" /><span className="truncate">{c.name}</span></button>
                    ))}
                </div>
                {/* Voice Channels */}
                <div>
                     <div className="flex items-center justify-between px-2 mb-1 text-xs font-bold text-slate-500 uppercase"><div className="flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Tavernlinks</div>{canManage && <button onClick={() => setShowCreateChannel(true)}><Plus className="w-3 h-3" /></button>}</div>
                    {channels.filter(c => c.serverId === activeServerId && c.type === ChannelType.VOICE).map(c => (
                        <button key={c.id} onClick={() => { setActiveChannelId(c.id); setViewMode('chat'); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeChannelId === c.id ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:bg-slate-800/50'}`}><Beer className="w-4 h-4" /><span className="truncate">{c.name}</span></button>
                    ))}
                </div>
                </>
            ) : (
                // DM List
                users.filter(u => u.id !== user?.id).map(u => (
                    <button key={u.id} onClick={() => handleStartDM(u)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-slate-400 hover:bg-slate-800/50"><div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden"><img src={u.avatar} className="w-full h-full object-cover"/></div><span className="truncate">{u.name}</span></button>
                ))
            )}
        </div>
        <div className="bg-[#111620] p-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden"><img src={user?.avatar} className="w-full h-full object-cover"/></div><div className="text-xs font-bold">{user?.name}</div></div>
            <button onClick={() => setShowSettings(true)}><Settings className="w-4 h-4 text-slate-400 hover:text-white" /></button>
        </div>
      </div>

      {/* 3. Main Stage */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900 z-10">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">{currentChannel?.name ? <><Hash className="w-4 h-4"/> {currentChannel.name}</> : 'Welcome'}</h3>
            <div className="flex items-center gap-4">
                 {/* AI Tool Button */}
                 {(user?.role === UserRole.ADMIN || user?.role === UserRole.POWER_USER) && (
                    <div className="relative" onMouseEnter={onAiMouseEnter} onMouseLeave={onAiMouseLeave}>
                        <button className="text-purple-400 hover:text-purple-300 p-2 rounded-lg hover:bg-purple-900/20"><Wand2 className="w-5 h-5" /></button>
                        {aiMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-purple-900/50 rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-xs font-bold text-slate-500 px-2 py-1 uppercase">AI Dungeon Master</div>
                                <button onClick={() => setShowAiChat(true)} className="w-full text-left px-2 py-2 hover:bg-slate-800 rounded text-sm text-purple-300 flex items-center gap-2"><BrainCircuit className="w-4 h-4"/> Chat with DM</button>
                                <button onClick={() => handleSendMessage("Generate NPC")} className="w-full text-left px-2 py-2 hover:bg-slate-800 rounded text-sm text-purple-300">Generate NPC</button>
                                <button onClick={() => handleSendMessage("Generate Plot")} className="w-full text-left px-2 py-2 hover:bg-slate-800 rounded text-sm text-purple-300">Generate Plot Hook</button>
                            </div>
                        )}
                    </div>
                )}
                <button onClick={() => setShowUserList(!showUserList)} className="text-slate-400 hover:text-white"><Users className="w-5 h-5" /></button>
            </div>
        </div>

        {/* View Logic */}
        {currentChannel?.type === ChannelType.SCROLL ? (
            <ScrollShopView 
                messages={messages} 
                users={users} 
                currentUser={user} 
                isAdmin={user?.role === UserRole.ADMIN} 
                onUpload={handleFileUpload}
                onDelete={handleDeleteMessage}
            />
        ) : viewMode === 'video' ? (
             <VideoStage users={usersInList.filter(u => u.currentChannelId === activeChannelId)} currentUser={user} layout={videoLayout} onToggleMic={() => updateSelf({ isMuted: !user?.isMuted })} onToggleCam={() => updateSelf({ isVideoOn: !user?.isVideoOn })} />
        ) : (
            <>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar" ref={scrollRef}>
                    {!activeChannelId && <div className="flex flex-col items-center justify-center h-full text-slate-600"><Shield className="w-16 h-16 mb-4 opacity-20" /><p>Select a channel to begin.</p></div>}
                    {currentChannel?.type === ChannelType.VOICE && <div className="flex justify-center p-4"><button onClick={() => setViewMode('video')} className="px-6 py-2 bg-emerald-600 rounded text-white font-bold flex gap-2"><Video className="w-5 h-5"/> Join Table</button></div>}
                    {messages.map((msg) => <DecryptedMessage key={msg.id} msg={msg} cryptoKey={cryptoKey} currentUserId={user?.id} users={users} onDelete={handleDeleteMessage} />)}
                </div>
                <div className="p-4 bg-slate-900">
                    <div className="bg-slate-800/50 rounded-xl p-2 border border-slate-700 flex items-end gap-2 shadow-inner">
                        <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 bg-transparent outline-none p-2 text-sm" placeholder={currentChannel ? `Message #${currentChannel.name}` : "Select a channel..."} disabled={!activeChannelId} />
                        <button onClick={() => handleSendMessage()} disabled={!activeChannelId} className="p-2 bg-amber-600 rounded text-white disabled:opacity-50"><Send className="w-4 h-4" /></button>
                    </div>
                </div>
            </>
        )}
      </div>

      {showUserList && <div className="w-60 bg-slate-950 border-l border-slate-800 p-4 hidden lg:block overflow-y-auto"><div className="text-xs font-bold text-slate-500 uppercase mb-4">Adventurers — {usersInList.length}</div>{usersInList.map(u => <div key={u.id} className="flex items-center gap-2 py-1"><div className="w-6 h-6 rounded-full bg-slate-700"><img src={u.avatar} className="w-full h-full object-cover"/></div><span className="text-sm">{u.name}</span></div>)}</div>}
    </div>
  );
}

export default App;
