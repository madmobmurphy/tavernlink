export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  POWER_USER = 'power_user'
}

export enum ChannelType {
  TEXT = 'text',
  VOICE = 'voice',
  DM = 'dm',
  SCROLL = 'scroll' // Scroll Shop for files
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: UserRole;
  isDM: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isScreenSharing?: boolean;
  currentChannelId?: string;
  needsPasswordChange?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string; // URL for files
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'system';
  fileName?: string; // Original filename for uploads
  fileSize?: string;
  isLocal?: boolean;
  isDeleted?: boolean;
}

export interface Gif {
    id: string;
    url: string;
    addedBy: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  participantIds?: string[];
}

export interface Session {
  id: string;
  title: string;
  date: string;
  time: string;
}

export interface Server {
  id: string;
  name: string;
  imgUrl?: string;
  creatorId: string;
  memberIds: string[];
  calendarEnabled: boolean;
  icalUrl?: string;
  sessions: Session[];
}

export interface AuthResponse {
  token: string;
  user: User;
  recoveryKey?: string;
  error?: string;
}

export interface AICustomButton {
    label: string;
    prompt: string;
}

export interface AIConfig {
  provider: 'gemini' | 'openai' | 'local';
  apiKey: string;
  baseUrl?: string;
  modelName?: string;
  tokenLimit: number;
  systemInstruction: string;
  prompts: {
    npc: string;
    plot: string;
  };
  customButtons: AICustomButton[];
}