import React, { createContext, useContext, useEffect, useState } from 'react';

interface FontLoaderContextType {
  fontsLoaded: boolean;
}

const FontLoaderContext = createContext<FontLoaderContextType>({
  fontsLoaded: false,
});

export const useFontsLoaded = () => {
  const context = useContext(FontLoaderContext);
  if (!context) {
    throw new Error('useFontsLoaded must be used within a FontLoaderProvider');
  }
  return context;
};

interface FontLoaderProviderProps {
  children: React.ReactNode;
}

export const FontLoaderProvider: React.FC<FontLoaderProviderProps> = ({ children }) => {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        // Check if FontFace API is supported
        if ('fonts' in document) {
          // Use the modern Font Loading API
          const fontPromises = [
            document.fonts.load('400 16px IBMPlexSans-regular'),
            document.fonts.load('700 16px IBMPlexSans-bold'),
          ];

          try {
            await Promise.all(fontPromises);
            setFontsLoaded(true);
          } catch (error) {
            console.warn('Font loading with FontFace API failed, falling back to timeout:', error);
            // Fallback: Set fonts as loaded after a reasonable timeout
            setTimeout(() => setFontsLoaded(true), 2000);
          }
        } else {
          // Fallback for older browsers: use a simple timeout
          setTimeout(() => setFontsLoaded(true), 1500);
        }
      } catch (error) {
        console.warn('Font loading failed, proceeding with fallback fonts:', error);
        // Ensure we don't block the UI indefinitely
        setTimeout(() => setFontsLoaded(true), 1000);
      }
    };

    loadFonts();
  }, []);

  return (
    <FontLoaderContext.Provider value={{ fontsLoaded }}>
      {children}
    </FontLoaderContext.Provider>
  );
};