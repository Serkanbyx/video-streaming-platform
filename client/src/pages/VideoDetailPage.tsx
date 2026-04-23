import { useParams } from 'react-router-dom';

import { PagePlaceholder } from './_PagePlaceholder.js';
import { NotFoundPage } from './NotFoundPage.js';

export const VideoDetailPage = () => {
  const { videoId } = useParams<{ videoId: string }>();
  if (!videoId) return <NotFoundPage />;

  return (
    <PagePlaceholder
      title="VIDEO"
      step="STEP 26 — DETAIL PAGE"
      description="HLS player, metadata, likes, comments and recommendations land here."
    >
      <code className="border-2 border-ink bg-bone px-2 py-1 dark:bg-ink dark:text-bone">
        videoId={videoId}
      </code>
    </PagePlaceholder>
  );
};

export default VideoDetailPage;
