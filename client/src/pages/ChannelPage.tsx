import { useParams } from 'react-router-dom';

import { PagePlaceholder } from './_PagePlaceholder.js';
import { NotFoundPage } from './NotFoundPage.js';

export const ChannelPage = () => {
  const { username } = useParams<{ username: string }>();
  if (!username) return <NotFoundPage />;

  return (
    <PagePlaceholder
      title="CHANNEL"
      step="STEP 29 — PUBLIC CHANNEL"
      description="Creator profile and their published videos will land here."
    >
      <code className="border-2 border-ink bg-bone px-2 py-1 dark:bg-ink dark:text-bone">
        @{username}
      </code>
    </PagePlaceholder>
  );
};

export default ChannelPage;
