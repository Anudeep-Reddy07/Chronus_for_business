export interface TaskItem {
  task_id: string;
  state: number; // 0: created, 1: processing, 2: complete, 3: failed
  progress: number;
  title?: string;
  topic?: string;
  videos?: string[];
  combined_videos?: string[];
  error?: string;
  params?: Record<string, any>;
  created_at?: number;
}

export interface VideoParamsPayload {
  video_subject: string;
  video_script?: string;
  video_terms?: string | string[];
  video_aspect?: string; // '9:16', '16:9', '1:1'
  video_concat_mode?: string; // 'random', 'sequential'
  video_clip_duration?: number;
  video_count?: number;
  video_source?: string; // 'studio', 'pexels', 'pixabay', etc.
  video_language?: string;
  voice_name?: string;
  voice_volume?: number;
  voice_rate?: number;
  bgm_type?: string;
  bgm_file?: string;
  bgm_volume?: number;
  subtitle_enabled?: boolean;
  font_name?: string;
  text_fore_color?: string;
  font_size?: number;
  stroke_color?: string;
  stroke_width?: number;
  studio_project_id?: string;
  studio_stock_source?: string;
  studio_blend_mode?: string;
}

export const apiClient = {
  // Health check
  async ping(): Promise<boolean> {
    try {
      const res = await fetch('/ping');
      return res.ok;
    } catch {
      return false;
    }
  },

  // Get all tasks
  async getTasks(): Promise<TaskItem[]> {
    const res = await fetch('/api/v1/tasks');
    if (!res.ok) throw new Error('Failed to fetch tasks');
    const data = await res.json();
    return data.data?.tasks || [];
  },

  // Get single task status
  async getTask(taskId: string): Promise<TaskItem> {
    const res = await fetch(`/api/v1/tasks/${taskId}`);
    if (!res.ok) throw new Error('Failed to fetch task');
    const data = await res.json();
    return data.data;
  },

  // Delete task / project and its local files
  async deleteTask(taskId: string): Promise<boolean> {
    const res = await fetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete video project');
    }
    return true;
  },

  // Create video generation task
  async createVideo(params: VideoParamsPayload): Promise<{ task_id: string }> {
    const res = await fetch('/api/v1/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to submit generation task');
    }
    const data = await res.json();
    return data.data;
  },

  // Studio Endpoints
  async createStudioOwner(name: string): Promise<string> {
    const res = await fetch(`/api/v1/studio/owners?name=${encodeURIComponent(name)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to create owner');
    const data = await res.json();
    return data.data.owner_id;
  },

  async createStudioProject(ownerId: string, title: string, topic: string = ''): Promise<string> {
    const url = `/api/v1/studio/projects?owner_id=${encodeURIComponent(ownerId)}&title=${encodeURIComponent(title)}&topic=${encodeURIComponent(topic)}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create studio project');
    const data = await res.json();
    return data.data.project_id;
  },

  async uploadStudioMedia(projectId: string, files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await fetch(`/api/v1/studio/media/${projectId}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload media files');
    const data = await res.json();
    return data.data.ingested || [];
  },

  async publishRender(renderId: string, platforms: string[] = ['youtube']): Promise<any> {
    const res = await fetch(`/api/v1/studio/publish?render_id=${encodeURIComponent(renderId)}&platforms=${encodeURIComponent(platforms.join(','))}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to publish render');
    const data = await res.json();
    return data.data;
  },

  // Custom Cloned Voices
  async getCustomVoices(): Promise<CustomVoice[]> {
    const res = await fetch('/api/v1/studio/voices');
    if (!res.ok) throw new Error('Failed to fetch custom voices');
    const data = await res.json();
    return data.data?.voices || [];
  },

  async createClonedVoice(name: string, files: File[], provider: string = 'fish_audio'): Promise<any> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await fetch(`/api/v1/studio/voices?name=${encodeURIComponent(name)}&provider=${encodeURIComponent(provider)}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Voice cloning failed');
    }
    const data = await res.json();
    return data.data;
  },

  async deleteCustomVoice(voiceId: string): Promise<boolean> {
    const res = await fetch(`/api/v1/studio/voices/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete custom voice');
    return true;
  },

  // Engine Configuration
  async getEngineConfig(): Promise<any> {
    const res = await fetch('/api/v1/studio/config');
    if (!res.ok) throw new Error('Failed to fetch engine config');
    const data = await res.json();
    return data.data;
  },

  async updateEngineConfig(config: any): Promise<any> {
    const res = await fetch('/api/v1/studio/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update engine config');
    }
    const data = await res.json();
    return data;
  },
};

export interface CustomVoice {
  id: string;
  name: string;
  provider: string;
  voice_id: string;
  created_at: number;
}

