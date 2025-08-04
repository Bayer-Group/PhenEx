let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const executeStudy = async (
  data: any,
  onProgress?: (message: string, type: 'log' | 'error' | 'result' | 'complete') => void
) => {
  try {
    const response = await fetch(`${BACKEND_URL}/execute_study`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let finalResult = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'result') {
                finalResult = data.data;
                // Don't send the result data as a progress message since it's large
                // Instead send a summary message
                if (onProgress) {
                  onProgress('Execution completed successfully - results received', data.type);
                }
              } else if (data.type === 'error') {
                throw new Error(data.message);
              } else if (onProgress) {
                // For all other types (log, complete), send the message
                onProgress(data.message || '', data.type);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return finalResult;
  } catch (error) {
    console.error('Error executing study:', error);
    throw error;
  }
};

// Add other API methods here as needed
