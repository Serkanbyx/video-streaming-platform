import { useCallback, useState } from 'react';

interface ProgressState {
  progress: number;
  isUploading: boolean;
  error: unknown;
}

interface ProgressEventLike {
  loaded: number;
  total?: number;
}

interface UploaderArgs {
  onUploadProgress: (event: ProgressEventLike) => void;
}

type Uploader<T> = (args: UploaderArgs) => Promise<T>;

const INITIAL_STATE: ProgressState = {
  progress: 0,
  isUploading: false,
  error: null,
};

/**
 * Drives the upload page's progress bar lifecycle. `start(uploaderFn)` runs an
 * async uploader that receives an `onUploadProgress` axios callback; the hook
 * tracks completion percent, in-flight state, and any error surface.
 */
export const useUploadProgress = () => {
  const [state, setState] = useState<ProgressState>(INITIAL_STATE);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const start = useCallback(async <T>(uploader: Uploader<T>): Promise<T> => {
    setState({ progress: 0, isUploading: true, error: null });

    const onUploadProgress = (event: ProgressEventLike): void => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setState((prev) => ({ ...prev, progress: percent }));
    };

    try {
      const result = await uploader({ onUploadProgress });
      setState({ progress: 100, isUploading: false, error: null });
      return result;
    } catch (err) {
      setState({ progress: 0, isUploading: false, error: err });
      throw err;
    }
  }, []);

  return { ...state, start, reset };
};

export default useUploadProgress;
