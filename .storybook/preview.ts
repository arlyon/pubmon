import type { Preview } from '@storybook/nextjs-vite'
import React from 'react'
import '../app/globals.css'
import PixelScreen from '../components/pixel/PixelScreen'

/**
 * Mock AudioProvider so components using useAudio / usePokemonCry
 * can render in Storybook without Howler.js.
 */
const noop = () => {};
const MockAudioContext = React.createContext({
  playBGM: noop,
  stopBGM: noop,
  playSFX: noop,
  playCry: noop,
  playAttackSFX: noop,
  preloadTrack: noop,
  preloadCry: noop,
  setVolume: noop,
  isMuted: false,
  toggleMute: noop,
});

// Patch the real module so useAudio() returns our mock
import { AudioProvider } from '../components/audio-manager';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo'
    },
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      React.createElement(PixelScreen, null,
        React.createElement(AudioProvider, null, React.createElement(Story))
      )
    ),
  ],
};

export default preview;