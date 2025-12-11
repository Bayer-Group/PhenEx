import { FC, useState, useEffect } from 'react';
import { StudyViewer } from './StudyViewer';
import { UnauthorizedPage } from '../ErrorPages/UnauthorizedPage';
import { NotFoundPage } from '../ErrorPages/NotFoundPage';
import { getStudy } from '@/api/text_to_cohort/route';

interface StudyViewerWrapperProps {
  data?: string;
}

export const StudyViewerWrapper: FC<StudyViewerWrapperProps> = ({ data }) => {
  const [error, setError] = useState<'unauthorized' | 'not-found' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStudyAccess = async () => {
      if (!data) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Try to fetch the study to check access
        await getStudy(data);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading study:', err);
        const status = err?.response?.status || err?.status;
        
        if (status === 401 || status === 403) {
          setError('unauthorized');
        } else if (status === 404) {
          setError('not-found');
        }
        setLoading(false);
      }
    };

    checkStudyAccess();
  }, [data]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        color: 'var(--text-color-secondary)'
      }}>
        Loading study...
      </div>
    );
  }

  if (error === 'unauthorized') {
    return <UnauthorizedPage />;
  }

  if (error === 'not-found') {
    return <NotFoundPage />;
  }

  return <StudyViewer data={data} />;
};
