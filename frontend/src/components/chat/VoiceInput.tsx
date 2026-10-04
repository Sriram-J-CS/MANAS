import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { speechEngine } from '../../lib/voice/speechEngine';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  language?: string;
  isListening?: boolean;
  onListeningChange?: (listening: boolean) => void;
  className?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  language = 'en',
  isListening: propListening,
  onListeningChange,
  className = '',
}) => {
  const [internalListening, setInternalListening] = useState<boolean>(false);
  const isListening = propListening ?? internalListening;

  const toggleListening = () => {
    if (isListening) {
      speechEngine.stopListening();
      setInternalListening(false);
      onListeningChange?.(false);
    } else {
      setInternalListening(true);
      onListeningChange?.(true);

      speechEngine.startListening(
        language,
        (transcript, isFinal) => {
          if (isFinal && transcript.trim()) {
            onTranscript(transcript.trim());
            speechEngine.stopListening();
            setInternalListening(false);
            onListeningChange?.(false);
          }
        },
        (err) => {
          console.warn('Speech recognition warning:', err);
          speechEngine.stopListening();
          setInternalListening(false);
          onListeningChange?.(false);
        }
      );
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`p-2.5 rounded-full transition-all cursor-pointer ${
        isListening
          ? 'bg-rose-500 text-white animate-pulse shadow-md'
          : 'bg-[#FDFBF7] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-[#F3F0E6]'
      } ${className}`}
      title={isListening ? 'Listening... click to stop' : 'Click to speak to mascot'}
    >
      {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
    </button>
  );
};
