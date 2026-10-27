import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { unpauseIntakeApiPlugin } from './server/unpauseServer.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), unpauseIntakeApiPlugin()],
})
