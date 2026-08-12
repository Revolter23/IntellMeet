import React from 'react';

interface LoadingProps {
  children?: React.ReactNode;
  text?: React.ReactNode;
}

const Loading: React.FC<LoadingProps> = ({ children, text }) => {
  const content = children || text;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 p-4">
      <div className="h-8 w-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      {content && (
        <span className="text-sm font-semibold text-text-primary text-center">
          {content}
        </span>
      )}
    </div>
  );
};

export default Loading;
